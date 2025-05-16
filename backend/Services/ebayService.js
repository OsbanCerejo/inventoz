const axios = require('axios');
const AuthService = require('./AuthService');
const { StockUpdateHistory, Products, EbayOrders } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../models');

const ebayService = {
  authService: new AuthService(),

  async bulkUpdateStock(updates) {
    try {
      const accessToken = await this.authService.getAccessToken();
      
      // Get all products to check for alternative SKUs
      const products = await Products.findAll({
        where: {
          sku: {
            [Op.in]: updates.map(update => update.sku)
          }
        }
      });

      // Create a map of original SKU to alternative SKU
      const skuMap = products.reduce((map, product) => {
        map[product.sku] = product.alternativeSku || product.sku;
        return map;
      }, {});
      
      const payload = {
        requests: updates.map(update => ({
          sku: skuMap[update.sku], // Use alternative SKU if available, otherwise use original SKU
          shipToLocationAvailability: {
            quantity: parseInt(update.newQuantity)
          }
        }))
      };

      const response = await axios.post(
        'https://api.ebay.com/sell/inventory/v1/bulk_update_price_quantity',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.status === 200) {
        // Update status to 1 for successful updates
        await StockUpdateHistory.update(
          { status: 1 },
          {
            where: {
              id: {
                [Op.in]: updates.map(update => update.id)
              }
            }
          }
        );
        return {
          success: true,
          message: `Successfully updated ${updates.length} items on eBay`
        };
      } else {
        const errorMessage = response.data?.errors?.[0]?.message || 'Failed to update stock on eBay';
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.errors?.[0]?.message || error.message;
      console.error('Error in bulk stock update:', errorMessage);
      
      // Update tries count and store error response for failed updates
      await StockUpdateHistory.update(
        { 
          tries: sequelize.literal('tries + 1'),
          response: JSON.stringify(error.response?.data || error.message)
        },
        {
          where: {
            id: {
              [Op.in]: updates.map(update => update.id)
            }
          }
        }
      );

      return {
        success: false,
        message: errorMessage,
        errors: [errorMessage]
      };
    }
  },

  async processPendingUpdates() {
    try {
      // Get pending stock updates (status = 0) in batches of 100
      const pendingUpdates = await StockUpdateHistory.findAll({
        where: {
          status: 0,
          tries: {
            [Op.lt]: 3 // Only get items that have been tried less than 3 times
          }
        },
        limit: 100,
        order: [['createdAt', 'ASC']]
      });

      if (pendingUpdates.length === 0) {
        return {
          success: true,
          message: 'No pending updates to process'
        };
      }

      return await this.bulkUpdateStock(pendingUpdates);
    } catch (error) {
      console.error('Error processing pending updates:', error);
      return {
        success: false,
        message: 'Failed to process pending updates',
        errors: [error.message]
      };
    }
  },

  async getOrders({ startTime, endTime } = {}) {
    try {
      const accessToken = await this.authService.getAccessToken();
      
      const params = {
        limit: 200 // Maximum allowed by eBay API
      };
      if (startTime && endTime) {
        params.filter = `creationdate:[${startTime}..${endTime}]`;
      }
      
      let allOrders = [];
      let hasMoreOrders = true;
      let nextUrl = null;
      
      while (hasMoreOrders) {
        const url = nextUrl || 'https://api.ebay.com/sell/fulfillment/v1/order';
        
        try {
          const response = await axios.get(
            url,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              },
              params: nextUrl ? {} : params // Only use params for first request
            }
          );

          const orders = response.data.orders || [];
          allOrders = allOrders.concat(orders);
          
          // Check if there are more orders to fetch
          nextUrl = response.data.next;
          hasMoreOrders = !!nextUrl;
          
          // Add a small delay to avoid rate limiting
          if (hasMoreOrders) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error('Error fetching orders page:', error.message);
          if (error.response) {
            console.error('Error response:', error.response.data);
          }
          // If we get an error, wait a bit longer and try again
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
      }
      
      return allOrders;
    } catch (error) {
      console.error('Error in getOrders:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      throw error;
    }
  },

  async createOrderRecord(order, lineItem, logs) {
    return await EbayOrders.create({
      orderId: order.orderId,
      sku: lineItem.sku,
      quantity: lineItem.quantity,
      orderStatus: order.orderFulfillmentStatus || 'UNKNOWN',
      creationDate: new Date(order.creationDate),
      lastModifiedDate: new Date(order.lastModifiedDate),
      buyerUsername: order.buyer?.username,
      totalAmount: order.pricingSummary?.total?.value,
      currency: order.pricingSummary?.total?.currency,
      shippingAddress: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo,
      lineItemId: lineItem.lineItemId,
      title: lineItem.title,
      price: lineItem.price?.value,
      logs: logs.length > 0 ? JSON.stringify(logs) : null
    });
  },

  async processOrder(order) {
    try {
      for (const lineItem of order.lineItems) {
        const ebaySku = lineItem.sku; // This is the SKU from eBay (could be alternative or main)
        const quantity = lineItem.quantity;
        let logs = [];
        
        if(ebaySku === undefined){
          console.error(`Missing SKU in order: ${order.orderId}`);
          break;
        }

        try {
          // Find the product in our database by either original SKU or alternative SKU
          const product = await Products.findOne({
            where: {
              [Op.or]: [
                { sku: ebaySku },
                { alternativeSku: sequelize.where(
                    sequelize.fn('TRIM', sequelize.col('alternativeSku')),
                    ebaySku
                  )
                }
              ]
            }
          });

          // Check if the order already exists using the main SKU
          const existingOrder = await EbayOrders.findOne({
            where: {
              orderId: order.orderId,
              sku: product ? product.sku : ebaySku // Use main SKU if product found, otherwise use eBay SKU
            }
          });

          if (existingOrder) {
            // If order exists and status is different, handle cancellation
            if (existingOrder.orderStatus !== order.orderFulfillmentStatus) {
              if (order.orderFulfillmentStatus === 'CANCELLED' && product) {
                await product.update({
                  quantity: sequelize.literal(`quantity + ${quantity}`)
                });
                logs.push(`Reversed quantity ${quantity} for cancelled order`);
              }
              // Update the order status
              await existingOrder.update({ 
                orderStatus: order.orderFulfillmentStatus || 'UNKNOWN'
              });
              logs.push(`Updated order status from ${existingOrder.orderStatus} to ${order.orderFulfillmentStatus}`);
            }
            continue;
          }
          
          if (product) {
            // Check if the order is older than 24 hours
            const orderDate = new Date(order.creationDate);
            const now = new Date();
            const hoursDiff = (now - orderDate) / (1000 * 60 * 60);
            
            // Only update quantity if the order is less than 24 hours old
            if (hoursDiff <= 24) {
              // For new orders, update the quantity
              if (order.orderFulfillmentStatus !== 'CANCELLED') {
                await product.update({
                  quantity: sequelize.literal(`quantity - ${quantity}`)
                });
                logs.push(`Reduced quantity by ${quantity} for new order less than 24 hours old`);
              }
            } else {
              logs.push(`Skipped quantity update for order older than 24 hours`);
            }

            // Store detailed order data in the EbayOrders table using the main SKU
            await this.createOrderRecord(order, {
              ...lineItem,
              sku: product.sku // Use the main SKU for database storage
            }, logs);
          } else {
            logs.push('Product not found in database');
            // Store the order with the eBay SKU since we couldn't find a matching product
            await this.createOrderRecord(order, lineItem, logs);
          }
        } catch (error) {
          console.error(`Error processing line item ${ebaySku} for order ${order.orderId}:`, error.message);
          logs.push(`Error processing line item: ${error.message}`);
          await this.createOrderRecord(order, lineItem, logs);
        }
      }
      return true;
    } catch (error) {
      console.error(`Error processing order ${order.orderId}:`, error.message);
      throw error;
    }
  }
};

module.exports = ebayService; 
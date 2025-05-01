const axios = require('axios');
const AuthService = require('../Services/AuthService');
const { StockUpdateHistory } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../models');

class EbayService {
  constructor() {
    this.authService = new AuthService();
  }

  async bulkUpdateStock(updates) {
    try {
      const accessToken = await this.authService.getAccessToken();
      
      const payload = {
        requests: updates.map(update => ({
          sku: update.sku,
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
      console.error('Error in bulk stock update:', error);
      
      const errorResponse = error.response?.data || error.message;
      const errorMessage = error.response?.data?.errors?.[0]?.message || error.message;
      
      // Update tries count and store error response for failed updates
      await StockUpdateHistory.update(
        { 
          tries: sequelize.literal('tries + 1'),
          response: JSON.stringify(errorResponse)
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
  }

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
  }
}

module.exports = new EbayService(); 
const { Products, ProductDetails } = require("../models");
const EmailService = require("./EmailService");

class LowStockAlertService {
  /**
   * Check if a product is low on stock and handle alerts
   * @param {string} sku - Product SKU
   * @param {number} newQuantity - New quantity after update
   * @returns {Promise<Object>} - Result object with alert status
   */
  static async checkAndHandleLowStock(sku, newQuantity, options = {}) {
    try {
      const db = require("../models");
      const transaction = options.transaction;
      const product = await Products.findOne({ 
        where: { sku },
        include: [{
          model: db.ProductDetails,
          required: false,
          attributes: ['tester']
        }],
        transaction
      });
      
      if (!product) {
        return { shouldAlert: false, reason: 'Product not found' };
      }

      // If tracking is not enabled, reset alert sent flag and return
      if (!product.trackQuantity || !product.minimumQuantity) {
        // If tracking was disabled, reset alert sent flag
        if (product.lowStockAlertSent) {
          await Products.update(
            { lowStockAlertSent: false },
            { where: { sku }, transaction }
          );
        }
        return { shouldAlert: false, reason: 'Tracking not enabled' };
      }

      const isLowStock = newQuantity < product.minimumQuantity;

      // If product is low on stock
      if (isLowStock) {
        // If alert hasn't been sent yet, send it
        // This handles: first time tracking is enabled, or tracking was turned back on
        if (!product.lowStockAlertSent) {
          // Mark that alert should be sent
          await Products.update(
            { lowStockAlertSent: true },
            { where: { sku }, transaction }
          );
          
          // Format size display
          const sizeDisplay = product.sizeOz && product.sizeMl 
            ? `${product.sizeOz} oz. / ${product.sizeMl} ml`
            : product.sizeOz 
              ? `${product.sizeOz} oz.`
              : product.sizeMl 
                ? `${product.sizeMl} ml`
                : 'N/A';
          
          return {
            shouldAlert: true,
            product: {
              sku: product.sku,
              itemName: product.itemName,
              brand: product.brand,
              quantity: newQuantity,
              minimumQuantity: product.minimumQuantity,
              sizeOz: product.sizeOz,
              sizeMl: product.sizeMl,
              size: sizeDisplay,
              strength: product.strength || 'N/A',
              shade: product.shade || 'N/A',
              condition: product.condition || 'N/A',
              upc: product.upc || 'N/A',
              tester: (product.ProductDetail || product.ProductDetails) ? ((product.ProductDetail || product.ProductDetails).tester === true || (product.ProductDetail || product.ProductDetails).tester === 1) : false,
              location: product.location
            }
          };
        }
        // If alert was already sent, don't send again
        return { shouldAlert: false, reason: 'Alert already sent' };
      }

      // If product is no longer low on stock, reset the alert flag
      // This allows future alerts when it goes low again
      if (!isLowStock && product.lowStockAlertSent) {
        await Products.update(
          { lowStockAlertSent: false },
          { where: { sku }, transaction }
        );
      }

      return {
        shouldAlert: false,
        reason: isLowStock ? 'Alert already sent' : 'Stock above threshold'
      };
    } catch (error) {
      console.error('Error checking low stock:', error);
      return { shouldAlert: false, reason: 'Error checking stock', error: error.message };
    }
  }

  /**
   * Get all products that are currently low on stock
   * @returns {Promise<Array>} - Array of low stock products
   */
  static async getLowStockProducts() {
    try {
      const db = require("../models");
      const lowStockProducts = await Products.findAll({
        where: {
          trackQuantity: true,
          lowStockAlertSent: true
        },
        include: [{
          model: db.ProductDetails,
          required: false,
          attributes: ['tester']
        }],
        order: [['itemName', 'ASC']]
      });

      return lowStockProducts.map(product => {
        // Format size display
        const sizeDisplay = product.sizeOz && product.sizeMl 
          ? `${product.sizeOz} oz. / ${product.sizeMl} ml`
          : product.sizeOz 
            ? `${product.sizeOz} oz.`
            : product.sizeMl 
              ? `${product.sizeMl} ml`
              : 'N/A';
        
        // Get tester value - handle both ProductDetail (singular) and ProductDetails (plural) for compatibility
        const productDetails = product.ProductDetail || product.ProductDetails;
        const testerValue = productDetails ? (productDetails.tester === true || productDetails.tester === 1) : false;
        
        return {
          sku: product.sku,
          brand: product.brand,
          itemName: product.itemName,
          quantity: product.quantity,
          minimumQuantity: product.minimumQuantity,
          location: product.location,
          image: product.image,
          size: sizeDisplay,
          sizeOz: product.sizeOz,
          sizeMl: product.sizeMl,
          strength: product.strength,
          tester: testerValue
        };
      });
    } catch (error) {
      console.error('Error getting low stock products:', error);
      throw error;
    }
  }

  /**
   * Send email alert using EmailService
   * @param {Object} product - Product information
   * @returns {Promise<boolean>} - Success status
   */
  static async sendEmailAlert(product) {
    try {
      // Get recipient email from environment variable
      const recipientEmail = process.env.LOW_STOCK_ALERT_EMAIL || process.env.ALERT_EMAIL;
      
      if (!recipientEmail) {
        console.warn('Low stock alert email not configured. Set LOW_STOCK_ALERT_EMAIL in .env file.');
        console.log('LOW STOCK ALERT (no email sent):', {
          sku: product.sku,
          itemName: product.itemName,
          brand: product.brand,
          currentQuantity: product.quantity,
          minimumQuantity: product.minimumQuantity,
          timestamp: new Date().toISOString()
        });
        return false;
      }

      // Send email using EmailService
      const emailSent = await EmailService.sendLowStockAlert(product, recipientEmail);
      
      if (emailSent) {
        console.log('Low stock alert email sent successfully for product:', product.sku);
      } else {
        console.error('Failed to send low stock alert email for product:', product.sku);
      }

      return emailSent;
    } catch (error) {
      console.error('Error sending email alert:', error);
      return false;
    }
  }
}

module.exports = LowStockAlertService;


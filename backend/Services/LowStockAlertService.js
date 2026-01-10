const { Products } = require("../models");
const EmailService = require("./EmailService");

class LowStockAlertService {
  /**
   * Check if a product is low on stock and handle alerts
   * @param {string} sku - Product SKU
   * @param {number} newQuantity - New quantity after update
   * @returns {Promise<Object>} - Result object with alert status
   */
  static async checkAndHandleLowStock(sku, newQuantity) {
    try {
      const product = await Products.findOne({ where: { sku } });
      
      if (!product) {
        return { shouldAlert: false, reason: 'Product not found' };
      }

      // If tracking is not enabled, no need to check
      if (!product.trackQuantity || !product.minimumQuantity) {
        // If tracking was disabled, reset alert sent flag
        if (product.lowStockAlertSent) {
          await Products.update(
            { lowStockAlertSent: false },
            { where: { sku } }
          );
        }
        return { shouldAlert: false, reason: 'Tracking not enabled' };
      }

      const isLowStock = newQuantity < product.minimumQuantity;
      const wasLowStock = product.quantity < product.minimumQuantity;

      // If product is now low on stock and alert hasn't been sent
      if (isLowStock && !product.lowStockAlertSent) {
        // Mark that alert should be sent
        await Products.update(
          { lowStockAlertSent: true },
          { where: { sku } }
        );
        
        return {
          shouldAlert: true,
          product: {
            sku: product.sku,
            itemName: product.itemName,
            brand: product.brand,
            quantity: newQuantity,
            minimumQuantity: product.minimumQuantity
          }
        };
      }

      // If product is no longer low on stock, reset the alert flag
      if (!isLowStock && product.lowStockAlertSent) {
        await Products.update(
          { lowStockAlertSent: false },
          { where: { sku } }
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
      const lowStockProducts = await Products.findAll({
        where: {
          trackQuantity: true,
          lowStockAlertSent: true
        },
        order: [['itemName', 'ASC']]
      });

      return lowStockProducts.map(product => ({
        sku: product.sku,
        brand: product.brand,
        itemName: product.itemName,
        quantity: product.quantity,
        minimumQuantity: product.minimumQuantity,
        location: product.location,
        image: product.image
      }));
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


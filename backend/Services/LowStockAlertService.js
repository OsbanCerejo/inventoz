const { Products } = require("../models");

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
   * Send email alert (placeholder - implement with actual email service)
   * @param {Object} product - Product information
   * @returns {Promise<boolean>} - Success status
   */
  static async sendEmailAlert(product) {
    try {
      // TODO: Implement actual email sending
      // For now, just log the alert
      console.log('LOW STOCK ALERT:', {
        sku: product.sku,
        itemName: product.itemName,
        brand: product.brand,
        currentQuantity: product.quantity,
        minimumQuantity: product.minimumQuantity,
        timestamp: new Date().toISOString()
      });

      // If email service is configured, send email here
      // Example with nodemailer:
      // const nodemailer = require('nodemailer');
      // const transporter = nodemailer.createTransport({...});
      // await transporter.sendMail({...});

      return true;
    } catch (error) {
      console.error('Error sending email alert:', error);
      return false;
    }
  }
}

module.exports = LowStockAlertService;


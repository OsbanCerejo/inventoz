const { Products, StockUpdateHistory } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const LowStockAlertService = require("./LowStockAlertService");

class StockUpdateService {
  static async updateProductQuantity(sku, newQuantity, options = {}) {
    try {
      const transaction = options.transaction;
      const lowStockAlerts = Array.isArray(options.lowStockAlerts) ? options.lowStockAlerts : null;
      // Get the current product state
      const currentProduct = await Products.findOne({ where: { sku }, transaction });
      
      if (!currentProduct) {
        throw new Error("Product not found");
      }

      // Update the product quantity
      await Products.update(
        { quantity: newQuantity },
        { where: { sku }, transaction }
      );

      // Only create a stock update history if the product is verified
      if (currentProduct.verified) {
        // Find or create a stock update history
        const [historyRecord, created] = await StockUpdateHistory.findOrCreate({
          where: {
            sku: sku,
            status: 0
          },
          defaults: {
            sku: sku,
            oldQuantity: currentProduct.quantity,
            newQuantity: newQuantity,
            status: 0,
            tries: 0
          },
          transaction
        });

        // If a record exists, update it
        if (!created) {
          await historyRecord.update({
            oldQuantity: currentProduct.quantity,
            newQuantity: newQuantity,
            tries: 0
          }, { transaction });
        }
      }

      // Check for low stock and send alert if needed
      const lowStockCheck = await LowStockAlertService.checkAndHandleLowStock(sku, newQuantity, {
        transaction,
      });
      if (lowStockCheck.shouldAlert) {
        if (lowStockAlerts) {
          lowStockAlerts.push(lowStockCheck.product);
        } else {
          // Send email alert asynchronously (don't wait for it)
          LowStockAlertService.sendEmailAlert(lowStockCheck.product).catch(err => {
            console.error('Failed to send low stock alert email:', err);
          });
        }
      }

      return {
        success: true,
        message: "Product quantity updated successfully",
        product: {
          sku,
          oldQuantity: currentProduct.quantity,
          newQuantity,
          verified: currentProduct.verified
        },
        lowStockAlert: lowStockCheck.shouldAlert
      };
    } catch (error) {
      console.error("Error updating product quantity:", error);
      throw error;
    }
  }

  static async updateMultipleProductQuantities(updates, options = {}) {
    try {
      const results = [];
      for (const update of updates) {
        results.push(
          await this.updateProductQuantity(
            update.sku,
            update.newQuantity,
            options
          )
        );
      }

      return {
        success: true,
        message: "Multiple product quantities updated successfully",
        results
      };
    } catch (error) {
      console.error("Error updating multiple product quantities:", error);
      throw error;
    }
  }
}

module.exports = StockUpdateService; 

const { Products, StockUpdateHistory } = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

class StockUpdateService {
  static async updateProductQuantity(sku, newQuantity) {
    try {
      // Get the current product state
      const currentProduct = await Products.findOne({ where: { sku } });
      
      if (!currentProduct) {
        throw new Error("Product not found");
      }

      // Find or create stock update history
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
        }
      });

      // If record exists, update it
      if (!created) {
        await historyRecord.update({
          oldQuantity: currentProduct.quantity,
          newQuantity: newQuantity,
          tries: 0
        });
      }

      // Update the product quantity
      await Products.update(
        { quantity: newQuantity },
        { where: { sku } }
      );

      return {
        success: true,
        message: "Product quantity updated successfully",
        product: {
          sku,
          oldQuantity: currentProduct.quantity,
          newQuantity
        }
      };
    } catch (error) {
      console.error("Error updating product quantity:", error);
      throw error;
    }
  }

  static async updateMultipleProductQuantities(updates) {
    try {
      const results = await Promise.all(
        updates.map(async (update) => {
          return this.updateProductQuantity(
            update.sku,
            update.newQuantity
          );
        })
      );

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
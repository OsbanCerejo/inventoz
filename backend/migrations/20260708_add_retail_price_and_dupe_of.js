"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const productsColumns = await queryInterface.describeTable("Products");
    if (!productsColumns.retailPrice) {
      await queryInterface.addColumn("Products", "retailPrice", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
        after: "averagePrice",
      });
    }

    const detailsColumns = await queryInterface.describeTable("ProductDetails");
    if (!detailsColumns.dupeOf) {
      await queryInterface.addColumn("ProductDetails", "dupeOf", {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const productsColumns = await queryInterface.describeTable("Products");
    if (productsColumns.retailPrice) {
      await queryInterface.removeColumn("Products", "retailPrice");
    }

    const detailsColumns = await queryInterface.describeTable("ProductDetails");
    if (detailsColumns.dupeOf) {
      await queryInterface.removeColumn("ProductDetails", "dupeOf");
    }
  },
};

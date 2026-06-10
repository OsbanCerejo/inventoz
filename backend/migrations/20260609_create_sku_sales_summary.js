'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('skuSalesSummary', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      sku: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      platform: {
        type: Sequelize.ENUM('tiktok', 'whatnot', 'ebay'),
        allowNull: false,
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      month: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      qty: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('skuSalesSummary', ['sku', 'platform', 'year', 'month'], {
      unique: true,
      name: 'unique_sku_platform_period',
    });

    await queryInterface.addIndex('skuSalesSummary', ['sku'], {
      name: 'idx_sku_sales_summary_sku',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('skuSalesSummary');
  },
};

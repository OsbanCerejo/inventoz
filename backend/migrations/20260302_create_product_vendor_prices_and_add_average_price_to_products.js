'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create ProductVendorPrices table
    await queryInterface.createTable('ProductVendorPrices', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      sku: {
        type: Sequelize.STRING,
        allowNull: false
      },
      vendor: {
        type: Sequelize.STRING,
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'USD'
      },
      inboundCompositeSku: {
        type: Sequelize.STRING,
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Basic index to speed up queries by SKU
    await queryInterface.addIndex('ProductVendorPrices', ['sku']);

    // Optional index to quickly find prices linked to inbound records
    await queryInterface.addIndex('ProductVendorPrices', ['inboundCompositeSku']);

    // Add averagePrice column to Products table
    await queryInterface.addColumn('Products', 'averagePrice', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null
    });

    // Optionally track when the average price was last updated
    await queryInterface.addColumn('Products', 'lastPriceUpdate', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove added columns from Products table
    await queryInterface.removeColumn('Products', 'lastPriceUpdate');
    await queryInterface.removeColumn('Products', 'averagePrice');

    // Drop ProductVendorPrices table
    await queryInterface.dropTable('ProductVendorPrices');
  }
};


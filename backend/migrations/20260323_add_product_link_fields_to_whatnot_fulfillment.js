'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const itemTable = await queryInterface.describeTable('whatnotShipmentItems');
    const scanTable = await queryInterface.describeTable('whatnotShipmentScans');

    if (!itemTable.soldPrice) {
      await queryInterface.addColumn('whatnotShipmentItems', 'soldPrice', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }
    if (!itemTable.costPerItem) {
      await queryInterface.addColumn('whatnotShipmentItems', 'costPerItem', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }
    if (!itemTable.totalCost) {
      await queryInterface.addColumn('whatnotShipmentItems', 'totalCost', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }

    if (!scanTable.auctionStickerNumber) {
      await queryInterface.addColumn('whatnotShipmentScans', 'auctionStickerNumber', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!scanTable.productSku) {
      await queryInterface.addColumn('whatnotShipmentScans', 'productSku', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await queryInterface.addIndex('whatnotShipmentScans', ['productSku']);
    }
    if (!scanTable.previousQuantity) {
      await queryInterface.addColumn('whatnotShipmentScans', 'previousQuantity', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!scanTable.newQuantity) {
      await queryInterface.addColumn('whatnotShipmentScans', 'newQuantity', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!scanTable.soldPrice) {
      await queryInterface.addColumn('whatnotShipmentScans', 'soldPrice', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const itemTable = await queryInterface.describeTable('whatnotShipmentItems');
    const scanTable = await queryInterface.describeTable('whatnotShipmentScans');

    if (scanTable.soldPrice) {
      await queryInterface.removeColumn('whatnotShipmentScans', 'soldPrice');
    }
    if (scanTable.newQuantity) {
      await queryInterface.removeColumn('whatnotShipmentScans', 'newQuantity');
    }
    if (scanTable.previousQuantity) {
      await queryInterface.removeColumn('whatnotShipmentScans', 'previousQuantity');
    }
    if (scanTable.productSku) {
      try {
        await queryInterface.removeIndex('whatnotShipmentScans', ['productSku']);
      } catch (error) {}
      await queryInterface.removeColumn('whatnotShipmentScans', 'productSku');
    }
    if (scanTable.auctionStickerNumber) {
      await queryInterface.removeColumn('whatnotShipmentScans', 'auctionStickerNumber');
    }

    if (itemTable.totalCost) {
      await queryInterface.removeColumn('whatnotShipmentItems', 'totalCost');
    }
    if (itemTable.costPerItem) {
      await queryInterface.removeColumn('whatnotShipmentItems', 'costPerItem');
    }
    if (itemTable.soldPrice) {
      await queryInterface.removeColumn('whatnotShipmentItems', 'soldPrice');
    }
  },
};

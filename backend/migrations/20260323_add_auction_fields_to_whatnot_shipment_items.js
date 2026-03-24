'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('whatnotShipmentItems');

    if (!table.productName) {
      await queryInterface.addColumn('whatnotShipmentItems', 'productName', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.isAuctionItem) {
      await queryInterface.addColumn('whatnotShipmentItems', 'isAuctionItem', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      await queryInterface.addIndex('whatnotShipmentItems', ['isAuctionItem']);
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('whatnotShipmentItems');

    if (table.isAuctionItem) {
      try {
        await queryInterface.removeIndex('whatnotShipmentItems', ['isAuctionItem']);
      } catch (error) {}
      await queryInterface.removeColumn('whatnotShipmentItems', 'isAuctionItem');
    }

    if (table.productName) {
      await queryInterface.removeColumn('whatnotShipmentItems', 'productName');
    }
  },
};

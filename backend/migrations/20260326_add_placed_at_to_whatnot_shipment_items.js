'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('whatnotShipmentItems');

    if (!table.placedAt) {
      await queryInterface.addColumn('whatnotShipmentItems', 'placedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      await queryInterface.addIndex('whatnotShipmentItems', ['placedAt'], {
        name: 'whatnot_shipment_items_placed_at',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('whatnotShipmentItems');

    if (table.placedAt) {
      try {
        await queryInterface.removeIndex('whatnotShipmentItems', 'whatnot_shipment_items_placed_at');
      } catch (error) {}
      await queryInterface.removeColumn('whatnotShipmentItems', 'placedAt');
    }
  },
};

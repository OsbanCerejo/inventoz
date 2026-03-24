'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('whatnotShipmentItems');

    if (!table.closedAt) {
      await queryInterface.addColumn('whatnotShipmentItems', 'closedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      await queryInterface.addIndex('whatnotShipmentItems', ['closedAt']);
    }

    if (!table.closedBy) {
      await queryInterface.addColumn('whatnotShipmentItems', 'closedBy', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('whatnotShipmentItems');

    if (table.closedBy) {
      await queryInterface.removeColumn('whatnotShipmentItems', 'closedBy');
    }
    if (table.closedAt) {
      try {
        await queryInterface.removeIndex('whatnotShipmentItems', ['closedAt']);
      } catch (error) {}
      await queryInterface.removeColumn('whatnotShipmentItems', 'closedAt');
    }
  },
};

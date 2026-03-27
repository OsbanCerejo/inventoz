'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'whatnotShipmentItems';
    const table = await queryInterface.describeTable(tableName);

    if (!table.itemCategory) {
      await queryInterface.addColumn(tableName, 'itemCategory', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'whatnotShipmentItems';
    const table = await queryInterface.describeTable(tableName);

    if (table.itemCategory) {
      await queryInterface.removeColumn(tableName, 'itemCategory');
    }
  },
};

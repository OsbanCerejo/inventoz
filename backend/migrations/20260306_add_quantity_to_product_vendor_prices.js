'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('ProductVendorPrices');
    if (!table.quantity) {
      await queryInterface.addColumn('ProductVendorPrices', 'quantity', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('ProductVendorPrices');
    if (table.quantity) {
      await queryInterface.removeColumn('ProductVendorPrices', 'quantity');
    }
  },
};

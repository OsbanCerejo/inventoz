'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('invoiceTrackerInvoices');
    if (!columns.skipQuantityOnInbound) {
      await queryInterface.addColumn('invoiceTrackerInvoices', 'skipQuantityOnInbound', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        after: 'inboundStatus',
      });
    }
  },

  down: async (queryInterface) => {
    const columns = await queryInterface.describeTable('invoiceTrackerInvoices');
    if (columns.skipQuantityOnInbound) {
      await queryInterface.removeColumn('invoiceTrackerInvoices', 'skipQuantityOnInbound');
    }
  },
};

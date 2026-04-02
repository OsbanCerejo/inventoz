'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('invoiceTrackerInvoices');
    if (!table.trackingInfo) {
      await queryInterface.addColumn('invoiceTrackerInvoices', 'trackingInfo', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('invoiceTrackerInvoices');
    if (table.trackingInfo) {
      await queryInterface.removeColumn('invoiceTrackerInvoices', 'trackingInfo');
    }
  },
};

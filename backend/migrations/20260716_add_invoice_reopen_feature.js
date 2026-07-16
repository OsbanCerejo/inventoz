'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add reopen audit fields to invoiceTrackerInvoices
    await queryInterface.addColumn('invoiceTrackerInvoices', 'reopenedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'archivedBy',
    });
    await queryInterface.addColumn('invoiceTrackerInvoices', 'reopenedBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'reopenedAt',
    });

    // Add retroactive audit fields to invoiceTrackerInvoiceItems
    await queryInterface.addColumn('invoiceTrackerInvoiceItems', 'addedRetroactively', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'quantity',
    });
    await queryInterface.addColumn('invoiceTrackerInvoiceItems', 'retroactivelyAddedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'addedRetroactively',
    });
    await queryInterface.addColumn('invoiceTrackerInvoiceItems', 'retroactivelyAddedBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'retroactivelyAddedAt',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('invoiceTrackerInvoiceItems', 'retroactivelyAddedBy');
    await queryInterface.removeColumn('invoiceTrackerInvoiceItems', 'retroactivelyAddedAt');
    await queryInterface.removeColumn('invoiceTrackerInvoiceItems', 'addedRetroactively');
    await queryInterface.removeColumn('invoiceTrackerInvoices', 'reopenedBy');
    await queryInterface.removeColumn('invoiceTrackerInvoices', 'reopenedAt');
  },
};

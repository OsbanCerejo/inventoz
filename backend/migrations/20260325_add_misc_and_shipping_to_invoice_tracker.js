"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (!table.miscellaneousAmount) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "miscellaneousAmount", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }

    if (!table.shippingAmount) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "shippingAmount", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (table.miscellaneousAmount) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "miscellaneousAmount");
    }

    if (table.shippingAmount) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "shippingAmount");
    }
  },
};

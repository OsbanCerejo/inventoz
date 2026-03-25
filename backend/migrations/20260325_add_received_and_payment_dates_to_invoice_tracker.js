"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (!table.receivedDate) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "receivedDate", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (!table.paymentDate) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "paymentDate", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (table.paymentDate) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "paymentDate");
    }
    if (table.receivedDate) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "receivedDate");
    }
  },
};

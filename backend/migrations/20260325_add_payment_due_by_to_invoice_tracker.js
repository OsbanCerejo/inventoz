"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (!table.paymentDueBy) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "paymentDueBy", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (table.paymentDueBy) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "paymentDueBy");
    }
  },
};

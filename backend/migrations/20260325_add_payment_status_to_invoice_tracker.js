"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (!table.paymentStatus) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "paymentStatus", {
        type: Sequelize.ENUM("paid", "unpaid", "credit"),
        allowNull: false,
        defaultValue: "unpaid",
      });
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE invoiceTrackerInvoices
      MODIFY itemCheckStatus ENUM('not_checked', 'working_on_it', 'verified', 'missing_items')
      NOT NULL DEFAULT 'not_checked'
    `);

    await queryInterface.sequelize.query(`
      UPDATE invoiceTrackerInvoices
      SET itemCheckStatus = 'not_checked'
      WHERE itemCheckStatus IS NULL OR itemCheckStatus = ''
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    await queryInterface.sequelize.query(`
      ALTER TABLE invoiceTrackerInvoices
      MODIFY itemCheckStatus ENUM('working_on_it', 'verified', 'missing_items')
      NOT NULL DEFAULT 'working_on_it'
    `);

    if (table.paymentStatus) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "paymentStatus");
    }
  },
};

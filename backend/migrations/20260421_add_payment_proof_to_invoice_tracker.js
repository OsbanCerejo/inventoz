"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("invoiceTrackerInvoices", "paymentProofImagePath", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("invoiceTrackerInvoices", "paymentProofOriginalName", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("invoiceTrackerInvoices", "paymentProofUploadedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("invoiceTrackerInvoices", "paymentProofUploadedBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("invoiceTrackerInvoices", "paymentProofUploadedBy");
    await queryInterface.removeColumn("invoiceTrackerInvoices", "paymentProofUploadedAt");
    await queryInterface.removeColumn("invoiceTrackerInvoices", "paymentProofOriginalName");
    await queryInterface.removeColumn("invoiceTrackerInvoices", "paymentProofImagePath");
  },
};

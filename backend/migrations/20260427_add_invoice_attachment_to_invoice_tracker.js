"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("invoiceTrackerInvoices", "invoiceAttachmentPath", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("invoiceTrackerInvoices", "invoiceAttachmentOriginalName", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("invoiceTrackerInvoices", "invoiceAttachmentMimeType", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("invoiceTrackerInvoices", "invoiceAttachmentUploadedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("invoiceTrackerInvoices", "invoiceAttachmentUploadedBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("invoiceTrackerInvoices", "invoiceAttachmentUploadedBy");
    await queryInterface.removeColumn("invoiceTrackerInvoices", "invoiceAttachmentUploadedAt");
    await queryInterface.removeColumn("invoiceTrackerInvoices", "invoiceAttachmentMimeType");
    await queryInterface.removeColumn("invoiceTrackerInvoices", "invoiceAttachmentOriginalName");
    await queryInterface.removeColumn("invoiceTrackerInvoices", "invoiceAttachmentPath");
  },
};

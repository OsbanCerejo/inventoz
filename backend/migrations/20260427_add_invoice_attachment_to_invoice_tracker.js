"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (!table.invoiceAttachmentPath) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "invoiceAttachmentPath", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.invoiceAttachmentOriginalName) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "invoiceAttachmentOriginalName", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.invoiceAttachmentMimeType) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "invoiceAttachmentMimeType", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.invoiceAttachmentUploadedAt) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "invoiceAttachmentUploadedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table.invoiceAttachmentUploadedBy) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "invoiceAttachmentUploadedBy", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (table.invoiceAttachmentUploadedBy) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "invoiceAttachmentUploadedBy");
    }
    if (table.invoiceAttachmentUploadedAt) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "invoiceAttachmentUploadedAt");
    }
    if (table.invoiceAttachmentMimeType) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "invoiceAttachmentMimeType");
    }
    if (table.invoiceAttachmentOriginalName) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "invoiceAttachmentOriginalName");
    }
    if (table.invoiceAttachmentPath) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "invoiceAttachmentPath");
    }
  },
};

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("salesOrders");

    if (!table.invoiceAttachmentPath) {
      await queryInterface.addColumn("salesOrders", "invoiceAttachmentPath", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.invoiceAttachmentOriginalName) {
      await queryInterface.addColumn("salesOrders", "invoiceAttachmentOriginalName", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.invoiceAttachmentMimeType) {
      await queryInterface.addColumn("salesOrders", "invoiceAttachmentMimeType", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.invoiceAttachmentUploadedAt) {
      await queryInterface.addColumn("salesOrders", "invoiceAttachmentUploadedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!table.invoiceAttachmentUploadedBy) {
      await queryInterface.addColumn("salesOrders", "invoiceAttachmentUploadedBy", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("salesOrders");

    if (table.invoiceAttachmentUploadedBy) {
      await queryInterface.removeColumn("salesOrders", "invoiceAttachmentUploadedBy");
    }
    if (table.invoiceAttachmentUploadedAt) {
      await queryInterface.removeColumn("salesOrders", "invoiceAttachmentUploadedAt");
    }
    if (table.invoiceAttachmentMimeType) {
      await queryInterface.removeColumn("salesOrders", "invoiceAttachmentMimeType");
    }
    if (table.invoiceAttachmentOriginalName) {
      await queryInterface.removeColumn("salesOrders", "invoiceAttachmentOriginalName");
    }
    if (table.invoiceAttachmentPath) {
      await queryInterface.removeColumn("salesOrders", "invoiceAttachmentPath");
    }
  },
};

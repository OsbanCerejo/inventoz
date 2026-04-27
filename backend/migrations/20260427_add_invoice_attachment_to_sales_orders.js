"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("salesOrders", "invoiceAttachmentPath", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("salesOrders", "invoiceAttachmentOriginalName", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("salesOrders", "invoiceAttachmentMimeType", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("salesOrders", "invoiceAttachmentUploadedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("salesOrders", "invoiceAttachmentUploadedBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("salesOrders", "invoiceAttachmentUploadedBy");
    await queryInterface.removeColumn("salesOrders", "invoiceAttachmentUploadedAt");
    await queryInterface.removeColumn("salesOrders", "invoiceAttachmentMimeType");
    await queryInterface.removeColumn("salesOrders", "invoiceAttachmentOriginalName");
    await queryInterface.removeColumn("salesOrders", "invoiceAttachmentPath");
  },
};

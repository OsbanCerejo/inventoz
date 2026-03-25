"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (!table.isArchived) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "isArchived", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!table.archivedAt) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "archivedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!table.archivedBy) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "archivedBy", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (table.archivedBy) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "archivedBy");
    }
    if (table.archivedAt) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "archivedAt");
    }
    if (table.isArchived) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "isArchived");
    }
  },
};

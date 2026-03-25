"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("reshipmentTickets");
    const indexes = await queryInterface.showIndex("reshipmentTickets");
    const hasArchiveIndex = indexes.some((index) => index.name === "idx_reship_ticket_is_archived");

    if (!table.isArchived) {
      await queryInterface.addColumn("reshipmentTickets", "isArchived", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!table.archivedAt) {
      await queryInterface.addColumn("reshipmentTickets", "archivedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table.archivedBy) {
      await queryInterface.addColumn("reshipmentTickets", "archivedBy", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!hasArchiveIndex) {
      await queryInterface.addIndex("reshipmentTickets", ["isArchived"], {
        name: "idx_reship_ticket_is_archived",
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("reshipmentTickets");
    const indexes = await queryInterface.showIndex("reshipmentTickets");
    const hasArchiveIndex = indexes.some((index) => index.name === "idx_reship_ticket_is_archived");

    if (hasArchiveIndex) {
      await queryInterface.removeIndex("reshipmentTickets", "idx_reship_ticket_is_archived");
    }
    if (table.archivedBy) {
      await queryInterface.removeColumn("reshipmentTickets", "archivedBy");
    }
    if (table.archivedAt) {
      await queryInterface.removeColumn("reshipmentTickets", "archivedAt");
    }
    if (table.isArchived) {
      await queryInterface.removeColumn("reshipmentTickets", "isArchived");
    }
  },
};

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("reshipmentTickets", "isArchived", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn("reshipmentTickets", "archivedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("reshipmentTickets", "archivedBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addIndex("reshipmentTickets", ["isArchived"], {
      name: "idx_reship_ticket_is_archived",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("reshipmentTickets", "idx_reship_ticket_is_archived");
    await queryInterface.removeColumn("reshipmentTickets", "archivedBy");
    await queryInterface.removeColumn("reshipmentTickets", "archivedAt");
    await queryInterface.removeColumn("reshipmentTickets", "isArchived");
  },
};

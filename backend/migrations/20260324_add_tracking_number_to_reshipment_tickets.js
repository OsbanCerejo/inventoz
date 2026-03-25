"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("reshipmentTickets");
    const indexes = await queryInterface.showIndex("reshipmentTickets");
    const hasTrackingIndex = indexes.some((index) => index.name === "idx_reship_ticket_tracking_number");

    if (!table.trackingNumber) {
      await queryInterface.addColumn("reshipmentTickets", "trackingNumber", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!hasTrackingIndex) {
      await queryInterface.addIndex("reshipmentTickets", ["trackingNumber"], {
        name: "idx_reship_ticket_tracking_number",
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("reshipmentTickets");
    const indexes = await queryInterface.showIndex("reshipmentTickets");
    const hasTrackingIndex = indexes.some((index) => index.name === "idx_reship_ticket_tracking_number");

    if (hasTrackingIndex) {
      await queryInterface.removeIndex("reshipmentTickets", "idx_reship_ticket_tracking_number");
    }
    if (table.trackingNumber) {
      await queryInterface.removeColumn("reshipmentTickets", "trackingNumber");
    }
  },
};

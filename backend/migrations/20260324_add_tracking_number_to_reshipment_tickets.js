"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("reshipmentTickets", "trackingNumber", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addIndex("reshipmentTickets", ["trackingNumber"], {
      name: "idx_reship_ticket_tracking_number",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("reshipmentTickets", "idx_reship_ticket_tracking_number");
    await queryInterface.removeColumn("reshipmentTickets", "trackingNumber");
  },
};

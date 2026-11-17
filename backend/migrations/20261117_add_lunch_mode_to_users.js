"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Users", "lunchModeEnabled", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: "isActive",
    });
    await queryInterface.addColumn("Users", "lunchModeEnabledAt", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
      after: "lunchModeEnabled",
    });
    await queryInterface.addColumn("Users", "lunchModeEnabledBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      after: "lunchModeEnabledAt",
    });
    await queryInterface.addColumn("Users", "lunchModeEndsAt", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
      after: "lunchModeEnabledBy",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Users", "lunchModeEndsAt");
    await queryInterface.removeColumn("Users", "lunchModeEnabledBy");
    await queryInterface.removeColumn("Users", "lunchModeEnabledAt");
    await queryInterface.removeColumn("Users", "lunchModeEnabled");
  },
};

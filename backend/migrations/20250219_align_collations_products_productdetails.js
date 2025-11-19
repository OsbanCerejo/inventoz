"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = ["Products", "ProductDetails"];
    for (const table of tables) {
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY \`sku\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;`
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = ["Products", "ProductDetails"];
    for (const table of tables) {
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY \`sku\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;`
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
      );
    }
  }
};


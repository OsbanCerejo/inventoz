"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop existing foreign key constraint before altering collations/types
    // to avoid "incompatible column" errors in MySQL
    await queryInterface.sequelize.query(
      "ALTER TABLE `ProductDetails` DROP FOREIGN KEY `productdetails_ibfk_1`;"
    );

    const tables = ["Products", "ProductDetails"];
    for (const table of tables) {
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE `" +
          table +
          "` MODIFY `sku` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;"
      );
    }

    // Recreate the foreign key with the updated definition
    await queryInterface.sequelize.query(
      "ALTER TABLE `ProductDetails` " +
        "ADD CONSTRAINT `productdetails_ibfk_1` FOREIGN KEY (`sku`) REFERENCES `Products`(`sku`);"
    );
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


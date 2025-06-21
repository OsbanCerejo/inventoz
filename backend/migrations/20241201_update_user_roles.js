'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, update existing users with 'user' role to 'listing'
    await queryInterface.sequelize.query(`
      UPDATE Users SET role = 'listing' WHERE role = 'user'
    `);

    // Update the ENUM type for the role column
    await queryInterface.sequelize.query(`
      ALTER TABLE Users MODIFY COLUMN role ENUM('admin', 'listing', 'packing', 'warehouse_l1', 'warehouse_l2', 'accounts') DEFAULT 'listing'
    `);

    // Add isActive column
    await queryInterface.addColumn('Users', 'isActive', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove isActive column
    await queryInterface.removeColumn('Users', 'isActive');

    // Revert role ENUM to original
    await queryInterface.sequelize.query(`
      UPDATE Users SET role = 'user' WHERE role = 'listing'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE Users MODIFY COLUMN role ENUM('admin', 'user') DEFAULT 'user'
    `);
  }
}; 
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Make this migration idempotent: only add columns if they don't exist

    // Helper to check if a column exists
    const columnExists = async (table, column) => {
      const [results] = await queryInterface.sequelize.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '${table}'
          AND COLUMN_NAME = '${column}'
      `);
      return results && results.length > 0;
    };

    // trackQuantity
    if (!(await columnExists('Products', 'trackQuantity'))) {
      await queryInterface.addColumn('Products', 'trackQuantity', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
      });
    }

    // minimumQuantity
    if (!(await columnExists('Products', 'minimumQuantity'))) {
      await queryInterface.addColumn('Products', 'minimumQuantity', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      });
    }

    // lowStockAlertSent
    if (!(await columnExists('Products', 'lowStockAlertSent'))) {
      await queryInterface.addColumn('Products', 'lowStockAlertSent', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns in reverse order
    await queryInterface.removeColumn('Products', 'lowStockAlertSent');
    await queryInterface.removeColumn('Products', 'minimumQuantity');
    await queryInterface.removeColumn('Products', 'trackQuantity');
  }
};


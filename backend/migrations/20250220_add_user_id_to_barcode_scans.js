'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Make migration idempotent in case the column/index already exist

    // Check if userId column already exists
    const [columns] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'BarcodeScans'
        AND COLUMN_NAME = 'userId'
    `);

    if (!columns || columns.length === 0) {
      // Add userId column to BarcodeScans table
      await queryInterface.addColumn('BarcodeScans', 'userId', {
        type: Sequelize.INTEGER,
        allowNull: true, // Allow null for existing records
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    // Check if index already exists
    const [indexes] = await queryInterface.sequelize.query(`
      SHOW INDEX FROM \`BarcodeScans\` WHERE Key_name = 'barcode_scans_user_id_idx'
    `);

    if (!indexes || indexes.length === 0) {
      // Add index for better query performance
      await queryInterface.addIndex('BarcodeScans', ['userId'], {
        name: 'barcode_scans_user_id_idx'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index first
    await queryInterface.removeIndex('BarcodeScans', 'barcode_scans_user_id_idx');
    
    // Remove column
    await queryInterface.removeColumn('BarcodeScans', 'userId');
  }
};


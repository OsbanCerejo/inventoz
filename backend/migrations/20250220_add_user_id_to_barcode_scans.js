'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
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

    // Add index for better query performance
    await queryInterface.addIndex('BarcodeScans', ['userId'], {
      name: 'barcode_scans_user_id_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index first
    await queryInterface.removeIndex('BarcodeScans', 'barcode_scans_user_id_idx');
    
    // Remove column
    await queryInterface.removeColumn('BarcodeScans', 'userId');
  }
};


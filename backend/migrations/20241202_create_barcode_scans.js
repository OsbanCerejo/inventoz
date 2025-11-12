'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('BarcodeScans', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      barcode: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      scannedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('BarcodeScans', ['barcode'], {
      name: 'barcode_scans_barcode_idx'
    });

    await queryInterface.addIndex('BarcodeScans', ['scannedAt'], {
      name: 'barcode_scans_scanned_at_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('BarcodeScans');
  }
};


'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add trackQuantity column to Products table
    await queryInterface.addColumn('Products', 'trackQuantity', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    });

    // Add minimumQuantity column to Products table
    await queryInterface.addColumn('Products', 'minimumQuantity', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });

    // Add lowStockAlertSent column to track if alert has been sent
    await queryInterface.addColumn('Products', 'lowStockAlertSent', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns in reverse order
    await queryInterface.removeColumn('Products', 'lowStockAlertSent');
    await queryInterface.removeColumn('Products', 'minimumQuantity');
    await queryInterface.removeColumn('Products', 'trackQuantity');
  }
};


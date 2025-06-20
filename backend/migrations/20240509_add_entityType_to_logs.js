'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Logs', 'entityType', {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'The type of entity being logged (e.g., "product", "product_details", "listings")'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Logs', 'entityType');
  }
}; 
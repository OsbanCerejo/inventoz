'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Logs', 'entityId', {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'The identifier of the entity (e.g., SKU for products)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Logs', 'entityId');
  }
}; 
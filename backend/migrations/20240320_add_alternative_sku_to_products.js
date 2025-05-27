'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Products', 'alternativeSku', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'sku'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Products', 'alternativeSku');
  }
}; 
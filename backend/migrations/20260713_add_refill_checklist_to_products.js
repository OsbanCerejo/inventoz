'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Products', 'refillChecklist', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Products', 'refillChecklist');
  },
};

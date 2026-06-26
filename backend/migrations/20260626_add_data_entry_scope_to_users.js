'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'data_entry_brands', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('Users', 'data_entry_categories', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'data_entry_brands');
    await queryInterface.removeColumn('Users', 'data_entry_categories');
  },
};

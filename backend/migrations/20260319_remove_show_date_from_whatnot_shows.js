'use strict';

module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('whatnotShows');

    if (table.showDate) {
      try {
        await queryInterface.removeIndex('whatnotShows', ['showDate']);
      } catch (error) {
        // Ignore if index does not exist
      }
      await queryInterface.removeColumn('whatnotShows', 'showDate');
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('whatnotShows');

    if (!table.showDate) {
      await queryInterface.addColumn('whatnotShows', 'showDate', {
        type: Sequelize.DATEONLY,
        allowNull: true
      });
      await queryInterface.addIndex('whatnotShows', ['showDate']);
    }
  }
};


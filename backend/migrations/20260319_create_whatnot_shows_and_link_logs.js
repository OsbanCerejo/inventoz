'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('whatnotShows', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      showDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdBy: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('whatnotShows', ['showDate']);
    await queryInterface.addIndex('whatnotShows', ['isActive']);

    await queryInterface.addColumn('whatnotLogs', 'whatnotShowId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addConstraint('whatnotLogs', {
      fields: ['whatnotShowId'],
      type: 'foreign key',
      name: 'fk_whatnotlogs_show_id',
      references: {
        table: 'whatnotShows',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addIndex('whatnotLogs', ['whatnotShowId']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('whatnotLogs', ['whatnotShowId']);
    await queryInterface.removeConstraint('whatnotLogs', 'fk_whatnotlogs_show_id');
    await queryInterface.removeColumn('whatnotLogs', 'whatnotShowId');
    await queryInterface.dropTable('whatnotShows');
  }
};


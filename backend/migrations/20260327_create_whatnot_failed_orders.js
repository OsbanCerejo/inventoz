'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'whatnotFailedOrders';
    const tableExists = await queryInterface
      .describeTable(tableName)
      .then(() => true)
      .catch(() => false);

    if (!tableExists) {
      await queryInterface.createTable(tableName, {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        whatnotShowId: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        importId: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        buyer: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        stickerNumber: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        soldPrice: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        failureStatus: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        attemptCount: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        latestPlacedAtRaw: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        latestOrderId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        latestOrderNumericId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
      await queryInterface.addIndex(tableName, ['whatnotShowId', 'importId'], {
        name: 'idx_whatnot_failed_orders_show_import',
      });
      await queryInterface.addIndex(tableName, ['importId', 'stickerNumber'], {
        name: 'idx_whatnot_failed_orders_import_sticker',
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'whatnotFailedOrders';
    const tableExists = await queryInterface
      .describeTable(tableName)
      .then(() => true)
      .catch(() => false);
    if (tableExists) {
      await queryInterface.dropTable(tableName);
    }
  },
};

'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TikTokFailedOrder = sequelize.define(
    'TikTokFailedOrder',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      tiktokShowId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      importId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      buyer: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      stickerNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      soldPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      failureStatus: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      attemptCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      latestPlacedAtRaw: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      latestOrderId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      latestOrderNumericId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'tiktokFailedOrders',
      timestamps: true,
    }
  );

  TikTokFailedOrder.associate = (models) => {
    TikTokFailedOrder.belongsTo(models.TikTokShow, {
      foreignKey: 'tiktokShowId',
      as: 'show',
    });
    TikTokFailedOrder.belongsTo(models.TikTokShipmentImport, {
      foreignKey: 'importId',
      as: 'importRecord',
    });
  };

  return TikTokFailedOrder;
};

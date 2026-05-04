'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TikTokShow = sequelize.define(
    'TikTokShow',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdBy: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'tiktokShows',
      timestamps: true,
      indexes: [{ fields: ['isActive'] }],
    }
  );

  TikTokShow.associate = (models) => {
    TikTokShow.hasMany(models.TikTokShipmentImport, {
      foreignKey: 'tiktokShowId',
      as: 'imports',
    });
    TikTokShow.hasMany(models.TikTokShipmentItem, {
      foreignKey: 'tiktokShowId',
      as: 'shipmentItems',
    });
    TikTokShow.hasMany(models.TikTokShipmentScan, {
      foreignKey: 'tiktokShowId',
      as: 'shipmentScans',
    });
    TikTokShow.hasMany(models.TikTokFailedOrder, {
      foreignKey: 'tiktokShowId',
      as: 'failedOrders',
    });
  };

  return TikTokShow;
};

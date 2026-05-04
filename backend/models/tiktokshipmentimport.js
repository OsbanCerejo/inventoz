'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TikTokShipmentImport = sequelize.define(
    'TikTokShipmentImport',
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
      fileName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      uploadedBy: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      totalRows: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      totalShipments: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      readyShipments: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      pendingReviewShipments: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'tiktokShipmentImports',
      timestamps: true,
    }
  );

  TikTokShipmentImport.associate = (models) => {
    TikTokShipmentImport.belongsTo(models.TikTokShow, {
      foreignKey: 'tiktokShowId',
      as: 'show',
    });
    TikTokShipmentImport.hasMany(models.TikTokShipmentItem, {
      foreignKey: 'importId',
      as: 'items',
    });
    TikTokShipmentImport.hasMany(models.TikTokShipmentScan, {
      foreignKey: 'importId',
      as: 'scans',
    });
    TikTokShipmentImport.hasMany(models.TikTokFailedOrder, {
      foreignKey: 'importId',
      as: 'failedOrders',
    });
  };

  return TikTokShipmentImport;
};

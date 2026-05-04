'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TikTokShipmentScan = sequelize.define(
    'TikTokShipmentScan',
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
        allowNull: true,
      },
      shipmentId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      tracking: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      scannedValue: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      auctionStickerNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      productSku: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      previousQuantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      newQuantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      soldPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      scanType: {
        type: DataTypes.ENUM('tracking', 'item'),
        allowNull: false,
      },
      result: {
        type: DataTypes.ENUM(
          'matched',
          'shipment_loaded',
          'shipment_not_found',
          'tracking_conflict',
          'pending_review_blocked',
          'duplicate',
          'unexpected'
        ),
        allowNull: false,
      },
      message: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'tiktokShipmentScans',
      timestamps: true,
    }
  );

  TikTokShipmentScan.associate = (models) => {
    TikTokShipmentScan.belongsTo(models.TikTokShow, {
      foreignKey: 'tiktokShowId',
      as: 'show',
    });
    TikTokShipmentScan.belongsTo(models.TikTokShipmentImport, {
      foreignKey: 'importId',
      as: 'importRecord',
    });
  };

  return TikTokShipmentScan;
};

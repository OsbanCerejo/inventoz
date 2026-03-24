'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WhatnotShipmentScan = sequelize.define(
    'WhatnotShipmentScan',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      whatnotShowId: {
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
      tableName: 'whatnotShipmentScans',
      timestamps: true,
    }
  );

  WhatnotShipmentScan.associate = (models) => {
    WhatnotShipmentScan.belongsTo(models.WhatnotShow, {
      foreignKey: 'whatnotShowId',
      as: 'show',
    });
    WhatnotShipmentScan.belongsTo(models.WhatnotShipmentImport, {
      foreignKey: 'importId',
      as: 'importRecord',
    });
  };

  return WhatnotShipmentScan;
};

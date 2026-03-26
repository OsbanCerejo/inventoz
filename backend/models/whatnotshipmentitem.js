'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WhatnotShipmentItem = sequelize.define(
    'WhatnotShipmentItem',
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
        allowNull: false,
      },
      shipmentId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tracking: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      stickerNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      productName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isAuctionItem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      expectedQty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      soldPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      costPerItem: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      totalCost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      placedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      scannedQty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM('ready', 'in_progress', 'completed', 'pending_review'),
        allowNull: false,
        defaultValue: 'ready',
      },
      mismatchReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      closedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      closedBy: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      buyer: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      orderId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      orderNumericId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'whatnotShipmentItems',
      timestamps: true,
    }
  );

  WhatnotShipmentItem.associate = (models) => {
    WhatnotShipmentItem.belongsTo(models.WhatnotShow, {
      foreignKey: 'whatnotShowId',
      as: 'show',
    });
    WhatnotShipmentItem.belongsTo(models.WhatnotShipmentImport, {
      foreignKey: 'importId',
      as: 'importRecord',
    });
  };

  return WhatnotShipmentItem;
};

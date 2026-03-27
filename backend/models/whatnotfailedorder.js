'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WhatnotFailedOrder = sequelize.define(
    'WhatnotFailedOrder',
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
      tableName: 'whatnotFailedOrders',
      timestamps: true,
    }
  );

  WhatnotFailedOrder.associate = (models) => {
    WhatnotFailedOrder.belongsTo(models.WhatnotShow, {
      foreignKey: 'whatnotShowId',
      as: 'show',
    });
    WhatnotFailedOrder.belongsTo(models.WhatnotShipmentImport, {
      foreignKey: 'importId',
      as: 'importRecord',
    });
  };

  return WhatnotFailedOrder;
};

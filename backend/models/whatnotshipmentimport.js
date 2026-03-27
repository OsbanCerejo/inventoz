'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WhatnotShipmentImport = sequelize.define(
    'WhatnotShipmentImport',
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
      tableName: 'whatnotShipmentImports',
      timestamps: true,
    }
  );

  WhatnotShipmentImport.associate = (models) => {
    WhatnotShipmentImport.belongsTo(models.WhatnotShow, {
      foreignKey: 'whatnotShowId',
      as: 'show',
    });
    WhatnotShipmentImport.hasMany(models.WhatnotShipmentItem, {
      foreignKey: 'importId',
      as: 'items',
    });
    WhatnotShipmentImport.hasMany(models.WhatnotShipmentScan, {
      foreignKey: 'importId',
      as: 'scans',
    });
    WhatnotShipmentImport.hasMany(models.WhatnotFailedOrder, {
      foreignKey: 'importId',
      as: 'failedOrders',
    });
  };

  return WhatnotShipmentImport;
};

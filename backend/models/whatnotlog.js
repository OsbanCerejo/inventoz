'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WhatnotLog = sequelize.define('WhatnotLog', {
    barcode: {
      type: DataTypes.STRING,
      allowNull: false
    },
    searchType: {
      type: DataTypes.ENUM('UPC', 'SKU'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('not_found', 'found', 'multiple_found'),
      allowNull: false
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true
    },
    quantityReduced: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'whatnotLogs',
    timestamps: true
  });

  return WhatnotLog;
}; 
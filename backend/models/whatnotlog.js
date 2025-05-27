'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WhatnotLog = sequelize.define('WhatnotLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: false
    },
    searchType: {
      type: DataTypes.ENUM('UPC', 'SKU'),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('not_found', 'found', 'multiple_found'),
      allowNull: false
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true
    },
    previousQuantity: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    newQuantity: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    errors: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'whatnotLogs',
    timestamps: true
  });

  return WhatnotLog;
}; 
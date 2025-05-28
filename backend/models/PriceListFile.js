'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PriceListFile extends Model {
    static associate(models) {
      // No associations needed as this is a standalone feature
    }
  }

  PriceListFile.init({
    fileName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    originalName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    customName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      defaultValue: 'pending'
    },
    headerMapping: {
      type: DataTypes.JSON,
      allowNull: true
    },
    productCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'PriceListFile',
    tableName: 'price_list_files',
    timestamps: true
  });

  return PriceListFile;
}; 
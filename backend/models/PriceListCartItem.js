'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PriceListCartItem extends Model {
    static associate(models) {
      PriceListCartItem.belongsTo(models.PriceListUpload, {
        foreignKey: 'sourceUploadId',
        as: 'sourceUpload',
      });
    }
  }

  PriceListCartItem.init(
    {
      vendorName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      identityKey: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      upc: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      brand: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      productName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      availableQty: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      sourceUploadId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      lastUpdatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'PriceListCartItem',
      tableName: 'priceListCartItems',
      timestamps: true,
    }
  );

  return PriceListCartItem;
};

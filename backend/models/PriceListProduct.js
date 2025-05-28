'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PriceListProduct extends Model {
    static associate(models) {
      PriceListProduct.belongsTo(models.PriceListFile, {
        foreignKey: 'priceListFileId',
        as: 'priceListFile'
      });
    }
  }

  PriceListProduct.init({
    productName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    upc: {
      type: DataTypes.STRING,
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    priceListFileId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'price_list_files',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'PriceListProduct',
    tableName: 'price_list_products',
    timestamps: true
  });

  return PriceListProduct;
}; 
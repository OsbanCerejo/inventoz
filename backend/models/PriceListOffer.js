'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PriceListOffer extends Model {
    static associate(models) {
      PriceListOffer.belongsTo(models.PriceListUpload, {
        foreignKey: 'priceListUploadId',
        as: 'upload',
      });
    }
  }

  PriceListOffer.init(
    {
      priceListUploadId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      vendorName: {
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
      identityKey: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      searchText: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'PriceListOffer',
      tableName: 'priceListOffers',
      timestamps: true,
    }
  );

  return PriceListOffer;
};

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PriceListUpload extends Model {
    static associate(models) {
      PriceListUpload.hasMany(models.PriceListOffer, {
        foreignKey: 'priceListUploadId',
        as: 'offers',
      });
      PriceListUpload.hasMany(models.PriceListCartItem, {
        foreignKey: 'sourceUploadId',
        as: 'cartItems',
      });
    }
  }

  PriceListUpload.init(
    {
      vendorName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      originalName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      filePath: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('completed', 'failed'),
        allowNull: false,
        defaultValue: 'completed',
      },
      productCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      uploadedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      catalogVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'PriceListUpload',
      tableName: 'priceListUploads',
      timestamps: true,
    }
  );

  return PriceListUpload;
};

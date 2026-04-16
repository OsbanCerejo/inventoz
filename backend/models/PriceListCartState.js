'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PriceListCartState extends Model {
    static associate() {}
  }

  PriceListCartState.init(
    {
      activeCatalogVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      cartCatalogVersion: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'PriceListCartState',
      tableName: 'priceListCartState',
      timestamps: true,
    }
  );

  return PriceListCartState;
};

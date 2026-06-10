'use strict';

module.exports = (sequelize, DataTypes) => {
  const SkuSalesSummary = sequelize.define(
    'SkuSalesSummary',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      platform: {
        type: DataTypes.ENUM('tiktok', 'whatnot', 'ebay', 'walmart'),
        allowNull: false,
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      month: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      qty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'skuSalesSummary',
      timestamps: false,
      indexes: [
        { unique: true, fields: ['sku', 'platform', 'year', 'month'], name: 'unique_sku_platform_period' },
        { fields: ['sku'], name: 'idx_sku_sales_summary_sku' },
      ],
    }
  );

  return SkuSalesSummary;
};

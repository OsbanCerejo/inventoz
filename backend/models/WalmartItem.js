module.exports = (sequelize, DataTypes) => {
  const WalmartItem = sequelize.define(
    "WalmartItem",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      walmartSku: { type: DataTypes.STRING, allowNull: false, unique: true },
      walmartItemId: { type: DataTypes.STRING, allowNull: true },
      productName: { type: DataTypes.STRING, allowNull: true },
      brand: { type: DataTypes.STRING, allowNull: true },
      publishedStatus: { type: DataTypes.STRING, allowNull: true },
      lifecycleStatus: { type: DataTypes.STRING, allowNull: true },
      productType: { type: DataTypes.STRING, allowNull: true },
      gtin: { type: DataTypes.STRING, allowNull: true },
      currentPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      currency: { type: DataTypes.STRING, allowNull: true },
      rawPayload: { type: DataTypes.TEXT("long"), allowNull: true },
      lastSyncedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "walmartItems",
      timestamps: true,
    }
  );

  WalmartItem.associate = (models) => {
    WalmartItem.hasMany(models.WalmartInventorySnapshot, {
      foreignKey: "walmartSku",
      sourceKey: "walmartSku",
      as: "inventorySnapshots",
      constraints: false,
    });
    WalmartItem.hasMany(models.WalmartPricingSnapshot, {
      foreignKey: "walmartSku",
      sourceKey: "walmartSku",
      as: "pricingSnapshots",
      constraints: false,
    });
    WalmartItem.hasMany(models.WalmartProductMapping, {
      foreignKey: "walmartSku",
      sourceKey: "walmartSku",
      as: "mappings",
      constraints: false,
    });
  };

  return WalmartItem;
};

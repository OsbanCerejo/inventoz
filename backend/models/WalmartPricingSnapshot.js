module.exports = (sequelize, DataTypes) => {
  const WalmartPricingSnapshot = sequelize.define(
    "WalmartPricingSnapshot",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      walmartSku: { type: DataTypes.STRING, allowNull: false },
      currentPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      currency: { type: DataTypes.STRING, allowNull: true },
      comparisonPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      promoPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      promoStartAt: { type: DataTypes.DATE, allowNull: true },
      promoEndAt: { type: DataTypes.DATE, allowNull: true },
      rawPayload: { type: DataTypes.TEXT("long"), allowNull: true },
      syncedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "walmartPricingSnapshots",
      timestamps: true,
    }
  );

  WalmartPricingSnapshot.associate = (models) => {
    WalmartPricingSnapshot.belongsTo(models.WalmartItem, {
      foreignKey: "walmartSku",
      targetKey: "walmartSku",
      as: "item",
      constraints: false,
    });
  };

  return WalmartPricingSnapshot;
};

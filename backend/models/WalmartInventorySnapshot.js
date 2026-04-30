module.exports = (sequelize, DataTypes) => {
  const WalmartInventorySnapshot = sequelize.define(
    "WalmartInventorySnapshot",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      walmartSku: { type: DataTypes.STRING, allowNull: false },
      fulfillmentType: { type: DataTypes.STRING, allowNull: true },
      shipNode: { type: DataTypes.STRING, allowNull: true },
      availableQuantity: { type: DataTypes.INTEGER, allowNull: true },
      rawPayload: { type: DataTypes.TEXT("long"), allowNull: true },
      syncedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "walmartInventorySnapshots",
      timestamps: true,
    }
  );

  WalmartInventorySnapshot.associate = (models) => {
    WalmartInventorySnapshot.belongsTo(models.WalmartItem, {
      foreignKey: "walmartSku",
      targetKey: "walmartSku",
      as: "item",
      constraints: false,
    });
  };

  return WalmartInventorySnapshot;
};

module.exports = (sequelize, DataTypes) => {
  const WalmartOrderLine = sequelize.define(
    "WalmartOrderLine",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      purchaseOrderId: { type: DataTypes.STRING, allowNull: false },
      walmartOrderId: { type: DataTypes.INTEGER, allowNull: false },
      lineNumber: { type: DataTypes.STRING, allowNull: true },
      walmartSku: { type: DataTypes.STRING, allowNull: true },
      productName: { type: DataTypes.STRING, allowNull: true },
      quantity: { type: DataTypes.INTEGER, allowNull: true },
      unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      shippingPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      taxAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      lineStatus: { type: DataTypes.STRING, allowNull: true },
      trackingNumber: { type: DataTypes.STRING, allowNull: true },
      carrier: { type: DataTypes.STRING, allowNull: true },
      rawPayload: { type: DataTypes.TEXT("long"), allowNull: true },
      lastSyncedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "walmartOrderLines",
      timestamps: true,
    }
  );

  WalmartOrderLine.associate = (models) => {
    WalmartOrderLine.belongsTo(models.WalmartOrder, { foreignKey: "walmartOrderId", as: "order" });
    WalmartOrderLine.belongsTo(models.WalmartItem, {
      foreignKey: "walmartSku",
      targetKey: "walmartSku",
      as: "item",
      constraints: false,
    });
  };

  return WalmartOrderLine;
};

module.exports = (sequelize, DataTypes) => {
  const WalmartOrder = sequelize.define(
    "WalmartOrder",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      purchaseOrderId: { type: DataTypes.STRING, allowNull: false, unique: true },
      customerOrderId: { type: DataTypes.STRING, allowNull: true },
      orderDate: { type: DataTypes.DATE, allowNull: true },
      shippingMethod: { type: DataTypes.STRING, allowNull: true },
      orderStatus: { type: DataTypes.STRING, allowNull: true },
      fulfillmentOption: { type: DataTypes.STRING, allowNull: true },
      customerName: { type: DataTypes.STRING, allowNull: true },
      customerEmailMasked: { type: DataTypes.STRING, allowNull: true },
      shippingCity: { type: DataTypes.STRING, allowNull: true },
      shippingState: { type: DataTypes.STRING, allowNull: true },
      shippingPostalCode: { type: DataTypes.STRING, allowNull: true },
      shippingCountry: { type: DataTypes.STRING, allowNull: true },
      totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      currency: { type: DataTypes.STRING, allowNull: true },
      acknowledgedAt: { type: DataTypes.DATE, allowNull: true },
      shippedAt: { type: DataTypes.DATE, allowNull: true },
      deliveredAt: { type: DataTypes.DATE, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      rawPayload: { type: DataTypes.TEXT("long"), allowNull: true },
      lastSyncedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "walmartOrders",
      timestamps: true,
    }
  );

  WalmartOrder.associate = (models) => {
    WalmartOrder.hasMany(models.WalmartOrderLine, {
      foreignKey: "walmartOrderId",
      as: "lines",
      onDelete: "CASCADE",
    });
  };

  return WalmartOrder;
};

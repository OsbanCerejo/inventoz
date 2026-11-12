module.exports = (sequelize, DataTypes) => {
  const LmTiktokOrder = sequelize.define('LmTiktokOrder', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tiktokOrderId: { type: DataTypes.STRING(191), allowNull: false },
    tiktokOrderLineId: { type: DataTypes.STRING(191), allowNull: false },
    tiktokSkuId: { type: DataTypes.STRING(191), allowNull: false },
    mappingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    sku: { type: DataTypes.STRING(191), allowNull: true },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    orderStatus: { type: DataTypes.STRING(64), allowNull: true },
    shipmentStatus: { type: DataTypes.STRING(64), allowNull: true },
    placedAt: { type: DataTypes.DATE, allowNull: true },
    shippedAt: { type: DataTypes.DATE, allowNull: true },
    deductedAt: { type: DataTypes.DATE, allowNull: true },
    deductionEventId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    idempotencyKey: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    cancelledAt: { type: DataTypes.DATE, allowNull: true },
    rawPayload: { type: DataTypes.JSON, allowNull: true },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  }, {
    tableName: 'lm_tiktok_orders',
    timestamps: true,
  });

  LmTiktokOrder.associate = (models) => {
    LmTiktokOrder.belongsTo(models.LmMarketplaceMapping, { foreignKey: 'mappingId', as: 'mapping' });
    LmTiktokOrder.belongsTo(models.LmInventoryEvent, { foreignKey: 'deductionEventId', as: 'deductionEvent' });
  };

  return LmTiktokOrder;
};

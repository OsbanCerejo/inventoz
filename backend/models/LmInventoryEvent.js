module.exports = (sequelize, DataTypes) => {
  const LmInventoryEvent = sequelize.define('LmInventoryEvent', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    sku: { type: DataTypes.STRING(191), allowNull: false },
    previousQty: { type: DataTypes.INTEGER, allowNull: false },
    newQty: { type: DataTypes.INTEGER, allowNull: false },
    delta: { type: DataTypes.INTEGER, allowNull: false },
    eventType: {
      type: DataTypes.ENUM(
        'MANUAL_ADJUSTMENT', 'INBOUND', 'INVOICE_INBOUND',
        'TIKTOK_SHIPMENT_CLOSE', 'MARKETPLACE_DEDUCTION',
        'DAMAGE', 'SKU_MERGE', 'OTHER'
      ),
      defaultValue: 'OTHER',
    },
    eventSource: { type: DataTypes.STRING(128), allowNull: true },
    referenceId: { type: DataTypes.STRING(191), allowNull: true },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    processedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    syncStatus: {
      type: DataTypes.ENUM('pending', 'processed', 'skipped', 'failed'),
      defaultValue: 'pending',
    },
    syncNotes: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'lm_inventory_events',
    timestamps: false,
  });

  LmInventoryEvent.associate = (models) => {
    LmInventoryEvent.hasMany(models.LmTiktokOrder, { foreignKey: 'deductionEventId', as: 'tiktokOrders' });
    LmInventoryEvent.hasMany(models.LmSyncJob, { foreignKey: 'inventoryEventId', as: 'syncJobs' });
  };

  return LmInventoryEvent;
};

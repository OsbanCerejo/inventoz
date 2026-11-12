module.exports = (sequelize, DataTypes) => {
  const LmSyncJob = sequelize.define('LmSyncJob', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    mappingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    jobType: { type: DataTypes.ENUM('qty_update', 'price_update', 'reconcile'), defaultValue: 'qty_update' },
    targetQty: { type: DataTypes.INTEGER, allowNull: true },
    targetPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    inventoryEventId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'done', 'failed', 'cancelled'),
      defaultValue: 'pending',
    },
    attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastAttemptAt: { type: DataTypes.DATE, allowNull: true },
    nextRetryAt: { type: DataTypes.DATE, allowNull: true },
    apiResponse: { type: DataTypes.TEXT, allowNull: true },
    errorMessage: { type: DataTypes.TEXT, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  }, {
    tableName: 'lm_sync_jobs',
    timestamps: true,
  });

  LmSyncJob.associate = (models) => {
    LmSyncJob.belongsTo(models.LmMarketplaceMapping, { foreignKey: 'mappingId', as: 'mapping' });
    LmSyncJob.belongsTo(models.LmInventoryEvent, { foreignKey: 'inventoryEventId', as: 'inventoryEvent' });
  };

  return LmSyncJob;
};

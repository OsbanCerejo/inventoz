module.exports = (sequelize, DataTypes) => {
  const LmMarketplaceMapping = sequelize.define('LmMarketplaceMapping', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    managedSkuId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    marketplace: { type: DataTypes.ENUM('tiktok', 'walmart'), defaultValue: 'tiktok' },
    shopId: { type: DataTypes.STRING(191), allowNull: false },
    marketplaceProductId: { type: DataTypes.STRING(191), allowNull: true },
    marketplaceSkuId: { type: DataTypes.STRING(191), allowNull: true },
    sellerSku: { type: DataTypes.STRING(191), allowNull: true },
    warehouseId: { type: DataTypes.STRING(191), allowNull: true },
    listingStatus: { type: DataTypes.STRING(64), defaultValue: 'active' },
    currentQty: { type: DataTypes.INTEGER, defaultValue: 0 },
    qtyInitialized: { type: DataTypes.BOOLEAN, defaultValue: false },
    desiredQty: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastConfirmedQty: { type: DataTypes.INTEGER, allowNull: true },
    currentPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    syncEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    lastSyncAt: { type: DataTypes.DATE, allowNull: true },
    lastSyncStatus: { type: DataTypes.ENUM('ok', 'failed', 'pending'), allowNull: true },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  }, {
    tableName: 'lm_marketplace_mappings',
    timestamps: true,
  });

  LmMarketplaceMapping.associate = (models) => {
    LmMarketplaceMapping.belongsTo(models.LmManagedSku, { foreignKey: 'managedSkuId', as: 'managedSku' });
    LmMarketplaceMapping.hasMany(models.LmSyncJob, { foreignKey: 'mappingId', as: 'syncJobs' });
    LmMarketplaceMapping.hasMany(models.LmTiktokOrder, { foreignKey: 'mappingId', as: 'orders' });
    LmMarketplaceMapping.hasMany(models.LmPriceHistory, { foreignKey: 'mappingId', as: 'priceHistory' });
    LmMarketplaceMapping.hasMany(models.LmQtyHistory, { foreignKey: 'mappingId', as: 'qtyHistory' });
  };

  return LmMarketplaceMapping;
};

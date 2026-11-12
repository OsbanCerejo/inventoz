module.exports = (sequelize, DataTypes) => {
  const LmManagedSku = sequelize.define('LmManagedSku', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    sku: { type: DataTypes.STRING(191), allowNull: false, unique: true },
    isGenericAuction: { type: DataTypes.BOOLEAN, defaultValue: false },
    syncEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    addedBy: { type: DataTypes.INTEGER, allowNull: true },
    addedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    notes: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'lm_managed_skus',
    timestamps: false,
  });

  LmManagedSku.associate = (models) => {
    LmManagedSku.belongsTo(models.Products, { foreignKey: 'sku', targetKey: 'sku' });
    LmManagedSku.hasMany(models.LmMarketplaceMapping, { foreignKey: 'managedSkuId', as: 'mappings' });
  };

  return LmManagedSku;
};

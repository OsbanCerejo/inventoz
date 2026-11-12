module.exports = (sequelize, DataTypes) => {
  const LmQtyHistory = sequelize.define('LmQtyHistory', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    mappingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    oldQty: { type: DataTypes.INTEGER, allowNull: true },
    newQty: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.STRING(255), allowNull: true },
    changedBy: { type: DataTypes.INTEGER, allowNull: true },
    changedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'lm_qty_history',
    timestamps: false,
  });

  LmQtyHistory.associate = (models) => {
    LmQtyHistory.belongsTo(models.LmMarketplaceMapping, { foreignKey: 'mappingId', as: 'mapping' });
  };

  return LmQtyHistory;
};

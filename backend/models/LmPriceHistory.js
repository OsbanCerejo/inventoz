module.exports = (sequelize, DataTypes) => {
  const LmPriceHistory = sequelize.define('LmPriceHistory', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    mappingId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    oldPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    newPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    changedBy: { type: DataTypes.INTEGER, allowNull: true },
    changedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'lm_price_history',
    timestamps: false,
  });

  LmPriceHistory.associate = (models) => {
    LmPriceHistory.belongsTo(models.LmMarketplaceMapping, { foreignKey: 'mappingId', as: 'mapping' });
  };

  return LmPriceHistory;
};

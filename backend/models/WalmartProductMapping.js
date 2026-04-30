module.exports = (sequelize, DataTypes) => {
  const WalmartProductMapping = sequelize.define(
    "WalmartProductMapping",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      localSku: { type: DataTypes.STRING, allowNull: false },
      walmartSku: { type: DataTypes.STRING, allowNull: false },
      walmartItemId: { type: DataTypes.STRING, allowNull: true },
      walmartProductId: { type: DataTypes.STRING, allowNull: true },
      isMapped: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      mappingSource: {
        type: DataTypes.ENUM("auto", "manual"),
        allowNull: false,
        defaultValue: "auto",
      },
      listingStatus: { type: DataTypes.STRING, allowNull: true },
      lastSyncedAt: { type: DataTypes.DATE, allowNull: true },
      lastSyncStatus: { type: DataTypes.STRING, allowNull: true },
      lastSyncError: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "walmartProductMappings",
      timestamps: true,
    }
  );

  WalmartProductMapping.associate = (models) => {
    WalmartProductMapping.belongsTo(models.Products, {
      foreignKey: "localSku",
      targetKey: "sku",
      as: "product",
      constraints: false,
    });
    WalmartProductMapping.belongsTo(models.WalmartItem, {
      foreignKey: "walmartSku",
      targetKey: "walmartSku",
      as: "item",
      constraints: false,
    });
  };

  return WalmartProductMapping;
};

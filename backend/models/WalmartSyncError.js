module.exports = (sequelize, DataTypes) => {
  const WalmartSyncError = sequelize.define(
    "WalmartSyncError",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      syncRunId: { type: DataTypes.INTEGER, allowNull: false },
      resourceType: {
        type: DataTypes.ENUM("orders", "items", "inventory", "pricing"),
        allowNull: false,
      },
      referenceType: { type: DataTypes.STRING, allowNull: true },
      referenceValue: { type: DataTypes.STRING, allowNull: true },
      errorCode: { type: DataTypes.STRING, allowNull: true },
      errorMessage: { type: DataTypes.TEXT, allowNull: false },
      payloadSnippet: { type: DataTypes.TEXT("long"), allowNull: true },
    },
    {
      tableName: "walmartSyncErrors",
      timestamps: true,
    }
  );

  WalmartSyncError.associate = (models) => {
    WalmartSyncError.belongsTo(models.WalmartSyncRun, { foreignKey: "syncRunId", as: "syncRun" });
  };

  return WalmartSyncError;
};

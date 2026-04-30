module.exports = (sequelize, DataTypes) => {
  const WalmartSyncRun = sequelize.define(
    "WalmartSyncRun",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      resourceType: {
        type: DataTypes.ENUM("orders", "items", "inventory", "pricing"),
        allowNull: false,
      },
      triggerType: {
        type: DataTypes.ENUM("manual", "scheduled"),
        allowNull: false,
        defaultValue: "manual",
      },
      status: {
        type: DataTypes.ENUM("running", "success", "partial", "failed"),
        allowNull: false,
        defaultValue: "running",
      },
      startedAt: { type: DataTypes.DATE, allowNull: false },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      recordsFetched: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      recordsInserted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      recordsUpdated: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      errorCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      summaryMessage: { type: DataTypes.TEXT, allowNull: true },
      requestedBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: "walmartSyncRuns",
      timestamps: true,
    }
  );

  WalmartSyncRun.associate = (models) => {
    WalmartSyncRun.hasMany(models.WalmartSyncError, {
      foreignKey: "syncRunId",
      as: "errors",
      onDelete: "CASCADE",
    });
    WalmartSyncRun.belongsTo(models.User, { foreignKey: "requestedBy", as: "requester" });
  };

  return WalmartSyncRun;
};

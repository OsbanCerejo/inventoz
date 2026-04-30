module.exports = (sequelize, DataTypes) => {
  const WalmartConnection = sequelize.define(
    "WalmartConnection",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      storeName: { type: DataTypes.STRING, allowNull: false, defaultValue: "Walmart USA Store" },
      market: { type: DataTypes.STRING, allowNull: false, defaultValue: "US" },
      apiBaseUrl: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "https://marketplace.walmartapis.com",
      },
      clientIdHint: { type: DataTypes.STRING, allowNull: true },
      status: {
        type: DataTypes.ENUM("active", "error", "disconnected"),
        allowNull: false,
        defaultValue: "disconnected",
      },
      lastTokenSuccessAt: { type: DataTypes.DATE, allowNull: true },
      lastTokenErrorAt: { type: DataTypes.DATE, allowNull: true },
      lastTokenErrorMessage: { type: DataTypes.TEXT, allowNull: true },
      lastOrdersSyncAt: { type: DataTypes.DATE, allowNull: true },
      lastItemsSyncAt: { type: DataTypes.DATE, allowNull: true },
      lastInventorySyncAt: { type: DataTypes.DATE, allowNull: true },
      lastPricingSyncAt: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
      lastUpdatedBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: "walmartConnections",
      timestamps: true,
    }
  );

  WalmartConnection.associate = (models) => {
    WalmartConnection.belongsTo(models.User, { foreignKey: "createdBy", as: "creator" });
    WalmartConnection.belongsTo(models.User, { foreignKey: "lastUpdatedBy", as: "updater" });
  };

  return WalmartConnection;
};

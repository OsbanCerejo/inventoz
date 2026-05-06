module.exports = (sequelize, DataTypes) => {
  const MarketplaceSale = sequelize.define(
    "MarketplaceSale",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orderId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      storeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      storeName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      marketplace: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      saleDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      batchId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      approvedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "marketplaceSales",
      timestamps: true,
    }
  );

  MarketplaceSale.associate = (models) => {
    MarketplaceSale.belongsTo(models.User, {
      foreignKey: "approvedBy",
      as: "approver",
    });
  };

  return MarketplaceSale;
};

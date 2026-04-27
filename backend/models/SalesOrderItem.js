module.exports = (sequelize, DataTypes) => {
  const SalesOrderItem = sequelize.define(
    "SalesOrderItem",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      saleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      itemName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      unitSoldPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
    },
    {
      tableName: "salesOrderItems",
      timestamps: true,
    }
  );

  SalesOrderItem.associate = (models) => {
    SalesOrderItem.belongsTo(models.SalesOrder, {
      foreignKey: "saleId",
      as: "sale",
    });
  };

  return SalesOrderItem;
};

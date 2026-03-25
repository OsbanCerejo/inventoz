module.exports = (sequelize, DataTypes) => {
  const InvoiceShipmentItem = sequelize.define(
    "InvoiceShipmentItem",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      invoiceShipmentId: {
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
      unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      tableName: "invoiceShipmentItems",
      timestamps: true,
    }
  );

  InvoiceShipmentItem.associate = (models) => {
    InvoiceShipmentItem.belongsTo(models.InvoiceShipment, {
      foreignKey: "invoiceShipmentId",
      as: "invoiceShipment",
    });
  };

  return InvoiceShipmentItem;
};

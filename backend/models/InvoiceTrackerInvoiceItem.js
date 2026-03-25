module.exports = (sequelize, DataTypes) => {
  const InvoiceTrackerInvoiceItem = sequelize.define(
    "InvoiceTrackerInvoiceItem",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      invoiceId: {
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
      tableName: "invoiceTrackerInvoiceItems",
      timestamps: true,
    }
  );

  InvoiceTrackerInvoiceItem.associate = (models) => {
    InvoiceTrackerInvoiceItem.belongsTo(models.InvoiceTrackerInvoice, {
      foreignKey: "invoiceId",
      as: "invoice",
    });
  };

  return InvoiceTrackerInvoiceItem;
};

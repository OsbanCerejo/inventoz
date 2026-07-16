module.exports = (sequelize, DataTypes) => {
  const InvoiceTrackerPartialPayment = sequelize.define(
    "InvoiceTrackerPartialPayment",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      invoiceId: { type: DataTypes.INTEGER, allowNull: false },
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      paymentDate: { type: DataTypes.DATEONLY, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
      deletedBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: "invoiceTrackerPartialPayments", timestamps: true }
  );

  InvoiceTrackerPartialPayment.associate = (models) => {
    InvoiceTrackerPartialPayment.belongsTo(models.InvoiceTrackerInvoice, {
      foreignKey: "invoiceId",
      as: "invoice",
    });
    InvoiceTrackerPartialPayment.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
  };

  return InvoiceTrackerPartialPayment;
};

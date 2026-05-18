module.exports = (sequelize, DataTypes) => {
  const InvoiceTrackerPaymentProof = sequelize.define(
    "InvoiceTrackerPaymentProof",
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
      filePath: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      originalName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mimeType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      uploadedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      uploadedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "invoiceTrackerPaymentProofs",
      timestamps: true,
      updatedAt: false,
    }
  );

  InvoiceTrackerPaymentProof.associate = (models) => {
    InvoiceTrackerPaymentProof.belongsTo(models.InvoiceTrackerInvoice, {
      foreignKey: "invoiceId",
      as: "invoice",
      onDelete: "CASCADE",
    });
    InvoiceTrackerPaymentProof.belongsTo(models.User, {
      foreignKey: "uploadedBy",
      as: "uploader",
    });
  };

  return InvoiceTrackerPaymentProof;
};

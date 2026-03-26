module.exports = (sequelize, DataTypes) => {
  const InvoiceTrackerInboundBatch = sequelize.define(
    "InvoiceTrackerInboundBatch",
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
      rowCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      submittedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      submittedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "invoiceTrackerInboundBatches",
      timestamps: true,
      updatedAt: false,
    }
  );

  InvoiceTrackerInboundBatch.associate = (models) => {
    InvoiceTrackerInboundBatch.belongsTo(models.InvoiceTrackerInvoice, {
      foreignKey: "invoiceId",
      as: "invoice",
    });
    InvoiceTrackerInboundBatch.belongsTo(models.User, {
      foreignKey: "submittedBy",
      as: "submitter",
    });
    InvoiceTrackerInboundBatch.hasMany(models.InvoiceTrackerInboundRow, {
      foreignKey: "batchId",
      as: "rows",
    });
  };

  return InvoiceTrackerInboundBatch;
};

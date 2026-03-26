module.exports = (sequelize, DataTypes) => {
  const InvoiceTrackerInboundRow = sequelize.define(
    "InvoiceTrackerInboundRow",
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
      batchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
      expectedQty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      actualQty: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      deltaQty: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      resolutionStatus: {
        type: DataTypes.ENUM("pending", "resolved", "inbounded"),
        allowNull: false,
        defaultValue: "pending",
      },
      resolutionType: {
        type: DataTypes.ENUM("match", "mismatch"),
        allowNull: true,
      },
      mismatchReason: {
        type: DataTypes.ENUM("short_shipped", "damaged", "backordered", "not_in_carton", "counting_error", "overage"),
        allowNull: true,
      },
      inboundedQty: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      inboundCompositeSku: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      resolvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      inboundedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      inboundedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "invoiceTrackerInboundRows",
      timestamps: true,
    }
  );

  InvoiceTrackerInboundRow.associate = (models) => {
    InvoiceTrackerInboundRow.belongsTo(models.InvoiceTrackerInvoice, {
      foreignKey: "invoiceId",
      as: "invoice",
    });
    InvoiceTrackerInboundRow.belongsTo(models.InvoiceTrackerInboundBatch, {
      foreignKey: "batchId",
      as: "batch",
    });
    InvoiceTrackerInboundRow.belongsTo(models.User, {
      foreignKey: "resolvedBy",
      as: "resolver",
    });
    InvoiceTrackerInboundRow.belongsTo(models.User, {
      foreignKey: "inboundedBy",
      as: "inbounder",
    });
  };

  return InvoiceTrackerInboundRow;
};

module.exports = (sequelize, DataTypes) => {
  const InvoiceTrackerInvoice = sequelize.define(
    "InvoiceTrackerInvoice",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      vendorName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      invoiceNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      orderDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      shipmentStatus: {
        type: DataTypes.ENUM("order_placed", "shipped", "received"),
        allowNull: false,
        defaultValue: "order_placed",
      },
      itemCheckStatus: {
        type: DataTypes.ENUM("not_checked", "working_on_it", "verified", "missing_items"),
        allowNull: false,
        defaultValue: "not_checked",
      },
      inboundStatus: {
        type: DataTypes.ENUM("pending", "done"),
        allowNull: false,
        defaultValue: "pending",
      },
      paymentStatus: {
        type: DataTypes.ENUM("paid", "unpaid", "credit"),
        allowNull: false,
        defaultValue: "unpaid",
      },
      paymentDueBy: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      miscellaneousAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      shippingAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      receivedDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      paymentDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      isArchived: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      archivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      archivedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      lastUpdatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "invoiceTrackerInvoices",
      timestamps: true,
    }
  );

  InvoiceTrackerInvoice.associate = (models) => {
    InvoiceTrackerInvoice.hasMany(models.InvoiceTrackerInvoiceItem, {
      foreignKey: "invoiceId",
      as: "items",
      onDelete: "CASCADE",
    });
    InvoiceTrackerInvoice.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
    InvoiceTrackerInvoice.belongsTo(models.User, {
      foreignKey: "lastUpdatedBy",
      as: "updater",
    });
    InvoiceTrackerInvoice.belongsTo(models.User, {
      foreignKey: "archivedBy",
      as: "archiver",
    });
  };

  return InvoiceTrackerInvoice;
};

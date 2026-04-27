module.exports = (sequelize, DataTypes) => {
  const SalesOrder = sequelize.define(
    "SalesOrder",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      receiptNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      saleDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      saleCategory: {
        type: DataTypes.ENUM("customer_sale", "marketplace", "wfs", "wholesale", "other"),
        allowNull: false,
      },
      customerName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      marketplaceName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      marketplaceOther: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      wholesaleName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      wholesaleOther: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      otherCategoryLabel: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentStatus: {
        type: DataTypes.ENUM("unpaid", "partial", "paid"),
        allowNull: false,
        defaultValue: "unpaid",
      },
      shipmentStatus: {
        type: DataTypes.ENUM("pending", "shipped", "delivered"),
        allowNull: false,
        defaultValue: "pending",
      },
      packingStatus: {
        type: DataTypes.ENUM("not_packed", "packing", "packed"),
        allowNull: false,
        defaultValue: "not_packed",
      },
      status: {
        type: DataTypes.ENUM("draft", "finalized", "voided"),
        allowNull: false,
        defaultValue: "draft",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      invoiceAttachmentPath: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      invoiceAttachmentOriginalName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      invoiceAttachmentMimeType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      invoiceAttachmentUploadedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      invoiceAttachmentUploadedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      finalizedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      finalizedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      voidedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      voidedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      voidReason: {
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
      tableName: "salesOrders",
      timestamps: true,
    }
  );

  SalesOrder.associate = (models) => {
    SalesOrder.hasMany(models.SalesOrderItem, {
      foreignKey: "saleId",
      as: "items",
      onDelete: "CASCADE",
    });
    SalesOrder.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
    SalesOrder.belongsTo(models.User, {
      foreignKey: "lastUpdatedBy",
      as: "updater",
    });
    SalesOrder.belongsTo(models.User, {
      foreignKey: "finalizedBy",
      as: "finalizer",
    });
    SalesOrder.belongsTo(models.User, {
      foreignKey: "voidedBy",
      as: "voider",
    });
    SalesOrder.belongsTo(models.User, {
      foreignKey: "invoiceAttachmentUploadedBy",
      as: "invoiceAttachmentUploader",
    });
  };

  return SalesOrder;
};

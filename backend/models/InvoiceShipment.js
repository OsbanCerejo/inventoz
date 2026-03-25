module.exports = (sequelize, DataTypes) => {
  const InvoiceShipment = sequelize.define(
    "InvoiceShipment",
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
        type: DataTypes.ENUM("working_on_it", "verified", "missing_items"),
        allowNull: false,
        defaultValue: "working_on_it",
      },
      inboundStatus: {
        type: DataTypes.ENUM("pending", "done"),
        allowNull: false,
        defaultValue: "pending",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "invoiceShipments",
      timestamps: true,
    }
  );

  InvoiceShipment.associate = (models) => {
    InvoiceShipment.hasMany(models.InvoiceShipmentItem, {
      foreignKey: "invoiceShipmentId",
      as: "items",
      onDelete: "CASCADE",
    });
    InvoiceShipment.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
    InvoiceShipment.belongsTo(models.User, {
      foreignKey: "updatedBy",
      as: "updater",
    });
  };

  return InvoiceShipment;
};

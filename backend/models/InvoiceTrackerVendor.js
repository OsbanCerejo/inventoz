module.exports = (sequelize, DataTypes) => {
  const InvoiceTrackerVendor = sequelize.define(
    "InvoiceTrackerVendor",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      normalizedName: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
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
      tableName: "invoiceTrackerVendors",
      timestamps: true,
    }
  );

  InvoiceTrackerVendor.associate = (models) => {
    InvoiceTrackerVendor.hasMany(models.InvoiceTrackerInvoice, {
      foreignKey: "vendorId",
      as: "invoices",
    });
    InvoiceTrackerVendor.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
    InvoiceTrackerVendor.belongsTo(models.User, {
      foreignKey: "lastUpdatedBy",
      as: "updater",
    });
  };

  return InvoiceTrackerVendor;
};

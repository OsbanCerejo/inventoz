module.exports = (sequelize, DataTypes) => {
  const ProductVendorPrice = sequelize.define(
    'ProductVendorPrice',
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: false
      },
      vendorInvoiceNumber: {
        type: DataTypes.STRING,
        allowNull: false
      },
      vendorName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      inboundCompositeSku: {
        type: DataTypes.STRING,
        allowNull: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      tableName: 'ProductVendorPrices',
      timestamps: true
    }
  );

  ProductVendorPrice.associate = (models) => {
    ProductVendorPrice.belongsTo(models.Products, { foreignKey: 'sku', targetKey: 'sku' });
    ProductVendorPrice.belongsTo(models.Inbound, { foreignKey: 'inboundCompositeSku', targetKey: 'compositeSku' });
  };

  return ProductVendorPrice;
};


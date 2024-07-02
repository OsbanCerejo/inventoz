module.exports = (sequelize, DataTypes) => {
  const Products = sequelize.define(
    "Products",
    {
      sku: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
      },
      brand: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      itemName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sizeOz: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sizeMl: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      strength: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shade: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      formulation: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      upc: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      batch: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      condition: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      verified: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      listed: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      final: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      timestamps: false,
    }
  );

  Products.associate = (models) => {
    Products.hasMany(models.Inbound, { foreignKey: "sku" });
    Products.hasOne(models.ProductDetails, { foreignKey: "sku" });
  };

  return Products;
};

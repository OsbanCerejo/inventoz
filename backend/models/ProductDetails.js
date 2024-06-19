module.exports = (sequelize, DataTypes) => {
  const ProductDetails = sequelize.define(
    "ProductDetails",
    {
      sku: {
        type: DataTypes.TEXT,
        allowNull: false,
        primaryKey: true,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      setOf: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      scentNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      sizetype: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      activeIngredients: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      pao: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      skinType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      mainPurpose: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bodyArea: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      countryOfManufacture: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      gender: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      seo: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      ingredientDesc: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      discontinued: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      tester: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      isHazmat: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      isLimitedEdition: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
    },
    {
      timestamps: false,
    }
  );

  ProductDetails.associate = (models) => {
    ProductDetails.belongsTo(models.Products, { foreignKey: "sku" });
  };

  return ProductDetails;
};

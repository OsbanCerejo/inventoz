module.exports = (sequelize, DataTypes) => {

  const Brands = sequelize.define(
    "Brands",
    {
      brand: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      abbreviation: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      nextNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      timestamps: false,
    }
  );

  return Brands;
};
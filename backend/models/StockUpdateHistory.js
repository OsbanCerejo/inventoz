module.exports = (sequelize, DataTypes) => {
  return sequelize.define("StockUpdateHistory", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    oldQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    newQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    tries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });
}; 
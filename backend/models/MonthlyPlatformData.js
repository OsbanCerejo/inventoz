module.exports = (sequelize, DataTypes) => {
  const MonthlyPlatformData = sequelize.define('MonthlyPlatformData', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    month: { type: DataTypes.STRING(7), allowNull: false },
    platform: { type: DataTypes.STRING(100), allowNull: false },
    unitsSold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    avgSellingPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    feePercentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  }, { tableName: 'monthlyPlatformData', timestamps: true });

  return MonthlyPlatformData;
};

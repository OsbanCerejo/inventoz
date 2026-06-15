module.exports = (sequelize, DataTypes) => {
  const ExpenseMonthOverride = sequelize.define('ExpenseMonthOverride', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    expenseId: { type: DataTypes.INTEGER, allowNull: false },
    month: { type: DataTypes.STRING(7), allowNull: false },
    overrideAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
  }, { tableName: 'expenseMonthOverrides', timestamps: true });

  ExpenseMonthOverride.associate = (models) => {
    ExpenseMonthOverride.belongsTo(models.Expense, { foreignKey: 'expenseId', as: 'expense' });
  };

  return ExpenseMonthOverride;
};

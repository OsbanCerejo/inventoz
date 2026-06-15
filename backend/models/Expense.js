module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define('Expense', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    categoryId: { type: DataTypes.INTEGER, allowNull: true },
    type: { type: DataTypes.ENUM('recurring', 'one_time', 'amortized'), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    platformTag: { type: DataTypes.STRING(100), allowNull: true },
    amortizationMonths: { type: DataTypes.INTEGER, allowNull: true },
    startMonth: { type: DataTypes.STRING(7), allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  }, { tableName: 'expenses', timestamps: true });

  Expense.associate = (models) => {
    Expense.belongsTo(models.ExpenseCategory, { foreignKey: 'categoryId', as: 'category' });
    Expense.hasMany(models.ExpenseMonthOverride, { foreignKey: 'expenseId', as: 'overrides', onDelete: 'CASCADE' });
  };

  return Expense;
};

module.exports = (sequelize, DataTypes) => {
  const ExpenseCategory = sequelize.define('ExpenseCategory', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, { tableName: 'expenseCategories', timestamps: true });

  ExpenseCategory.associate = (models) => {
    ExpenseCategory.hasMany(models.Expense, { foreignKey: 'categoryId', as: 'expenses' });
  };

  return ExpenseCategory;
};

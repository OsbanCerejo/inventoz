'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Expense categories
    await queryInterface.createTable('expenseCategories', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      isDefault: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    // Seed default categories
    const now = new Date();
    const defaults = ['Rent', 'Utilities', 'Software Subscription', 'Shipping Supplies', 'Platform Fees', 'Payroll', 'Other'];
    for (const name of defaults) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM expenseCategories WHERE name = ? LIMIT 1`, { replacements: [name] }
      );
      if (!existing.length) {
        await queryInterface.sequelize.query(
          `INSERT INTO expenseCategories (name, isDefault, createdAt, updatedAt) VALUES (?, 1, ?, ?)`,
          { replacements: [name, now, now] }
        );
      }
    }

    // Expenses
    await queryInterface.createTable('expenses', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      categoryId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'expenseCategories', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      type: { type: Sequelize.ENUM('recurring', 'one_time', 'amortized'), allowNull: false },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      platformTag: { type: Sequelize.STRING(100), allowNull: true },
      amortizationMonths: { type: Sequelize.INTEGER, allowNull: true },
      startMonth: { type: Sequelize.STRING(7), allowNull: false }, // YYYY-MM
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    // Month overrides for recurring/amortized expenses
    await queryInterface.createTable('expenseMonthOverrides', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      expenseId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'expenses', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      month: { type: Sequelize.STRING(7), allowNull: false }, // YYYY-MM
      overrideAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    const [[overrideIdx]] = await queryInterface.sequelize.query(
      `SHOW INDEX FROM expenseMonthOverrides WHERE Key_name = 'unique_expense_month'`
    );
    if (!overrideIdx) {
      await queryInterface.addIndex('expenseMonthOverrides', ['expenseId', 'month'], { unique: true, name: 'unique_expense_month' });
    }

    // Monthly platform data (units sold, avg price, fee %)
    await queryInterface.createTable('monthlyPlatformData', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      month: { type: Sequelize.STRING(7), allowNull: false },
      platform: { type: Sequelize.STRING(100), allowNull: false },
      unitsSold: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      avgSellingPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      feePercentage: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    }, { ifNotExists: true });

    const [[platformIdx]] = await queryInterface.sequelize.query(
      `SHOW INDEX FROM monthlyPlatformData WHERE Key_name = 'unique_month_platform'`
    );
    if (!platformIdx) {
      await queryInterface.addIndex('monthlyPlatformData', ['month', 'platform'], { unique: true, name: 'unique_month_platform' });
    }

    // Permission seeds
    const permNow = new Date();
    const permRows = [
      { key: 'operationsCost.view', scopeType: 'resource_action', resource: 'operationsCost', action: 'view', menuKey: null, label: 'View Operations Cost' },
      { key: 'operationsCost.edit', scopeType: 'resource_action', resource: 'operationsCost', action: 'edit', menuKey: null, label: 'Edit Operations Cost' },
      { key: 'menu.operationsCost', scopeType: 'menu', resource: null, action: null, menuKey: 'operationsCost', label: 'menu operationsCost' },
    ];
    const [existingPerms] = await queryInterface.sequelize.query(
      `SELECT \`key\` FROM Permissions WHERE \`key\` IN ('operationsCost.view','operationsCost.edit','menu.operationsCost')`
    );
    const existingKeys = new Set((existingPerms || []).map((r) => r.key));
    const toInsert = permRows.filter((p) => !existingKeys.has(p.key)).map((p) => ({ ...p, createdAt: permNow, updatedAt: permNow }));
    if (toInsert.length > 0) {
      await queryInterface.bulkInsert('Permissions', toInsert);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('monthlyPlatformData');
    await queryInterface.dropTable('expenseMonthOverrides');
    await queryInterface.dropTable('expenses');
    await queryInterface.dropTable('expenseCategories');
    await queryInterface.bulkDelete('Permissions', { key: ['operationsCost.view', 'operationsCost.edit', 'menu.operationsCost'] });
  },
};

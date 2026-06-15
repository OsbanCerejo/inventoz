const express = require('express');
const { Op } = require('sequelize');
const { ExpenseCategory, Expense, ExpenseMonthOverride, MonthlyPlatformData } = require('../models');
const { auth } = require('../middleware/auth');

const router = express.Router();

// All routes admin-only (checked via role in middleware)
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

const isValidMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

// Returns how many months have elapsed from startMonth through targetMonth (inclusive, minimum 1)
const monthsElapsed = (startMonth, targetMonth) => {
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ty, tm] = targetMonth.split('-').map(Number);
  return Math.max(1, (ty - sy) * 12 + (tm - sm) + 1);
};

// Compute effective amount for an expense in a given month
const effectiveAmount = (expense, month, overrideMap) => {
  const override = overrideMap[`${expense.id}_${month}`];
  if (override !== undefined) return Number(override);

  if (expense.type === 'one_time') {
    return expense.startMonth === month ? Number(expense.amount) : 0;
  }

  if (expense.type === 'amortized') {
    const elapsed = monthsElapsed(expense.startMonth, month);
    const divisor = Math.max(elapsed, Number(expense.amortizationMonths) || 1);
    return Number((Number(expense.amount) / divisor).toFixed(2));
  }

  // recurring
  return Number(expense.amount);
};

// ── Categories ────────────────────────────────────────────────────────────────
router.get('/categories', auth, adminOnly, async (req, res) => {
  try {
    const cats = await ExpenseCategory.findAll({ order: [['isDefault', 'DESC'], ['name', 'ASC']] });
    res.json(cats);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

router.post('/categories', auth, adminOnly, async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (name.length > 100) return res.status(400).json({ error: 'Name too long' });
  try {
    const cat = await ExpenseCategory.create({ name, isDefault: false });
    res.status(201).json(cat);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', auth, adminOnly, async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const cat = await ExpenseCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    await cat.update({ name });
    res.json(cat);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', auth, adminOnly, async (req, res) => {
  try {
    const cat = await ExpenseCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    if (cat.isDefault) return res.status(400).json({ error: 'Cannot delete a default category' });
    await cat.destroy();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ── Expenses ──────────────────────────────────────────────────────────────────
router.get('/expenses', auth, adminOnly, async (req, res) => {
  try {
    const expenses = await Expense.findAll({
      include: [
        { model: ExpenseCategory, as: 'category', attributes: ['id', 'name'] },
        { model: ExpenseMonthOverride, as: 'overrides' },
      ],
      order: [['createdAt', 'ASC']],
    });
    res.json(expenses);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load expenses' });
  }
});

router.post('/expenses', auth, adminOnly, async (req, res) => {
  const { name, categoryId, type, amount, platformTag, amortizationMonths, startMonth, notes } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!['recurring', 'one_time', 'amortized'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (!amount || isNaN(Number(amount)) || Number(amount) < 0) return res.status(400).json({ error: 'Invalid amount' });
  if (!isValidMonth(startMonth)) return res.status(400).json({ error: 'Invalid start month (YYYY-MM)' });
  if (type === 'amortized' && (!amortizationMonths || Number(amortizationMonths) < 1)) {
    return res.status(400).json({ error: 'Amortization months required for amortized type' });
  }
  try {
    const expense = await Expense.create({
      name: name.trim(),
      categoryId: categoryId || null,
      type,
      amount: Number(Number(amount).toFixed(2)),
      platformTag: platformTag?.trim() || null,
      amortizationMonths: type === 'amortized' ? Number(amortizationMonths) : null,
      startMonth,
      notes: notes?.trim() || null,
      isActive: true,
    });
    const full = await Expense.findByPk(expense.id, {
      include: [{ model: ExpenseCategory, as: 'category', attributes: ['id', 'name'] }, { model: ExpenseMonthOverride, as: 'overrides' }],
    });
    res.status(201).json(full);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

router.put('/expenses/:id', auth, adminOnly, async (req, res) => {
  const { name, categoryId, type, amount, platformTag, amortizationMonths, startMonth, notes, isActive } = req.body;
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    await expense.update({
      name: name?.trim() || expense.name,
      categoryId: categoryId !== undefined ? (categoryId || null) : expense.categoryId,
      type: type || expense.type,
      amount: amount !== undefined ? Number(Number(amount).toFixed(2)) : expense.amount,
      platformTag: platformTag !== undefined ? (platformTag?.trim() || null) : expense.platformTag,
      amortizationMonths: amortizationMonths !== undefined ? (Number(amortizationMonths) || null) : expense.amortizationMonths,
      startMonth: startMonth && isValidMonth(startMonth) ? startMonth : expense.startMonth,
      notes: notes !== undefined ? (notes?.trim() || null) : expense.notes,
      isActive: isActive !== undefined ? Boolean(isActive) : expense.isActive,
    });
    const full = await Expense.findByPk(expense.id, {
      include: [{ model: ExpenseCategory, as: 'category', attributes: ['id', 'name'] }, { model: ExpenseMonthOverride, as: 'overrides' }],
    });
    res.json(full);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

router.delete('/expenses/:id', auth, adminOnly, async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    await expense.destroy();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ── Month overrides ───────────────────────────────────────────────────────────
router.put('/expenses/:id/override/:month', auth, adminOnly, async (req, res) => {
  const { id, month } = req.params;
  const { overrideAmount, notes } = req.body;
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Invalid month' });
  if (overrideAmount === undefined || isNaN(Number(overrideAmount)) || Number(overrideAmount) < 0) {
    return res.status(400).json({ error: 'Invalid override amount' });
  }
  try {
    const expense = await Expense.findByPk(id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    const [override] = await ExpenseMonthOverride.upsert({
      expenseId: Number(id),
      month,
      overrideAmount: Number(Number(overrideAmount).toFixed(2)),
      notes: notes?.trim() || null,
    });
    res.json(override);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save override' });
  }
});

router.delete('/expenses/:id/override/:month', auth, adminOnly, async (req, res) => {
  const { id, month } = req.params;
  try {
    await ExpenseMonthOverride.destroy({ where: { expenseId: id, month } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove override' });
  }
});

// ── Platform data ─────────────────────────────────────────────────────────────
router.get('/platform-data/:month', auth, adminOnly, async (req, res) => {
  const { month } = req.params;
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Invalid month' });
  try {
    const rows = await MonthlyPlatformData.findAll({ where: { month }, order: [['platform', 'ASC']] });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load platform data' });
  }
});

router.put('/platform-data/:month', auth, adminOnly, async (req, res) => {
  const { month } = req.params;
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Invalid month' });
  const rows = req.body; // array of { platform, unitsSold, avgSellingPrice, feePercentage }
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'Expected array' });
  try {
    for (const row of rows) {
      const platform = (row.platform || '').trim();
      if (!platform) continue;
      await MonthlyPlatformData.upsert({
        month,
        platform,
        unitsSold: Math.max(0, Number(row.unitsSold) || 0),
        avgSellingPrice: row.avgSellingPrice != null ? Number(Number(row.avgSellingPrice).toFixed(2)) : null,
        feePercentage: row.feePercentage != null ? Number(Number(row.feePercentage).toFixed(2)) : null,
      });
    }
    // Remove platforms no longer in the list
    const platforms = rows.map((r) => (r.platform || '').trim()).filter(Boolean);
    if (platforms.length > 0) {
      await MonthlyPlatformData.destroy({ where: { month, platform: { [Op.notIn]: platforms } } });
    } else {
      await MonthlyPlatformData.destroy({ where: { month } });
    }
    const updated = await MonthlyPlatformData.findAll({ where: { month }, order: [['platform', 'ASC']] });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save platform data' });
  }
});

// ── Summary / COGS calculation ────────────────────────────────────────────────
router.get('/summary/:month', auth, adminOnly, async (req, res) => {
  const { month } = req.params;
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Invalid month' });

  try {
    // Load all active expenses that start on or before this month
    const [year, mon] = month.split('-').map(Number);
    const expenses = await Expense.findAll({
      where: {
        isActive: true,
        startMonth: { [Op.lte]: month },
      },
      include: [
        { model: ExpenseCategory, as: 'category', attributes: ['id', 'name'] },
        { model: ExpenseMonthOverride, as: 'overrides', where: { month }, required: false },
      ],
    });

    // Build override lookup: "expenseId_month" -> amount
    const overrideMap = {};
    for (const exp of expenses) {
      for (const ov of (exp.overrides || [])) {
        overrideMap[`${exp.id}_${ov.month}`] = Number(ov.overrideAmount);
      }
    }

    // Filter: one_time expenses only apply to their startMonth unless overridden
    const activeExpenses = expenses.filter((exp) => {
      if (exp.type === 'one_time') return exp.startMonth === month || overrideMap[`${exp.id}_${month}`] !== undefined;
      return true;
    });

    // Compute effective amount per expense
    const expenseRows = activeExpenses.map((exp) => {
      const amount = effectiveAmount(exp, month, overrideMap);
      const isOverridden = overrideMap[`${exp.id}_${month}`] !== undefined;
      const elapsed = exp.type === 'amortized' ? monthsElapsed(exp.startMonth, month) : null;
      return {
        id: exp.id,
        name: exp.name,
        type: exp.type,
        categoryId: exp.categoryId,
        categoryName: exp.category?.name || null,
        platformTag: exp.platformTag || null,
        baseAmount: Number(exp.amount),
        effectiveAmount: amount,
        isOverridden,
        amortizationMonths: exp.amortizationMonths,
        monthsElapsed: elapsed,
        startMonth: exp.startMonth,
        notes: exp.notes,
      };
    });

    // Separate shared vs platform-specific
    const sharedExpenses = expenseRows.filter((e) => !e.platformTag);
    const platformExpenses = expenseRows.filter((e) => !!e.platformTag);
    const totalShared = sharedExpenses.reduce((sum, e) => sum + e.effectiveAmount, 0);

    // Platform data
    const platformData = await MonthlyPlatformData.findAll({ where: { month }, order: [['platform', 'ASC']] });
    const totalUnits = platformData.reduce((sum, p) => sum + Number(p.unitsSold || 0), 0);

    // Days in month
    const daysInMonth = new Date(year, mon, 0).getDate();
    const costPerDay = totalShared / daysInMonth;

    // Per-platform COGS
    const sharedOverheadPerUnit = totalUnits > 0 ? totalShared / totalUnits : 0;
    const platformBreakdown = platformData.map((p) => {
      const platformSpecific = platformExpenses
        .filter((e) => e.platformTag?.toLowerCase() === p.platform.toLowerCase())
        .reduce((sum, e) => sum + e.effectiveAmount, 0);
      const units = Number(p.unitsSold || 0);
      const avgPrice = Number(p.avgSellingPrice || 0);
      const feePct = Number(p.feePercentage || 0);
      const feePerUnit = avgPrice > 0 ? Number((avgPrice * feePct / 100).toFixed(4)) : 0;
      const platformSpecificPerUnit = units > 0 ? Number((platformSpecific / units).toFixed(4)) : 0;
      const totalCogsPerUnit = Number((sharedOverheadPerUnit + feePerUnit + platformSpecificPerUnit).toFixed(4));
      const profitPerUnit = avgPrice > 0 ? Number((avgPrice - totalCogsPerUnit).toFixed(4)) : null;
      return {
        platform: p.platform,
        unitsSold: units,
        avgSellingPrice: avgPrice,
        feePercentage: feePct,
        feePerUnit,
        platformSpecificExpenses: platformSpecific,
        platformSpecificPerUnit,
        sharedOverheadPerUnit: Number(sharedOverheadPerUnit.toFixed(4)),
        totalCogsPerUnit,
        profitPerUnit,
        revenue: Number((units * avgPrice).toFixed(2)),
      };
    });

    res.json({
      month,
      daysInMonth,
      totalSharedExpenses: Number(totalShared.toFixed(2)),
      costPerDay: Number(costPerDay.toFixed(2)),
      totalUnits,
      sharedOverheadPerUnit: Number(sharedOverheadPerUnit.toFixed(4)),
      expenses: expenseRows,
      platformBreakdown,
    });
  } catch (e) {
    console.error('COGS summary error:', e);
    res.status(500).json({ error: 'Failed to compute summary' });
  }
});

module.exports = router;

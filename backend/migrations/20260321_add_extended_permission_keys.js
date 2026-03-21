"use strict";

const NEW_PERMISSION_ROWS = [
  {
    key: "orders.approve",
    scopeType: "resource_action",
    resource: "orders",
    action: "approve",
    menuKey: null,
    label: "orders approve",
  },
  {
    key: "whatnotAnalytics.view",
    scopeType: "resource_action",
    resource: "whatnotAnalytics",
    action: "view",
    menuKey: null,
    label: "whatnot analytics view",
  },
  {
    key: "packingAnalytics.view",
    scopeType: "resource_action",
    resource: "packingAnalytics",
    action: "view",
    menuKey: null,
    label: "packing analytics view",
  },
  {
    key: "lowStock.view",
    scopeType: "resource_action",
    resource: "lowStock",
    action: "view",
    menuKey: null,
    label: "low stock view",
  },
  {
    key: "menu.whatnotAnalytics",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "whatnotAnalytics",
    label: "menu whatnot analytics",
  },
  {
    key: "menu.packingAnalytics",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "packingAnalytics",
    label: "menu packing analytics",
  },
  {
    key: "menu.lowStock",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "lowStock",
    label: "menu low stock",
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existingRows] = await queryInterface.sequelize.query(
      "SELECT id, `key` FROM `Permissions`"
    );
    const existingKeys = new Set(existingRows.map((row) => row.key));

    const toInsert = NEW_PERMISSION_ROWS.filter((row) => !existingKeys.has(row.key)).map((row) => ({
      ...row,
      createdAt: now,
      updatedAt: now,
    }));

    if (toInsert.length > 0) {
      await queryInterface.bulkInsert("Permissions", toInsert);
    }

    // Grant orders.approve to users who already have orders.edit.
    const [rows] = await queryInterface.sequelize.query(`
      SELECT up.userId, p2.id AS permissionId
      FROM UserPermissions up
      JOIN Permissions p1 ON p1.id = up.permissionId
      JOIN Permissions p2 ON p2.key = 'orders.approve'
      WHERE p1.key = 'orders.edit' AND up.allowed = 1
    `);

    if (rows.length > 0) {
      const [existingApprovals] = await queryInterface.sequelize.query(`
        SELECT userId, permissionId
        FROM UserPermissions
        WHERE permissionId = (SELECT id FROM Permissions WHERE key = 'orders.approve' LIMIT 1)
      `);
      const hasAlready = new Set(existingApprovals.map((r) => `${r.userId}:${r.permissionId}`));
      const inserts = rows
        .filter((r) => !hasAlready.has(`${r.userId}:${r.permissionId}`))
        .map((r) => ({
          userId: r.userId,
          permissionId: r.permissionId,
          allowed: true,
          createdAt: now,
          updatedAt: now,
        }));

      if (inserts.length > 0) {
        await queryInterface.bulkInsert("UserPermissions", inserts);
      }
    }
  },

  async down(queryInterface) {
    const keys = NEW_PERMISSION_ROWS.map((row) => row.key);
    await queryInterface.sequelize.query(
      `DELETE up
       FROM UserPermissions up
       JOIN Permissions p ON p.id = up.permissionId
       WHERE p.key IN (:keys)`,
      { replacements: { keys } }
    );

    await queryInterface.bulkDelete("Permissions", { key: keys });
  },
};


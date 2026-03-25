"use strict";

const NEW_PERMISSION_ROWS = [
  {
    key: "invoiceTracker.view",
    scopeType: "resource_action",
    resource: "invoiceTracker",
    action: "view",
    menuKey: null,
    label: "invoice tracker view",
  },
  {
    key: "invoiceTracker.create",
    scopeType: "resource_action",
    resource: "invoiceTracker",
    action: "create",
    menuKey: null,
    label: "invoice tracker create",
  },
  {
    key: "invoiceTracker.edit",
    scopeType: "resource_action",
    resource: "invoiceTracker",
    action: "edit",
    menuKey: null,
    label: "invoice tracker edit",
  },
  {
    key: "invoiceTracker.delete",
    scopeType: "resource_action",
    resource: "invoiceTracker",
    action: "delete",
    menuKey: null,
    label: "invoice tracker delete",
  },
  {
    key: "menu.invoiceTracker",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "invoiceTracker",
    label: "menu invoice tracker",
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

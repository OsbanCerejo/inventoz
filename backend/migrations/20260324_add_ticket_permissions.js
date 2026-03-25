"use strict";

const NEW_PERMISSION_ROWS = [
  {
    key: "tickets.view",
    scopeType: "resource_action",
    resource: "tickets",
    action: "view",
    menuKey: null,
    label: "tickets view",
  },
  {
    key: "tickets.create",
    scopeType: "resource_action",
    resource: "tickets",
    action: "create",
    menuKey: null,
    label: "tickets create",
  },
  {
    key: "tickets.edit",
    scopeType: "resource_action",
    resource: "tickets",
    action: "edit",
    menuKey: null,
    label: "tickets edit",
  },
  {
    key: "tickets.delete",
    scopeType: "resource_action",
    resource: "tickets",
    action: "delete",
    menuKey: null,
    label: "tickets delete",
  },
  {
    key: "menu.tickets",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "tickets",
    label: "menu tickets",
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

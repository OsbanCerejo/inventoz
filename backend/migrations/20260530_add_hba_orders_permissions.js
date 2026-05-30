"use strict";

const NEW_PERMISSIONS = [
  {
    key: "hbaOrders.view",
    scopeType: "resource_action",
    resource: "hbaOrders",
    action: "view",
    menuKey: null,
    label: "HBA Orders view",
  },
  {
    key: "hbaOrders.edit",
    scopeType: "resource_action",
    resource: "hbaOrders",
    action: "edit",
    menuKey: null,
    label: "HBA Orders edit",
  },
  {
    key: "menu.hbaOrders",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "hbaOrders",
    label: "menu hbaOrders",
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const keys = NEW_PERMISSIONS.map((permission) => permission.key);
    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT id, \`key\` FROM \`Permissions\` WHERE \`key\` IN (${keys.map(() => "?").join(", ")})`,
      { replacements: keys }
    );
    const existingKeys = new Set((existingRows || []).map((row) => row.key));
    const toInsert = NEW_PERMISSIONS.filter((permission) => !existingKeys.has(permission.key)).map(
      (permission) => ({
        ...permission,
        createdAt: now,
        updatedAt: now,
      })
    );

    if (toInsert.length > 0) {
      await queryInterface.bulkInsert("Permissions", toInsert);
    }
  },

  async down(queryInterface) {
    const keys = NEW_PERMISSIONS.map((permission) => permission.key);
    const [permissions] = await queryInterface.sequelize.query(
      `SELECT id FROM \`Permissions\` WHERE \`key\` IN (${keys.map(() => "?").join(", ")})`,
      { replacements: keys }
    );
    const permissionIds = (permissions || []).map((row) => row.id);

    if (permissionIds.length > 0) {
      await queryInterface.bulkDelete("UserPermissions", { permissionId: permissionIds });
    }

    await queryInterface.bulkDelete("Permissions", { key: keys });
  },
};

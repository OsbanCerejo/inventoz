"use strict";

const NEW_PERMISSIONS = [
  {
    key: "brands.view",
    scopeType: "resource_action",
    resource: "brands",
    action: "view",
    menuKey: null,
    label: "Brands view",
  },
  {
    key: "brands.create",
    scopeType: "resource_action",
    resource: "brands",
    action: "create",
    menuKey: null,
    label: "Brands create",
  },
  {
    key: "brands.edit",
    scopeType: "resource_action",
    resource: "brands",
    action: "edit",
    menuKey: null,
    label: "Brands edit",
  },
  {
    key: "menu.brands",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "brands",
    label: "menu brands",
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const keys = NEW_PERMISSIONS.map((perm) => perm.key);
    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT id, \`key\` FROM \`Permissions\` WHERE \`key\` IN (${keys.map(() => "?").join(", ")})`,
      { replacements: keys }
    );
    const existingKeys = new Set((existingRows || []).map((row) => row.key));
    const toInsert = NEW_PERMISSIONS.filter((perm) => !existingKeys.has(perm.key)).map((perm) => ({
      ...perm,
      createdAt: now,
      updatedAt: now,
    }));

    if (toInsert.length > 0) {
      await queryInterface.bulkInsert("Permissions", toInsert);
    }
  },

  async down(queryInterface) {
    const keys = NEW_PERMISSIONS.map((perm) => perm.key);
    const [permissions] = await queryInterface.sequelize.query(
      `SELECT id, \`key\` FROM \`Permissions\` WHERE \`key\` IN (${keys.map(() => "?").join(", ")})`,
      { replacements: keys }
    );
    const permissionIds = (permissions || []).map((row) => row.id);

    if (permissionIds.length > 0) {
      await queryInterface.bulkDelete("UserPermissions", { permissionId: permissionIds });
    }

    await queryInterface.bulkDelete("Permissions", { key: keys });
  },
};

"use strict";

const NEW_PERMISSIONS = [
  {
    key: "priceScanner.view",
    scopeType: "resource_action",
    resource: "priceScanner",
    action: "view",
    menuKey: null,
    label: "Price Scanner view",
  },
  {
    key: "menu.priceScanner",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "priceScanner",
    label: "menu priceScanner",
  },
];

async function revokeNonAdminAssignments(queryInterface, keys) {
  const [permissions] = await queryInterface.sequelize.query(
    `SELECT id FROM \`Permissions\` WHERE \`key\` IN (${keys.map(() => "?").join(", ")})`,
    { replacements: keys }
  );
  const permissionIds = (permissions || []).map((row) => row.id);
  if (permissionIds.length === 0) return;

  await queryInterface.sequelize.query(
    `
    DELETE up
    FROM UserPermissions up
    INNER JOIN Users u ON u.id = up.userId
    WHERE up.permissionId IN (${permissionIds.map(() => "?").join(", ")})
      AND u.role <> 'admin'
    `,
    { replacements: permissionIds }
  );
}

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

    await revokeNonAdminAssignments(queryInterface, keys);
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

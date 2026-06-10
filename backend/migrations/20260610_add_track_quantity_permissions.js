"use strict";

const NEW_PERMISSIONS = [
  {
    key: "trackQuantity.view",
    scopeType: "resource_action",
    resource: "trackQuantity",
    action: "view",
    menuKey: null,
    label: "Track Quantity view",
  },
  {
    key: "trackQuantity.edit",
    scopeType: "resource_action",
    resource: "trackQuantity",
    action: "edit",
    menuKey: null,
    label: "Track Quantity edit",
  },
];

async function copyAssignments(queryInterface, sourceKey, targetKey, now) {
  const [permissions] = await queryInterface.sequelize.query(
    "SELECT id, `key` FROM `Permissions` WHERE `key` IN (?, ?)",
    { replacements: [sourceKey, targetKey] }
  );
  const permissionByKey = new Map((permissions || []).map((row) => [row.key, row.id]));
  const sourcePermissionId = permissionByKey.get(sourceKey);
  const targetPermissionId = permissionByKey.get(targetKey);
  if (!sourcePermissionId || !targetPermissionId) return;

  const [sourceUsers] = await queryInterface.sequelize.query(
    `SELECT up.userId FROM UserPermissions up
     WHERE up.permissionId = :sourcePermissionId AND up.allowed = 1`,
    { replacements: { sourcePermissionId } }
  );
  if (!sourceUsers || sourceUsers.length === 0) return;

  const [existingAssignments] = await queryInterface.sequelize.query(
    "SELECT userId FROM UserPermissions WHERE permissionId = :targetPermissionId",
    { replacements: { targetPermissionId } }
  );
  const assignedUserIds = new Set((existingAssignments || []).map((row) => Number(row.userId)));

  const rowsToInsert = sourceUsers
    .filter((row) => !assignedUserIds.has(Number(row.userId)))
    .map((row) => ({
      userId: Number(row.userId),
      permissionId: targetPermissionId,
      allowed: true,
      createdAt: now,
      updatedAt: now,
    }));

  if (rowsToInsert.length > 0) {
    await queryInterface.bulkInsert("UserPermissions", rowsToInsert);
  }
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const keys = NEW_PERMISSIONS.map((p) => p.key);

    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT id, \`key\` FROM \`Permissions\` WHERE \`key\` IN (${keys.map(() => "?").join(", ")})`,
      { replacements: keys }
    );
    const existingKeys = new Set((existingRows || []).map((row) => row.key));
    const toInsert = NEW_PERMISSIONS.filter((p) => !existingKeys.has(p.key)).map((p) => ({
      ...p,
      createdAt: now,
      updatedAt: now,
    }));

    if (toInsert.length > 0) {
      await queryInterface.bulkInsert("Permissions", toInsert);
    }

    // Copy from products.view -> trackQuantity.view and products.edit -> trackQuantity.edit
    // so existing users with product access inherit track quantity access
    await copyAssignments(queryInterface, "products.view", "trackQuantity.view", now);
    await copyAssignments(queryInterface, "products.edit", "trackQuantity.edit", now);
  },

  async down(queryInterface) {
    const keys = NEW_PERMISSIONS.map((p) => p.key);
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

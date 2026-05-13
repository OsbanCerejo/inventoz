"use strict";

const NEW_PERMISSIONS = [
  {
    key: "whatnotFulfillment.view",
    scopeType: "resource_action",
    resource: "whatnotFulfillment",
    action: "view",
    menuKey: null,
    label: "Whatnot Fulfillment view",
  },
  {
    key: "whatnotFulfillment.create",
    scopeType: "resource_action",
    resource: "whatnotFulfillment",
    action: "create",
    menuKey: null,
    label: "Whatnot Fulfillment create",
  },
  {
    key: "whatnotFulfillment.edit",
    scopeType: "resource_action",
    resource: "whatnotFulfillment",
    action: "edit",
    menuKey: null,
    label: "Whatnot Fulfillment edit",
  },
  {
    key: "whatnotFulfillment.delete",
    scopeType: "resource_action",
    resource: "whatnotFulfillment",
    action: "delete",
    menuKey: null,
    label: "Whatnot Fulfillment delete",
  },
  {
    key: "tiktokFulfillment.view",
    scopeType: "resource_action",
    resource: "tiktokFulfillment",
    action: "view",
    menuKey: null,
    label: "TikTok Fulfillment view",
  },
  {
    key: "tiktokFulfillment.create",
    scopeType: "resource_action",
    resource: "tiktokFulfillment",
    action: "create",
    menuKey: null,
    label: "TikTok Fulfillment create",
  },
  {
    key: "tiktokFulfillment.edit",
    scopeType: "resource_action",
    resource: "tiktokFulfillment",
    action: "edit",
    menuKey: null,
    label: "TikTok Fulfillment edit",
  },
  {
    key: "tiktokFulfillment.delete",
    scopeType: "resource_action",
    resource: "tiktokFulfillment",
    action: "delete",
    menuKey: null,
    label: "TikTok Fulfillment delete",
  },
  {
    key: "labelGenerator.view",
    scopeType: "resource_action",
    resource: "labelGenerator",
    action: "view",
    menuKey: null,
    label: "Label Generator view",
  },
  {
    key: "hbaListing.view",
    scopeType: "resource_action",
    resource: "hbaListing",
    action: "view",
    menuKey: null,
    label: "HBA Listing view",
  },
  {
    key: "hbaListing.edit",
    scopeType: "resource_action",
    resource: "hbaListing",
    action: "edit",
    menuKey: null,
    label: "HBA Listing edit",
  },
  {
    key: "menu.whatnotFulfillment",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "whatnotFulfillment",
    label: "menu whatnotFulfillment",
  },
  {
    key: "menu.tiktokFulfillment",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "tiktokFulfillment",
    label: "menu tiktokFulfillment",
  },
  {
    key: "menu.labelGenerator",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "labelGenerator",
    label: "menu labelGenerator",
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
    `
    SELECT up.userId
    FROM UserPermissions up
    WHERE up.permissionId = :sourcePermissionId
      AND up.allowed = 1
    `,
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

    const copies = [
      ["whatnot.view", "whatnotFulfillment.view"],
      ["whatnot.create", "whatnotFulfillment.create"],
      ["whatnot.edit", "whatnotFulfillment.edit"],
      ["whatnot.delete", "whatnotFulfillment.delete"],
      ["whatnot.view", "tiktokFulfillment.view"],
      ["whatnot.create", "tiktokFulfillment.create"],
      ["whatnot.edit", "tiktokFulfillment.edit"],
      ["whatnot.delete", "tiktokFulfillment.delete"],
      ["whatnot.view", "labelGenerator.view"],
      ["products.view", "hbaListing.view"],
      ["products.edit", "hbaListing.edit"],
      ["menu.whatnot", "menu.whatnotFulfillment"],
      ["menu.whatnot", "menu.tiktokFulfillment"],
      ["menu.whatnot", "menu.labelGenerator"],
    ];

    for (const [sourceKey, targetKey] of copies) {
      await copyAssignments(queryInterface, sourceKey, targetKey, now);
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

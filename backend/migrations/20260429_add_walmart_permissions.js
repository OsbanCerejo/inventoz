"use strict";

const NEW_PERMISSIONS = [
  {
    key: "walmartIntegration.view",
    scopeType: "resource_action",
    resource: "walmartIntegration",
    action: "view",
    menuKey: null,
    label: "Walmart Integration view",
  },
  {
    key: "walmartIntegration.edit",
    scopeType: "resource_action",
    resource: "walmartIntegration",
    action: "edit",
    menuKey: null,
    label: "Walmart Integration edit",
  },
  {
    key: "walmartOrders.view",
    scopeType: "resource_action",
    resource: "walmartOrders",
    action: "view",
    menuKey: null,
    label: "Walmart Orders view",
  },
  {
    key: "menu.walmartIntegration",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "walmartIntegration",
    label: "menu walmartIntegration",
  },
  {
    key: "menu.walmartOrders",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "walmartOrders",
    label: "menu walmartOrders",
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

    const [permissions] = await queryInterface.sequelize.query(
      `SELECT id, \`key\` FROM \`Permissions\` WHERE \`key\` IN (${[
        ...keys,
        "products.view",
        "menu.products",
      ]
        .map(() => "?")
        .join(", ")})`,
      { replacements: [...keys, "products.view", "menu.products"] }
    );
    const permissionByKey = new Map((permissions || []).map((row) => [row.key, row.id]));

    const pairs = [
      [permissionByKey.get("products.view"), permissionByKey.get("walmartIntegration.view")],
      [permissionByKey.get("products.view"), permissionByKey.get("walmartOrders.view")],
      [permissionByKey.get("menu.products"), permissionByKey.get("menu.walmartIntegration")],
      [permissionByKey.get("menu.products"), permissionByKey.get("menu.walmartOrders")],
    ].filter(([sourceId, targetId]) => sourceId && targetId);

    for (const [sourcePermissionId, targetPermissionId] of pairs) {
      const [sourceUsers] = await queryInterface.sequelize.query(
        `
        SELECT up.userId
        FROM UserPermissions up
        WHERE up.permissionId = :sourcePermissionId
          AND up.allowed = 1
        `,
        { replacements: { sourcePermissionId } }
      );

      if (!sourceUsers || sourceUsers.length === 0) continue;

      const [existingAssignments] = await queryInterface.sequelize.query(
        `SELECT userId FROM UserPermissions WHERE permissionId = :targetPermissionId`,
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
  },

  async down(queryInterface) {
    const keys = NEW_PERMISSIONS.map((perm) => perm.key);
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

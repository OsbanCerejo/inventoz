"use strict";

const NEW_PERMISSIONS = [
  {
    key: "sortingAnalytics.view",
    scopeType: "resource_action",
    resource: "sortingAnalytics",
    action: "view",
    menuKey: null,
    label: "Sorting Analytics view",
  },
  {
    key: "menu.sortingAnalytics",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "sortingAnalytics",
    label: "menu sortingAnalytics",
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existingRows] = await queryInterface.sequelize.query(
      "SELECT id, `key` FROM `Permissions` WHERE `key` IN ('sortingAnalytics.view', 'menu.sortingAnalytics')"
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
      "SELECT id, `key` FROM `Permissions` WHERE `key` IN ('sortingAnalytics.view', 'menu.sortingAnalytics', 'whatnotAnalytics.view', 'menu.whatnotAnalytics')"
    );
    const permissionByKey = new Map((permissions || []).map((row) => [row.key, row.id]));

    const pairs = [
      [permissionByKey.get("whatnotAnalytics.view"), permissionByKey.get("sortingAnalytics.view")],
      [permissionByKey.get("menu.whatnotAnalytics"), permissionByKey.get("menu.sortingAnalytics")],
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
        `
        SELECT userId
        FROM UserPermissions
        WHERE permissionId = :targetPermissionId
        `,
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
    const [permissions] = await queryInterface.sequelize.query(
      "SELECT id, `key` FROM `Permissions` WHERE `key` IN ('sortingAnalytics.view', 'menu.sortingAnalytics')"
    );
    const permissionIds = (permissions || []).map((row) => row.id);

    if (permissionIds.length > 0) {
      await queryInterface.bulkDelete("UserPermissions", { permissionId: permissionIds });
    }

    await queryInterface.bulkDelete("Permissions", {
      key: ["sortingAnalytics.view", "menu.sortingAnalytics"],
    });
  },
};

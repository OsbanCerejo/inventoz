"use strict";

const NEW_PERMISSIONS = [
  {
    key: "tiktokSortingAnalytics.view",
    scopeType: "resource_action",
    resource: "tiktokSortingAnalytics",
    action: "view",
    menuKey: null,
    label: "TikTok Sorting Analytics view",
  },
  {
    key: "menu.tiktokSortingAnalytics",
    scopeType: "menu",
    resource: null,
    action: null,
    menuKey: "tiktokSortingAnalytics",
    label: "menu tiktokSortingAnalytics",
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const keys = NEW_PERMISSIONS.map((p) => p.key);
    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT id, \`key\` FROM \`Permissions\` WHERE \`key\` IN (${keys.map(() => "?").join(", ")})`,
      { replacements: keys }
    );
    const existingKeys = new Set((existingRows || []).map((r) => r.key));
    const toInsert = NEW_PERMISSIONS.filter((p) => !existingKeys.has(p.key)).map((p) => ({
      ...p,
      createdAt: now,
      updatedAt: now,
    }));
    if (toInsert.length > 0) {
      await queryInterface.bulkInsert("Permissions", toInsert);
    }
  },

  async down(queryInterface) {
    const keys = NEW_PERMISSIONS.map((p) => p.key);
    const [permissions] = await queryInterface.sequelize.query(
      `SELECT id FROM \`Permissions\` WHERE \`key\` IN (${keys.map(() => "?").join(", ")})`,
      { replacements: keys }
    );
    const ids = (permissions || []).map((r) => r.id);
    if (ids.length > 0) {
      await queryInterface.bulkDelete("UserPermissions", { permissionId: ids });
    }
    await queryInterface.bulkDelete("Permissions", { key: keys });
  },
};

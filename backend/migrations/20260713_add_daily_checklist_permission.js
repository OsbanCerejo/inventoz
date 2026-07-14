'use strict';

const NEW_PERMISSION_ROWS = [
  {
    key: 'menu.dailyChecklist',
    scopeType: 'menu',
    resource: null,
    action: null,
    menuKey: 'dailyChecklist',
    label: 'menu daily checklist',
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existingRows] = await queryInterface.sequelize.query(
      'SELECT id, `key` FROM `Permissions`'
    );
    const existingKeys = new Set(existingRows.map((row) => row.key));
    const toInsert = NEW_PERMISSION_ROWS.filter((row) => !existingKeys.has(row.key)).map((row) => ({
      ...row,
      createdAt: now,
      updatedAt: now,
    }));
    if (toInsert.length > 0) {
      await queryInterface.bulkInsert('Permissions', toInsert);
    }
  },

  async down(queryInterface) {
    const keys = NEW_PERMISSION_ROWS.map((row) => row.key);
    await queryInterface.sequelize.query(
      `DELETE up FROM UserPermissions up
       JOIN Permissions p ON p.id = up.permissionId
       WHERE p.key IN (:keys)`,
      { replacements: { keys } }
    );
    await queryInterface.bulkDelete('Permissions', { key: keys });
  },
};

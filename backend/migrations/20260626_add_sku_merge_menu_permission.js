'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('Permissions', [
      {
        key: 'menu.skuMerge',
        scopeType: 'menu',
        resource: null,
        action: null,
        menuKey: 'skuMerge',
        label: 'menu SKU merge',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Permissions', { key: 'menu.skuMerge' });
  },
};

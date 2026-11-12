'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('Permissions', [
      {
        key: 'menu.listingManagement',
        scopeType: 'menu',
        resource: null,
        action: null,
        menuKey: 'listingManagement',
        label: 'menu Listing Management',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Permissions', { key: 'menu.listingManagement' });
  },
};

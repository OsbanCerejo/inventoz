'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add data_entry_fields column to settings
    await queryInterface.addColumn('settings', 'data_entry_fields', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });

    // Add products.dataEntry permission
    await queryInterface.bulkInsert('Permissions', [
      {
        key: 'products.dataEntry',
        scopeType: 'resource_action',
        resource: 'products',
        action: 'dataEntry',
        menuKey: null,
        label: 'products dataEntry',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], {});

    // Add menu permission for dataEntry page
    await queryInterface.bulkInsert('Permissions', [
      {
        key: 'menu.dataEntry',
        scopeType: 'menu',
        resource: null,
        action: null,
        menuKey: 'dataEntry',
        label: 'Show Data Entry in menu',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        key: 'menu.settings',
        scopeType: 'menu',
        resource: null,
        action: null,
        menuKey: 'settings',
        label: 'Show Settings in menu',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], {});
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('settings', 'data_entry_fields');
    await queryInterface.bulkDelete('Permissions', {
      key: ['products.dataEntry', 'menu.dataEntry', 'menu.settings'],
    }, {});
  },
};

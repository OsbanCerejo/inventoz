'use strict';

const ensureIndex = async (queryInterface, tableName, indexName, fields) => {
  const existing = await queryInterface.showIndex(tableName);
  if (existing.some((entry) => entry.name === indexName)) {
    return;
  }
  await queryInterface.addIndex(tableName, fields, { name: indexName });
};

const dropIndexIfExists = async (queryInterface, tableName, indexName) => {
  const existing = await queryInterface.showIndex(tableName);
  if (!existing.some((entry) => entry.name === indexName)) {
    return;
  }
  await queryInterface.removeIndex(tableName, indexName);
};

module.exports = {
  async up(queryInterface) {
    await ensureIndex(queryInterface, 'Products', 'idx_products_upc', ['upc']);
    await ensureIndex(queryInterface, 'Products', 'idx_products_brand', ['brand']);
    await ensureIndex(queryInterface, 'Products', 'idx_products_item_name', ['itemName']);
    await ensureIndex(queryInterface, 'Products', 'idx_products_location', ['location']);
    await ensureIndex(queryInterface, 'Products', 'idx_products_quantity', ['quantity']);
  },

  async down(queryInterface) {
    await dropIndexIfExists(queryInterface, 'Products', 'idx_products_quantity');
    await dropIndexIfExists(queryInterface, 'Products', 'idx_products_location');
    await dropIndexIfExists(queryInterface, 'Products', 'idx_products_item_name');
    await dropIndexIfExists(queryInterface, 'Products', 'idx_products_brand');
    await dropIndexIfExists(queryInterface, 'Products', 'idx_products_upc');
  },
};

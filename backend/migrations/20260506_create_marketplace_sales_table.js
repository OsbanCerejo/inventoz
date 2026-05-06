"use strict";

const ensureIndex = async (queryInterface, tableName, fields, name) => {
  const indexes = await queryInterface.showIndex(tableName);
  const exists = indexes.some((index) => {
    if (name && index.name === name) return true;
    const indexFields = (index.fields || []).map((field) => field.attribute || field.name);
    return indexFields.length === fields.length && indexFields.every((field, idx) => field === fields[idx]);
  });
  if (!exists) {
    await queryInterface.addIndex(tableName, fields, name ? { name } : undefined);
  }
};

const removeIndexIfExists = async (queryInterface, tableName, fields, name) => {
  const indexes = await queryInterface.showIndex(tableName);
  const existing = indexes.find((index) => {
    if (name && index.name === name) return true;
    const indexFields = (index.fields || []).map((field) => field.attribute || field.name);
    return indexFields.length === fields.length && indexFields.every((field, idx) => field === fields[idx]);
  });
  if (existing) {
    await queryInterface.removeIndex(tableName, existing.name || fields);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = new Set(
      tables.map((table) => (typeof table === "string" ? table : table.tableName || table.name))
    );

    if (!normalizedTables.has("marketplaceSales")) {
      await queryInterface.createTable("marketplaceSales", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        orderId: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        storeId: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        storeName: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        marketplace: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        saleDate: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        sku: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        quantity: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        batchId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        approvedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        approvedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    await ensureIndex(queryInterface, "marketplaceSales", ["saleDate"], "marketplace_sales_sale_date");
    await ensureIndex(queryInterface, "marketplaceSales", ["sku"], "marketplace_sales_sku");
    await ensureIndex(queryInterface, "marketplaceSales", ["marketplace"], "marketplace_sales_marketplace");
    await ensureIndex(queryInterface, "marketplaceSales", ["storeId"], "marketplace_sales_store_id");
    await ensureIndex(queryInterface, "marketplaceSales", ["orderId"], "marketplace_sales_order_id");
    await ensureIndex(queryInterface, "marketplaceSales", ["batchId"], "marketplace_sales_batch_id");
  },

  async down(queryInterface) {
    await removeIndexIfExists(queryInterface, "marketplaceSales", ["batchId"], "marketplace_sales_batch_id");
    await removeIndexIfExists(queryInterface, "marketplaceSales", ["orderId"], "marketplace_sales_order_id");
    await removeIndexIfExists(queryInterface, "marketplaceSales", ["storeId"], "marketplace_sales_store_id");
    await removeIndexIfExists(queryInterface, "marketplaceSales", ["marketplace"], "marketplace_sales_marketplace");
    await removeIndexIfExists(queryInterface, "marketplaceSales", ["sku"], "marketplace_sales_sku");
    await removeIndexIfExists(queryInterface, "marketplaceSales", ["saleDate"], "marketplace_sales_sale_date");
    await queryInterface.dropTable("marketplaceSales");
  },
};

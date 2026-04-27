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

    if (!normalizedTables.has("salesOrders")) {
      await queryInterface.createTable("salesOrders", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        receiptNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        saleDate: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        saleCategory: {
          type: Sequelize.ENUM("customer_sale", "marketplace", "wfs", "wholesale", "other"),
          allowNull: false,
        },
        customerName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        marketplaceName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        marketplaceOther: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        wholesaleName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        wholesaleOther: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        otherCategoryLabel: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        paymentStatus: {
          type: Sequelize.ENUM("unpaid", "partial", "paid"),
          allowNull: false,
          defaultValue: "unpaid",
        },
        shipmentStatus: {
          type: Sequelize.ENUM("pending", "shipped", "delivered"),
          allowNull: false,
          defaultValue: "pending",
        },
        packingStatus: {
          type: Sequelize.ENUM("not_packed", "packing", "packed"),
          allowNull: false,
          defaultValue: "not_packed",
        },
        status: {
          type: Sequelize.ENUM("draft", "finalized", "voided"),
          allowNull: false,
          defaultValue: "draft",
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        finalizedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        finalizedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        voidedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        voidedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        voidReason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        createdBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        lastUpdatedBy: {
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

    if (!normalizedTables.has("salesOrderItems")) {
      await queryInterface.createTable("salesOrderItems", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        saleId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "salesOrders",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        sku: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        itemName: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        quantity: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        unitSoldPrice: {
          type: Sequelize.DECIMAL(10, 2),
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

    await ensureIndex(queryInterface, "salesOrders", ["status"], "sales_orders_status");
    await ensureIndex(queryInterface, "salesOrders", ["saleDate"], "sales_orders_sale_date");
    await ensureIndex(queryInterface, "salesOrders", ["saleCategory"], "sales_orders_sale_category");
    await ensureIndex(queryInterface, "salesOrders", ["receiptNumber"], "sales_orders_receipt_number");
    await ensureIndex(queryInterface, "salesOrderItems", ["saleId"], "sales_order_items_sale_id");
    await ensureIndex(queryInterface, "salesOrderItems", ["sku"], "sales_order_items_sku");
  },

  async down(queryInterface, Sequelize) {
    await removeIndexIfExists(queryInterface, "salesOrderItems", ["sku"], "sales_order_items_sku");
    await removeIndexIfExists(queryInterface, "salesOrderItems", ["saleId"], "sales_order_items_sale_id");
    await removeIndexIfExists(queryInterface, "salesOrders", ["receiptNumber"], "sales_orders_receipt_number");
    await removeIndexIfExists(queryInterface, "salesOrders", ["saleCategory"], "sales_orders_sale_category");
    await removeIndexIfExists(queryInterface, "salesOrders", ["saleDate"], "sales_orders_sale_date");
    await removeIndexIfExists(queryInterface, "salesOrders", ["status"], "sales_orders_status");

    await queryInterface.dropTable("salesOrderItems");
    await queryInterface.dropTable("salesOrders");
  },
};

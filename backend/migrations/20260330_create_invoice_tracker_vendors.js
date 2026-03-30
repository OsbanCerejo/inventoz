'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableNames = (await queryInterface.showAllTables()).map((name) =>
      String(name?.tableName || name).toLowerCase()
    );

    if (!tableNames.includes("invoicetrackervendors")) {
      await queryInterface.createTable("invoiceTrackerVendors", {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        normalizedName: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
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
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        },
      });
    }

    const vendorTableIndexes = await queryInterface.showIndex("invoiceTrackerVendors");
    if (!vendorTableIndexes.some((index) => index.name === "invoice_tracker_vendors_name")) {
      await queryInterface.addIndex("invoiceTrackerVendors", ["name"], {
        name: "invoice_tracker_vendors_name",
      });
    }
    if (!vendorTableIndexes.some((index) => index.name === "invoice_tracker_vendors_normalized_name")) {
      await queryInterface.addIndex("invoiceTrackerVendors", ["normalizedName"], {
        name: "invoice_tracker_vendors_normalized_name",
        unique: true,
      });
    }

    const invoiceColumns = await queryInterface.describeTable("invoiceTrackerInvoices");
    if (!invoiceColumns.vendorId) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "vendorId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "invoiceTrackerVendors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        after: "vendorName",
      });
    }

    const invoiceIndexes = await queryInterface.showIndex("invoiceTrackerInvoices");
    if (!invoiceIndexes.some((index) => index.name === "invoice_tracker_invoices_vendor_id")) {
      await queryInterface.addIndex("invoiceTrackerInvoices", ["vendorId"], {
        name: "invoice_tracker_invoices_vendor_id",
      });
    }

    await queryInterface.sequelize.query(`
      INSERT INTO invoiceTrackerVendors (name, normalizedName, createdAt, updatedAt)
      SELECT DISTINCT
        normalized.vendor_name,
        normalized.normalized_name,
        NOW(),
        NOW()
      FROM (
        SELECT
          TRIM(vendorName) AS vendor_name,
          LOWER(TRIM(CONVERT(vendorName USING utf8mb4))) COLLATE utf8mb4_unicode_ci AS normalized_name
        FROM invoiceTrackerInvoices
        WHERE vendorName IS NOT NULL
          AND TRIM(vendorName) <> ''
      ) normalized
      LEFT JOIN invoiceTrackerVendors v
        ON normalized.normalized_name = v.normalizedName COLLATE utf8mb4_unicode_ci
      WHERE v.id IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE invoiceTrackerInvoices i
      JOIN invoiceTrackerVendors v
        ON LOWER(TRIM(CONVERT(i.vendorName USING utf8mb4))) COLLATE utf8mb4_unicode_ci =
           v.normalizedName COLLATE utf8mb4_unicode_ci
      SET i.vendorId = v.id
      WHERE i.vendorName IS NOT NULL
        AND TRIM(i.vendorName) <> ''
        AND i.vendorId IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("invoiceTrackerInvoices", "invoice_tracker_invoices_vendor_id");
    await queryInterface.removeColumn("invoiceTrackerInvoices", "vendorId");
    await queryInterface.removeIndex("invoiceTrackerVendors", "invoice_tracker_vendors_normalized_name");
    await queryInterface.removeIndex("invoiceTrackerVendors", "invoice_tracker_vendors_name");
    await queryInterface.dropTable("invoiceTrackerVendors");
  },
};

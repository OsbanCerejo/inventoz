"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("invoiceTrackerInvoices", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      vendorName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      invoiceNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      orderDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      shipmentStatus: {
        type: Sequelize.ENUM("order_placed", "shipped", "received"),
        allowNull: false,
        defaultValue: "order_placed",
      },
      itemCheckStatus: {
        type: Sequelize.ENUM("not_checked", "working_on_it", "verified", "missing_items"),
        allowNull: false,
        defaultValue: "not_checked",
      },
      inboundStatus: {
        type: Sequelize.ENUM("pending", "done"),
        allowNull: false,
        defaultValue: "pending",
      },
      paymentStatus: {
        type: Sequelize.ENUM("paid", "unpaid", "credit"),
        allowNull: false,
        defaultValue: "unpaid",
      },
      paymentDueBy: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      miscellaneousAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      shippingAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      receivedDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      paymentDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      isArchived: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      archivedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      archivedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      notes: {
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

    await queryInterface.addIndex("invoiceTrackerInvoices", ["vendorName"], {
      name: "invoice_tracker_invoices_vendor_name",
    });
    await queryInterface.addIndex("invoiceTrackerInvoices", ["invoiceNumber"], {
      name: "invoice_tracker_invoices_invoice_number",
    });
    await queryInterface.addIndex("invoiceTrackerInvoices", ["orderDate"], {
      name: "invoice_tracker_invoices_order_date",
    });

    await queryInterface.createTable("invoiceTrackerInvoiceItems", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      invoiceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "invoiceTrackerInvoices",
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
      unitPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
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

    await queryInterface.addIndex("invoiceTrackerInvoiceItems", ["invoiceId"], {
      name: "invoice_tracker_items_invoice_id",
    });
    await queryInterface.addIndex("invoiceTrackerInvoiceItems", ["sku"], {
      name: "invoice_tracker_items_sku",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("invoiceTrackerInvoiceItems");
    await queryInterface.dropTable("invoiceTrackerInvoices");
  },
};

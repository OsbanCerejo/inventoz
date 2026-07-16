'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("invoiceTrackerPartialPayments")) {
      await queryInterface.createTable("invoiceTrackerPartialPayments", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        invoiceId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "invoiceTrackerInvoices", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        paymentDate: { type: Sequelize.DATEONLY, allowNull: false },
        notes: { type: Sequelize.TEXT, allowNull: true },
        createdBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
        deletedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex("invoiceTrackerPartialPayments", ["invoiceId"], {
        name: "itpp_invoice_id",
      });
    }

    // Seed existing partial invoices — each gets one payment log entry for the existing amount
    const [invoices] = await queryInterface.sequelize.query(
      `SELECT id, partialPaymentAmount, paymentDueBy, createdBy
       FROM invoiceTrackerInvoices
       WHERE paymentStatus = 'partial'
         AND partialPaymentAmount IS NOT NULL
         AND CAST(partialPaymentAmount AS DECIMAL(10,2)) > 0`
    );

    for (const invoice of invoices) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM invoiceTrackerPartialPayments WHERE invoiceId = ? LIMIT 1`,
        { replacements: [invoice.id] }
      );
      if (!existing || existing.length === 0) {
        const paymentDate = invoice.paymentDueBy || new Date().toISOString().slice(0, 10);
        await queryInterface.sequelize.query(
          `INSERT INTO invoiceTrackerPartialPayments (invoiceId, amount, paymentDate, notes, createdBy, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          {
            replacements: [
              invoice.id,
              invoice.partialPaymentAmount,
              paymentDate,
              "Migrated from existing partial payment",
              invoice.createdBy || null,
            ],
          }
        );
      }
    }
  },

  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("invoiceTrackerPartialPayments")) {
      await queryInterface.dropTable("invoiceTrackerPartialPayments");
    }
  },
};

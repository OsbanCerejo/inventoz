module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("invoiceTrackerPaymentProofs").catch(() => null);
    if (!table) {
      await queryInterface.createTable("invoiceTrackerPaymentProofs", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
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
        filePath: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        originalName: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        mimeType: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        uploadedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        uploadedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });
      await queryInterface.addIndex("invoiceTrackerPaymentProofs", ["invoiceId"], {
        name: "invoice_tracker_payment_proofs_invoice_id",
      });
      await queryInterface.addIndex("invoiceTrackerPaymentProofs", ["uploadedBy"], {
        name: "invoice_tracker_payment_proofs_uploaded_by",
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("invoiceTrackerPaymentProofs").catch(() => null);
    if (table) {
      await queryInterface.dropTable("invoiceTrackerPaymentProofs");
    }
  },
};

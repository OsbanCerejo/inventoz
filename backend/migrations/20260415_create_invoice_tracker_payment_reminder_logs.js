"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((entry) => (typeof entry === "string" ? entry : entry.tableName || entry.TABLE_NAME));

    if (!normalizedTables.includes("invoiceTrackerPaymentReminderLogs")) {
      await queryInterface.createTable("invoiceTrackerPaymentReminderLogs", {
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
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        },
        recipientEmail: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        reminderType: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        triggerDate: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        daysOffset: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        triggerSource: {
          type: Sequelize.ENUM("manual", "automatic"),
          allowNull: false,
        },
        status: {
          type: Sequelize.ENUM("sent", "failed"),
          allowNull: false,
        },
        sentAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        errorMessage: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        initiatedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "Users",
            key: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
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

      await queryInterface.addIndex("invoiceTrackerPaymentReminderLogs", ["invoiceId"], {
        name: "invoice_tracker_payment_reminder_logs_invoice_id",
      });
      await queryInterface.addIndex("invoiceTrackerPaymentReminderLogs", ["triggerDate"], {
        name: "invoice_tracker_payment_reminder_logs_trigger_date",
      });
      await queryInterface.addIndex("invoiceTrackerPaymentReminderLogs", ["triggerSource"], {
        name: "invoice_tracker_payment_reminder_logs_trigger_source",
      });
      await queryInterface.addIndex("invoiceTrackerPaymentReminderLogs", ["recipientEmail"], {
        name: "invoice_tracker_payment_reminder_logs_recipient_email",
      });
      await queryInterface.addIndex(
        "invoiceTrackerPaymentReminderLogs",
        ["invoiceId", "reminderType", "triggerDate", "recipientEmail", "triggerSource"],
        {
          name: "invoice_tracker_payment_reminder_logs_lookup",
        }
      );
    }
  },

  async down(queryInterface) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((entry) => (typeof entry === "string" ? entry : entry.tableName || entry.TABLE_NAME));

    if (normalizedTables.includes("invoiceTrackerPaymentReminderLogs")) {
      await queryInterface.dropTable("invoiceTrackerPaymentReminderLogs");
    }
  },
};

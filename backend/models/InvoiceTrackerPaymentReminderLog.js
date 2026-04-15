module.exports = (sequelize, DataTypes) => {
  const InvoiceTrackerPaymentReminderLog = sequelize.define(
    "InvoiceTrackerPaymentReminderLog",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      invoiceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      recipientEmail: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      reminderType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      triggerDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      daysOffset: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      triggerSource: {
        type: DataTypes.ENUM("manual", "automatic"),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("sent", "failed"),
        allowNull: false,
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      initiatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "invoiceTrackerPaymentReminderLogs",
      timestamps: true,
    }
  );

  InvoiceTrackerPaymentReminderLog.associate = (models) => {
    InvoiceTrackerPaymentReminderLog.belongsTo(models.InvoiceTrackerInvoice, {
      foreignKey: "invoiceId",
      as: "invoice",
    });
    InvoiceTrackerPaymentReminderLog.belongsTo(models.User, {
      foreignKey: "initiatedBy",
      as: "initiator",
    });
  };

  return InvoiceTrackerPaymentReminderLog;
};

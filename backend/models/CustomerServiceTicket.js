module.exports = (sequelize, DataTypes) => {
  const CustomerServiceTicket = sequelize.define(
    "CustomerServiceTicket",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      ticketNumber: { type: DataTypes.STRING(20), allowNull: true, unique: true },
      platform: { type: DataTypes.ENUM("whatnot", "tiktok"), allowNull: false },
      username: { type: DataTypes.STRING, allowNull: false },
      orderNumber: { type: DataTypes.STRING, allowNull: false },
      issueCategory: {
        type: DataTypes.ENUM(
          "missing_item", "wrong_item", "damaged_item",
          "package_not_received", "return_refund_request",
          "complaint", "address_issue", "general_question", "other"
        ),
        allowNull: false,
      },
      priority: { type: DataTypes.ENUM("normal", "high", "urgent"), allowNull: false, defaultValue: "normal" },
      status: {
        type: DataTypes.ENUM("open", "assigned", "in_progress", "waiting_on_customer", "waiting_on_internal_team", "resolved"),
        allowNull: false,
        defaultValue: "open",
      },
      assignedTo: { type: DataTypes.INTEGER, allowNull: true },
      dueAt: { type: DataTypes.DATE, allowNull: true },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
      isArchived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      archivedAt: { type: DataTypes.DATE, allowNull: true },
      archivedBy: { type: DataTypes.INTEGER, allowNull: true },
      archiveReason: { type: DataTypes.TEXT, allowNull: true },
      overdueSentAt: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
      lastUpdatedBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: "customerServiceTickets",
      timestamps: true,
    }
  );

  CustomerServiceTicket.associate = (models) => {
    CustomerServiceTicket.hasMany(models.CustomerServiceTicketNote, {
      foreignKey: "ticketId", as: "notes", onDelete: "CASCADE",
    });
    CustomerServiceTicket.hasMany(models.CustomerServiceTicketActivity, {
      foreignKey: "ticketId", as: "activities", onDelete: "CASCADE",
    });
    CustomerServiceTicket.hasMany(models.CustomerServiceNotification, {
      foreignKey: "ticketId", as: "notifications", onDelete: "CASCADE",
    });
    CustomerServiceTicket.belongsTo(models.User, { foreignKey: "createdBy", as: "creator" });
    CustomerServiceTicket.belongsTo(models.User, { foreignKey: "assignedTo", as: "assignee" });
    CustomerServiceTicket.belongsTo(models.User, { foreignKey: "lastUpdatedBy", as: "updater" });
    CustomerServiceTicket.belongsTo(models.User, { foreignKey: "archivedBy", as: "archiver" });
  };

  return CustomerServiceTicket;
};

module.exports = (sequelize, DataTypes) => {
  const CustomerServiceNotification = sequelize.define(
    "CustomerServiceNotification",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      ticketId: { type: DataTypes.INTEGER, allowNull: false },
      recipientUserId: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM("assigned", "overdue", "note_added", "resolved", "archived"),
        allowNull: false,
      },
      message: { type: DataTypes.TEXT, allowNull: false },
      isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      readAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "customerServiceNotifications",
      timestamps: true,
    }
  );

  CustomerServiceNotification.associate = (models) => {
    CustomerServiceNotification.belongsTo(models.CustomerServiceTicket, { foreignKey: "ticketId", as: "ticket" });
    CustomerServiceNotification.belongsTo(models.User, { foreignKey: "recipientUserId", as: "recipient" });
  };

  return CustomerServiceNotification;
};

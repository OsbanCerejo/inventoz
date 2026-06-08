module.exports = (sequelize, DataTypes) => {
  const CustomerServiceTicketActivity = sequelize.define(
    "CustomerServiceTicketActivity",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      ticketId: { type: DataTypes.INTEGER, allowNull: false },
      actionType: {
        type: DataTypes.ENUM(
          "created", "assigned", "reassigned", "status_changed",
          "priority_changed", "note_added", "due_date_changed",
          "resolved", "archived", "cancelled"
        ),
        allowNull: false,
      },
      fromValue: { type: DataTypes.STRING, allowNull: true },
      toValue: { type: DataTypes.STRING, allowNull: true },
      details: { type: DataTypes.TEXT, allowNull: true },
      performedBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: "customerServiceTicketActivities",
      timestamps: true,
      updatedAt: false,
    }
  );

  CustomerServiceTicketActivity.associate = (models) => {
    CustomerServiceTicketActivity.belongsTo(models.CustomerServiceTicket, { foreignKey: "ticketId" });
    CustomerServiceTicketActivity.belongsTo(models.User, { foreignKey: "performedBy", as: "actor" });
  };

  return CustomerServiceTicketActivity;
};

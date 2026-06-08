module.exports = (sequelize, DataTypes) => {
  const CustomerServiceTicketNote = sequelize.define(
    "CustomerServiceTicketNote",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      ticketId: { type: DataTypes.INTEGER, allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: false },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: "customerServiceTicketNotes",
      timestamps: true,
    }
  );

  CustomerServiceTicketNote.associate = (models) => {
    CustomerServiceTicketNote.belongsTo(models.CustomerServiceTicket, { foreignKey: "ticketId" });
    CustomerServiceTicketNote.belongsTo(models.User, { foreignKey: "createdBy", as: "author" });
  };

  return CustomerServiceTicketNote;
};

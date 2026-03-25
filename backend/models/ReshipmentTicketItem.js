module.exports = (sequelize, DataTypes) => {
  const ReshipmentTicketItem = sequelize.define(
    "ReshipmentTicketItem",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      itemName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      notes: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "reshipmentTicketItems",
      timestamps: true,
    }
  );

  ReshipmentTicketItem.associate = (models) => {
    ReshipmentTicketItem.belongsTo(models.ReshipmentTicket, {
      foreignKey: "ticketId",
      as: "ticket",
    });
  };

  return ReshipmentTicketItem;
};

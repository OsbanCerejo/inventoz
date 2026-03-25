module.exports = (sequelize, DataTypes) => {
  const ReshipmentTicketActivity = sequelize.define(
    "ReshipmentTicketActivity",
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
      actionType: {
        type: DataTypes.ENUM("created", "updated", "status_changed", "comment"),
        allowNull: false,
      },
      fromStatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      toStatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "reshipmentTicketActivities",
      timestamps: true,
      updatedAt: false,
    }
  );

  ReshipmentTicketActivity.associate = (models) => {
    ReshipmentTicketActivity.belongsTo(models.ReshipmentTicket, {
      foreignKey: "ticketId",
      as: "ticket",
    });
    ReshipmentTicketActivity.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "actor",
    });
  };

  return ReshipmentTicketActivity;
};

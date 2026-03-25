module.exports = (sequelize, DataTypes) => {
  const ReshipmentTicket = sequelize.define(
    "ReshipmentTicket",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ticketNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM(
          "new",
          "acknowledged",
          "ready_to_ship",
          "waiting_on_item",
          "done"
        ),
        allowNull: false,
        defaultValue: "new",
      },
      priority: {
        type: DataTypes.ENUM("normal", "high", "urgent"),
        allowNull: false,
        defaultValue: "normal",
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      orderId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      trackingNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shippingAddress: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      needsReturnLabel: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      assignedTo: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      lastUpdatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      closedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      isArchived: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      archivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      archivedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "reshipmentTickets",
      timestamps: true,
    }
  );

  ReshipmentTicket.associate = (models) => {
    ReshipmentTicket.hasMany(models.ReshipmentTicketItem, {
      foreignKey: "ticketId",
      as: "items",
      onDelete: "CASCADE",
    });
    ReshipmentTicket.hasMany(models.ReshipmentTicketActivity, {
      foreignKey: "ticketId",
      as: "activities",
      onDelete: "CASCADE",
    });
    ReshipmentTicket.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
    ReshipmentTicket.belongsTo(models.User, {
      foreignKey: "assignedTo",
      as: "assignee",
    });
    ReshipmentTicket.belongsTo(models.User, {
      foreignKey: "lastUpdatedBy",
      as: "updater",
    });
    ReshipmentTicket.belongsTo(models.User, {
      foreignKey: "archivedBy",
      as: "archiver",
    });
  };

  return ReshipmentTicket;
};

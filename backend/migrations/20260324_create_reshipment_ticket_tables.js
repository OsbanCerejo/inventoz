"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("reshipmentTickets", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      ticketNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM(
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
        type: Sequelize.ENUM("normal", "high", "urgent"),
        allowNull: false,
        defaultValue: "normal",
      },
      reason: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      orderId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      shippingAddress: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      needsReturnLabel: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      assignedTo: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      lastUpdatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      closedAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex("reshipmentTickets", ["ticketNumber"], {
      unique: true,
      name: "idx_reship_ticket_number",
    });
    await queryInterface.addIndex("reshipmentTickets", ["status"], {
      name: "idx_reship_ticket_status",
    });
    await queryInterface.addIndex("reshipmentTickets", ["orderId"], {
      name: "idx_reship_ticket_order_id",
    });
    await queryInterface.addIndex("reshipmentTickets", ["username"], {
      name: "idx_reship_ticket_username",
    });
    await queryInterface.addIndex("reshipmentTickets", ["createdAt"], {
      name: "idx_reship_ticket_created_at",
    });

    await queryInterface.createTable("reshipmentTicketItems", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      ticketId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      sku: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      itemName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      notes: {
        type: Sequelize.STRING,
        allowNull: true,
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

    await queryInterface.addConstraint("reshipmentTicketItems", {
      fields: ["ticketId"],
      type: "foreign key",
      name: "fk_reship_ticket_item_ticket_id",
      references: {
        table: "reshipmentTickets",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await queryInterface.addIndex("reshipmentTicketItems", ["ticketId"], {
      name: "idx_reship_ticket_item_ticket_id",
    });

    await queryInterface.createTable("reshipmentTicketActivities", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      ticketId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      actionType: {
        type: Sequelize.ENUM("created", "updated", "status_changed", "comment"),
        allowNull: false,
      },
      fromStatus: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      toStatus: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addConstraint("reshipmentTicketActivities", {
      fields: ["ticketId"],
      type: "foreign key",
      name: "fk_reship_ticket_activity_ticket_id",
      references: {
        table: "reshipmentTickets",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await queryInterface.addIndex("reshipmentTicketActivities", ["ticketId", "createdAt"], {
      name: "idx_reship_ticket_activity_ticket_id_created_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("reshipmentTicketActivities");
    await queryInterface.dropTable("reshipmentTicketItems");
    await queryInterface.dropTable("reshipmentTickets");
  },
};

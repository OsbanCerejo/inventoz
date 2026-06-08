"use strict";

const PERMISSIONS = [
  { key: "customerService.view", scopeType: "resource_action", resource: "customerService", action: "view", menuKey: null, label: "Customer Service view" },
  { key: "customerService.create", scopeType: "resource_action", resource: "customerService", action: "create", menuKey: null, label: "Customer Service create" },
  { key: "customerService.edit", scopeType: "resource_action", resource: "customerService", action: "edit", menuKey: null, label: "Customer Service edit" },
  { key: "customerService.assign", scopeType: "resource_action", resource: "customerService", action: "assign", menuKey: null, label: "Customer Service assign" },
  { key: "customerService.resolve", scopeType: "resource_action", resource: "customerService", action: "resolve", menuKey: null, label: "Customer Service resolve" },
  { key: "customerService.archive", scopeType: "resource_action", resource: "customerService", action: "archive", menuKey: null, label: "Customer Service archive" },
  { key: "menu.customerService", scopeType: "menu", resource: null, action: null, menuKey: "customerService", label: "menu customerService" },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    // --- customerServiceTickets ---
    await queryInterface.createTable("customerServiceTickets", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      ticketNumber: { type: Sequelize.STRING(20), allowNull: true, unique: true },
      platform: { type: Sequelize.ENUM("whatnot", "tiktok"), allowNull: false },
      username: { type: Sequelize.STRING, allowNull: false },
      orderNumber: { type: Sequelize.STRING, allowNull: false },
      issueCategory: {
        type: Sequelize.ENUM(
          "missing_item", "wrong_item", "damaged_item",
          "package_not_received", "return_refund_request",
          "complaint", "address_issue", "general_question", "other"
        ),
        allowNull: false,
      },
      priority: { type: Sequelize.ENUM("normal", "high", "urgent"), allowNull: false, defaultValue: "normal" },
      status: {
        type: Sequelize.ENUM("open", "assigned", "in_progress", "waiting_on_customer", "waiting_on_internal_team", "resolved"),
        allowNull: false,
        defaultValue: "open",
      },
      assignedTo: { type: Sequelize.INTEGER, allowNull: true },
      dueAt: { type: Sequelize.DATE, allowNull: true },
      resolvedAt: { type: Sequelize.DATE, allowNull: true },
      isArchived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      archivedAt: { type: Sequelize.DATE, allowNull: true },
      archivedBy: { type: Sequelize.INTEGER, allowNull: true },
      archiveReason: { type: Sequelize.TEXT, allowNull: true },
      overdueSentAt: { type: Sequelize.DATE, allowNull: true },
      createdBy: { type: Sequelize.INTEGER, allowNull: true },
      lastUpdatedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("customerServiceTickets", ["status"], { name: "idx_cs_ticket_status" });
    await queryInterface.addIndex("customerServiceTickets", ["priority"], { name: "idx_cs_ticket_priority" });
    await queryInterface.addIndex("customerServiceTickets", ["assignedTo"], { name: "idx_cs_ticket_assigned_to" });
    await queryInterface.addIndex("customerServiceTickets", ["createdBy"], { name: "idx_cs_ticket_created_by" });
    await queryInterface.addIndex("customerServiceTickets", ["dueAt"], { name: "idx_cs_ticket_due_at" });
    await queryInterface.addIndex("customerServiceTickets", ["platform"], { name: "idx_cs_ticket_platform" });
    await queryInterface.addIndex("customerServiceTickets", ["isArchived"], { name: "idx_cs_ticket_is_archived" });
    await queryInterface.addIndex("customerServiceTickets", ["resolvedAt"], { name: "idx_cs_ticket_resolved_at" });
    await queryInterface.addIndex("customerServiceTickets", ["createdAt"], { name: "idx_cs_ticket_created_at" });

    // --- customerServiceTicketNotes ---
    await queryInterface.createTable("customerServiceTicketNotes", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      ticketId: { type: Sequelize.INTEGER, allowNull: false },
      note: { type: Sequelize.TEXT, allowNull: false },
      createdBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP") },
    });

    await queryInterface.addConstraint("customerServiceTicketNotes", {
      fields: ["ticketId"], type: "foreign key",
      name: "fk_cs_note_ticket_id",
      references: { table: "customerServiceTickets", field: "id" },
      onUpdate: "CASCADE", onDelete: "CASCADE",
    });
    await queryInterface.addIndex("customerServiceTicketNotes", ["ticketId"], { name: "idx_cs_note_ticket_id" });

    // --- customerServiceTicketActivities ---
    await queryInterface.createTable("customerServiceTicketActivities", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      ticketId: { type: Sequelize.INTEGER, allowNull: false },
      actionType: {
        type: Sequelize.ENUM(
          "created", "assigned", "reassigned", "status_changed",
          "priority_changed", "note_added", "due_date_changed",
          "resolved", "archived", "cancelled"
        ),
        allowNull: false,
      },
      fromValue: { type: Sequelize.STRING, allowNull: true },
      toValue: { type: Sequelize.STRING, allowNull: true },
      details: { type: Sequelize.TEXT, allowNull: true },
      performedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addConstraint("customerServiceTicketActivities", {
      fields: ["ticketId"], type: "foreign key",
      name: "fk_cs_activity_ticket_id",
      references: { table: "customerServiceTickets", field: "id" },
      onUpdate: "CASCADE", onDelete: "CASCADE",
    });
    await queryInterface.addIndex("customerServiceTicketActivities", ["ticketId", "createdAt"], { name: "idx_cs_activity_ticket_id_created_at" });

    // --- customerServiceNotifications ---
    await queryInterface.createTable("customerServiceNotifications", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      ticketId: { type: Sequelize.INTEGER, allowNull: false },
      recipientUserId: { type: Sequelize.INTEGER, allowNull: false },
      type: {
        type: Sequelize.ENUM("assigned", "overdue", "note_added", "resolved", "archived"),
        allowNull: false,
      },
      message: { type: Sequelize.TEXT, allowNull: false },
      isRead: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      readAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP") },
    });

    await queryInterface.addConstraint("customerServiceNotifications", {
      fields: ["ticketId"], type: "foreign key",
      name: "fk_cs_notification_ticket_id",
      references: { table: "customerServiceTickets", field: "id" },
      onUpdate: "CASCADE", onDelete: "CASCADE",
    });
    await queryInterface.addIndex("customerServiceNotifications", ["recipientUserId", "isRead"], { name: "idx_cs_notification_recipient_read" });
    await queryInterface.addIndex("customerServiceNotifications", ["ticketId"], { name: "idx_cs_notification_ticket_id" });

    // --- User notification settings columns ---
    await queryInterface.addColumn("Users", "customerServiceNotificationEmail", {
      type: Sequelize.STRING, allowNull: true, defaultValue: null,
    });
    await queryInterface.addColumn("Users", "customerServiceEmailNotificationsEnabled", {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true,
    });

    // --- Permissions ---
    const now = new Date();
    const keys = PERMISSIONS.map((p) => p.key);
    const [existingRows] = await queryInterface.sequelize.query(
      `SELECT \`key\` FROM \`Permissions\` WHERE \`key\` IN (${keys.map(() => "?").join(", ")})`,
      { replacements: keys }
    );
    const existingKeys = new Set((existingRows || []).map((r) => r.key));
    const toInsert = PERMISSIONS.filter((p) => !existingKeys.has(p.key)).map((p) => ({ ...p, createdAt: now, updatedAt: now }));
    if (toInsert.length > 0) {
      await queryInterface.bulkInsert("Permissions", toInsert);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Users", "customerServiceEmailNotificationsEnabled");
    await queryInterface.removeColumn("Users", "customerServiceNotificationEmail");
    await queryInterface.dropTable("customerServiceNotifications");
    await queryInterface.dropTable("customerServiceTicketActivities");
    await queryInterface.dropTable("customerServiceTicketNotes");
    await queryInterface.dropTable("customerServiceTickets");
    const keys = PERMISSIONS.map((p) => p.key);
    const [permissions] = await queryInterface.sequelize.query(
      `SELECT id FROM \`Permissions\` WHERE \`key\` IN (${keys.map(() => "?").join(", ")})`,
      { replacements: keys }
    );
    const ids = (permissions || []).map((r) => r.id);
    if (ids.length > 0) {
      await queryInterface.bulkDelete("UserPermissions", { permissionId: ids });
      await queryInterface.bulkDelete("Permissions", { key: keys });
    }
  },
};

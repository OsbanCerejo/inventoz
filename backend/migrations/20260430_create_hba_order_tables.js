module.exports = {
  up: async (queryInterface, Sequelize) => {
    const normalizedTables = (await queryInterface.showAllTables()).map((entry) =>
      typeof entry === "string" ? entry : entry.tableName || entry.TABLE_NAME || Object.values(entry)[0]
    );

    if (!normalizedTables.includes("hbaOrders")) {
      await queryInterface.createTable("hbaOrders", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        orderNumber: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        customerName: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        companyName: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        addressLine1: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        addressLine2: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        city: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        state: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        zipCode: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        country: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        phone: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        salesPerson: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "new",
        },
        internalNotes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        reviewedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        reviewedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        totalSkus: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        totalUnits: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        totalPrice: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },
        submittedIp: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        userAgent: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        notificationStatus: {
          type: Sequelize.ENUM("pending", "sent", "failed"),
          allowNull: false,
          defaultValue: "pending",
        },
        notificationSentAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        notificationRecipients: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        notificationError: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        customerNotificationStatus: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "skipped",
        },
        customerNotificationSentAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        customerNotificationError: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    if (!normalizedTables.includes("hbaOrderItems")) {
      await queryInterface.createTable("hbaOrderItems", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        orderId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "hbaOrders",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        sku: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        upc: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        brand: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        itemName: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        quantity: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        unitPrice: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },
        subtotal: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }
  },

  down: async (queryInterface) => {
    const normalizedTables = (await queryInterface.showAllTables()).map((entry) =>
      typeof entry === "string" ? entry : entry.tableName || entry.TABLE_NAME || Object.values(entry)[0]
    );

    if (normalizedTables.includes("hbaOrderItems")) {
      await queryInterface.dropTable("hbaOrderItems");
    }

    if (normalizedTables.includes("hbaOrders")) {
      await queryInterface.dropTable("hbaOrders");
    }
  },
};

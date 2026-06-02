module.exports = {
  up: async (queryInterface, Sequelize) => {
    const normalizedTables = (await queryInterface.showAllTables()).map((entry) =>
      typeof entry === "string" ? entry : entry.tableName || entry.TABLE_NAME || Object.values(entry)[0]
    );

    if (!normalizedTables.includes("hbaVisitorSessions")) {
      await queryInterface.createTable("hbaVisitorSessions", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        sessionId: { type: Sequelize.STRING, allowNull: false, unique: true },
        visitorId: { type: Sequelize.STRING, allowNull: false },
        firstSeenAt: { type: Sequelize.DATE, allowNull: false },
        lastSeenAt: { type: Sequelize.DATE, allowNull: false },
        ipAddress: { type: Sequelize.STRING, allowNull: true },
        userAgent: { type: Sequelize.TEXT, allowNull: true },
        deviceType: { type: Sequelize.STRING, allowNull: true },
        browser: { type: Sequelize.STRING, allowNull: true },
        os: { type: Sequelize.STRING, allowNull: true },
        screenWidth: { type: Sequelize.INTEGER, allowNull: true },
        screenHeight: { type: Sequelize.INTEGER, allowNull: true },
        referrer: { type: Sequelize.TEXT, allowNull: true },
        landingPage: { type: Sequelize.TEXT, allowNull: true },
        country: { type: Sequelize.STRING, allowNull: true },
        region: { type: Sequelize.STRING, allowNull: true },
        city: { type: Sequelize.STRING, allowNull: true },
        geoSource: { type: Sequelize.STRING, allowNull: true },
        orderSubmittedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex("hbaVisitorSessions", ["visitorId"]);
      await queryInterface.addIndex("hbaVisitorSessions", ["lastSeenAt"]);
      await queryInterface.addIndex("hbaVisitorSessions", ["country", "region", "city"]);
    }

    if (!normalizedTables.includes("hbaTrackingEvents")) {
      await queryInterface.createTable("hbaTrackingEvents", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        sessionId: { type: Sequelize.STRING, allowNull: false },
        visitorId: { type: Sequelize.STRING, allowNull: false },
        eventType: { type: Sequelize.STRING, allowNull: false },
        sku: { type: Sequelize.STRING, allowNull: true },
        brand: { type: Sequelize.STRING, allowNull: true },
        itemName: { type: Sequelize.STRING, allowNull: true },
        quantity: { type: Sequelize.INTEGER, allowNull: true },
        searchTerm: { type: Sequelize.STRING, allowNull: true },
        cartSkus: { type: Sequelize.INTEGER, allowNull: true },
        cartUnits: { type: Sequelize.INTEGER, allowNull: true },
        cartTotal: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        metadata: { type: Sequelize.JSON, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex("hbaTrackingEvents", ["createdAt"]);
      await queryInterface.addIndex("hbaTrackingEvents", ["eventType"]);
      await queryInterface.addIndex("hbaTrackingEvents", ["sessionId"]);
      await queryInterface.addIndex("hbaTrackingEvents", ["sku"]);
    }

    if (!normalizedTables.includes("hbaCartSnapshots")) {
      await queryInterface.createTable("hbaCartSnapshots", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        sessionId: { type: Sequelize.STRING, allowNull: false, unique: true },
        visitorId: { type: Sequelize.STRING, allowNull: false },
        items: { type: Sequelize.JSON, allowNull: false },
        totalSkus: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        totalUnits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        totalPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        lastEventType: { type: Sequelize.STRING, allowNull: true },
        hasSubmittedOrder: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        lastUpdatedAt: { type: Sequelize.DATE, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex("hbaCartSnapshots", ["lastUpdatedAt"]);
      await queryInterface.addIndex("hbaCartSnapshots", ["hasSubmittedOrder"]);
    }
  },

  down: async (queryInterface) => {
    const normalizedTables = (await queryInterface.showAllTables()).map((entry) =>
      typeof entry === "string" ? entry : entry.tableName || entry.TABLE_NAME || Object.values(entry)[0]
    );

    if (normalizedTables.includes("hbaCartSnapshots")) {
      await queryInterface.dropTable("hbaCartSnapshots");
    }
    if (normalizedTables.includes("hbaTrackingEvents")) {
      await queryInterface.dropTable("hbaTrackingEvents");
    }
    if (normalizedTables.includes("hbaVisitorSessions")) {
      await queryInterface.dropTable("hbaVisitorSessions");
    }
  },
};

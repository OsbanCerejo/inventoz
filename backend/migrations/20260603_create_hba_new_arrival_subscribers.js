module.exports = {
  up: async (queryInterface, Sequelize) => {
    const normalizedTables = (await queryInterface.showAllTables()).map((entry) =>
      typeof entry === "string" ? entry : entry.tableName || entry.TABLE_NAME || Object.values(entry)[0]
    );

    if (!normalizedTables.includes("hbaNewArrivalSubscribers")) {
      await queryInterface.createTable("hbaNewArrivalSubscribers", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "active",
        },
        source: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "hba-site",
        },
        ipAddress: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        userAgent: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        subscribedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        unsubscribedAt: {
          type: Sequelize.DATE,
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
      await queryInterface.addIndex("hbaNewArrivalSubscribers", ["status"]);
      await queryInterface.addIndex("hbaNewArrivalSubscribers", ["subscribedAt"]);
    }
  },

  down: async (queryInterface) => {
    const normalizedTables = (await queryInterface.showAllTables()).map((entry) =>
      typeof entry === "string" ? entry : entry.tableName || entry.TABLE_NAME || Object.values(entry)[0]
    );

    if (normalizedTables.includes("hbaNewArrivalSubscribers")) {
      await queryInterface.dropTable("hbaNewArrivalSubscribers");
    }
  },
};

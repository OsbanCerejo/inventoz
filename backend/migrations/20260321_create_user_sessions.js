"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("UserSessions", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      sessionId: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      ipAddress: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      deviceName: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      geoCountry: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      geoRegion: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      geoCity: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      geoLat: {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: true,
      },
      geoLng: {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: true,
      },
      geoSource: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      loginAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      lastSeenAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      logoutAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex("UserSessions", ["userId"], {
      name: "user_sessions_user_id",
    });
    await queryInterface.addIndex("UserSessions", ["isActive"], {
      name: "user_sessions_is_active",
    });
    await queryInterface.addIndex("UserSessions", ["lastSeenAt"], {
      name: "user_sessions_last_seen_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("UserSessions");
  },
};


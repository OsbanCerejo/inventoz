module.exports = (sequelize, DataTypes) => {
  const HbaVisitorSession = sequelize.define(
    "HbaVisitorSession",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sessionId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      visitorId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      firstSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      deviceType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      browser: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      os: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      screenWidth: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      screenHeight: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      referrer: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      landingPage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      region: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      geoSource: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      orderSubmittedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "hbaVisitorSessions",
      timestamps: true,
    }
  );

  HbaVisitorSession.associate = (models) => {
    HbaVisitorSession.hasMany(models.HbaTrackingEvent, {
      foreignKey: "sessionId",
      sourceKey: "sessionId",
      as: "events",
    });
    HbaVisitorSession.hasOne(models.HbaCartSnapshot, {
      foreignKey: "sessionId",
      sourceKey: "sessionId",
      as: "cartSnapshot",
    });
  };

  return HbaVisitorSession;
};

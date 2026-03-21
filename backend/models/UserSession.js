module.exports = (sequelize, DataTypes) => {
  const UserSession = sequelize.define(
    "UserSession",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sessionId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      ipAddress: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      deviceName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      geoCountry: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      geoRegion: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      geoCity: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      geoLat: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: true,
      },
      geoLng: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: true,
      },
      geoSource: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      loginAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      logoutAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "UserSessions",
    }
  );

  UserSession.associate = (models) => {
    UserSession.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return UserSession;
};


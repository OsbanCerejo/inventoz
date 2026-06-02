module.exports = (sequelize, DataTypes) => {
  const HbaTrackingEvent = sequelize.define(
    "HbaTrackingEvent",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sessionId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      visitorId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      eventType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      brand: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      itemName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      searchTerm: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      cartSkus: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      cartUnits: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      cartTotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "hbaTrackingEvents",
      timestamps: true,
      updatedAt: false,
    }
  );

  HbaTrackingEvent.associate = (models) => {
    HbaTrackingEvent.belongsTo(models.HbaVisitorSession, {
      foreignKey: "sessionId",
      targetKey: "sessionId",
      as: "session",
    });
  };

  return HbaTrackingEvent;
};

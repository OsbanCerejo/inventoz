module.exports = (sequelize, DataTypes) => {
  const HbaCartSnapshot = sequelize.define(
    "HbaCartSnapshot",
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
      items: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      totalSkus: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      totalUnits: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      totalPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      lastEventType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      hasSubmittedOrder: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      lastUpdatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: "hbaCartSnapshots",
      timestamps: true,
    }
  );

  HbaCartSnapshot.associate = (models) => {
    HbaCartSnapshot.belongsTo(models.HbaVisitorSession, {
      foreignKey: "sessionId",
      targetKey: "sessionId",
      as: "session",
    });
  };

  return HbaCartSnapshot;
};

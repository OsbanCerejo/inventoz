module.exports = (sequelize, DataTypes) => {
  const HbaNewArrivalSubscriber = sequelize.define(
    "HbaNewArrivalSubscriber",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "active",
      },
      source: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "hba-site",
      },
      ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      subscribedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      unsubscribedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "hbaNewArrivalSubscribers",
      timestamps: true,
    }
  );

  return HbaNewArrivalSubscriber;
};

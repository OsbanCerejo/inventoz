module.exports = (sequelize, DataTypes) => {
  const Logs = sequelize.define(
    "Logs",
    {
      timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      metaData: {
        type: DataTypes.JSON,
        allowNull: false,
      },
    },
    {
      timestamps: false,
    }
  );

  return Logs;
};

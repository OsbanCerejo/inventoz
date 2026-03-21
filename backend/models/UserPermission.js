module.exports = (sequelize, DataTypes) => {
  const UserPermission = sequelize.define(
    "UserPermission",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      permissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      allowed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "UserPermissions",
    }
  );

  UserPermission.associate = (models) => {
    UserPermission.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
    UserPermission.belongsTo(models.Permission, {
      foreignKey: "permissionId",
      as: "permission",
    });
  };

  return UserPermission;
};


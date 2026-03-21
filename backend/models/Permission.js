module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define(
    "Permission",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
      },
      scopeType: {
        type: DataTypes.ENUM("resource_action", "menu"),
        allowNull: false,
      },
      resource: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      menuKey: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      label: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      tableName: "Permissions",
    }
  );

  Permission.associate = (models) => {
    Permission.hasMany(models.UserPermission, {
      foreignKey: "permissionId",
      as: "userPermissions",
    });
  };

  return Permission;
};


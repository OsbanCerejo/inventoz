module.exports = (sequelize, DataTypes) => {
  const LmTiktokCredential = sequelize.define('LmTiktokCredential', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    shopId: { type: DataTypes.STRING(191), allowNull: false, unique: true },
    shopName: { type: DataTypes.STRING(255), allowNull: true },
    accessToken: { type: DataTypes.TEXT, allowNull: true },
    refreshToken: { type: DataTypes.TEXT, allowNull: true },
    accessTokenExpiry: { type: DataTypes.DATE, allowNull: true },
    refreshTokenExpiry: { type: DataTypes.DATE, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    lastHealthCheck: { type: DataTypes.DATE, allowNull: true },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  }, {
    tableName: 'lm_tiktok_credentials',
    timestamps: true,
  });

  return LmTiktokCredential;
};

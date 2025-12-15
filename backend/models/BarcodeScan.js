module.exports = (sequelize, DataTypes) => {
  const BarcodeScan = sequelize.define(
    "BarcodeScan",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      barcode: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scannedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Timestamp when the barcode was scanned (stored in local time)'
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        comment: 'ID of the user who scanned the barcode'
      },
    },
    {
      timestamps: false,
      indexes: [
        {
          fields: ['barcode']
        },
        {
          fields: ['scannedAt']
        },
        {
          fields: ['userId']
        }
      ]
    }
  );

  BarcodeScan.associate = function(models) {
    BarcodeScan.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return BarcodeScan;
};


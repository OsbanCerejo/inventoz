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
    },
    {
      timestamps: false,
      indexes: [
        {
          fields: ['barcode']
        },
        {
          fields: ['scannedAt']
        }
      ]
    }
  );

  return BarcodeScan;
};


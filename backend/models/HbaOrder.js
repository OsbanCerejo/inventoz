module.exports = (sequelize, DataTypes) => {
  const HbaOrder = sequelize.define(
    "HbaOrder",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orderNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      customerName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      companyName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      addressLine1: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      addressLine2: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      zipCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      salesPerson: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "new",
      },
      internalNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reviewedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
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
      submittedIp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      notificationStatus: {
        type: DataTypes.ENUM("pending", "sent", "failed"),
        allowNull: false,
        defaultValue: "pending",
      },
      notificationSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      notificationRecipients: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      notificationError: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      customerNotificationStatus: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "skipped",
      },
      customerNotificationSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      customerNotificationError: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "hbaOrders",
      timestamps: true,
    }
  );

  HbaOrder.associate = (models) => {
    HbaOrder.hasMany(models.HbaOrderItem, {
      foreignKey: "orderId",
      as: "items",
      onDelete: "CASCADE",
    });
  };

  return HbaOrder;
};

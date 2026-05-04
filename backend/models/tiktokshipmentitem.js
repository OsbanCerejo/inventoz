'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TikTokShipmentItem = sequelize.define(
    'TikTokShipmentItem',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      tiktokShowId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      importId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      shipmentId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tracking: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      stickerNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      productName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      variation: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      skuId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      virtualBundleSellerSku: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      combinedListing: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      itemCategory: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isAuctionItem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      expectedQty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      expectedProductLinks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      groupedQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      soldPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      orderAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      taxes: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      shippingFeeAfterDiscount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      originalShippingFee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      totalDiscount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      placedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      rtsAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      shippedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      scannedQty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM('ready', 'in_progress', 'completed', 'pending_review'),
        allowNull: false,
        defaultValue: 'ready',
      },
      mismatchReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      closedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      closedBy: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      buyer: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      orderId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      orderStatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      orderSubstatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentMethod: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      recipient: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      zipcode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      addressLine1: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      addressLine2: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      buyerMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      deliveryInstruction: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      fulfillmentType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      warehouseName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deliveryOptionType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deliveryOption: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shippingProviderName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      packageIds: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      shippingInformation: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      sellerNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      rawOrderData: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'tiktokShipmentItems',
      timestamps: true,
    }
  );

  TikTokShipmentItem.associate = (models) => {
    TikTokShipmentItem.belongsTo(models.TikTokShow, {
      foreignKey: 'tiktokShowId',
      as: 'show',
    });
    TikTokShipmentItem.belongsTo(models.TikTokShipmentImport, {
      foreignKey: 'importId',
      as: 'importRecord',
    });
  };

  return TikTokShipmentItem;
};

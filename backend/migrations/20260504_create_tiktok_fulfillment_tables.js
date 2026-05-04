'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tiktokShows', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdBy: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('tiktokShows', ['isActive']);

    await queryInterface.createTable('tiktokShipmentImports', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      tiktokShowId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      fileName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      uploadedBy: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      totalRows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      totalShipments: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      readyShipments: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      pendingReviewShipments: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addConstraint('tiktokShipmentImports', {
      fields: ['tiktokShowId'],
      type: 'foreign key',
      name: 'fk_tiktok_shipment_import_show_id',
      references: {
        table: 'tiktokShows',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addIndex('tiktokShipmentImports', ['tiktokShowId']);
    await queryInterface.addIndex('tiktokShipmentImports', ['tiktokShowId', 'isActive']);

    await queryInterface.createTable('tiktokShipmentItems', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      tiktokShowId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      importId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      shipmentId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tracking: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      stickerNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      productName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      variation: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      skuId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      virtualBundleSellerSku: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      combinedListing: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      itemCategory: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      isAuctionItem: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      expectedQty: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      expectedProductLinks: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      groupedQuantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      soldPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      orderAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      taxes: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      shippingFeeAfterDiscount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      originalShippingFee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      totalDiscount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      placedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      rtsAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      shippedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      deliveredAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cancelledAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      scannedQty: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM('ready', 'in_progress', 'completed', 'pending_review'),
        allowNull: false,
        defaultValue: 'ready',
      },
      mismatchReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      closedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      closedBy: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      buyer: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      orderId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      orderStatus: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      orderSubstatus: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      paymentMethod: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      recipient: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      zipcode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      addressLine1: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      addressLine2: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      buyerMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      deliveryInstruction: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      fulfillmentType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      warehouseName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      deliveryOptionType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      deliveryOption: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      shippingProviderName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      packageIds: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      shippingInformation: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      sellerNote: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      rawOrderData: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addConstraint('tiktokShipmentItems', {
      fields: ['tiktokShowId'],
      type: 'foreign key',
      name: 'fk_tiktok_shipment_item_show_id',
      references: {
        table: 'tiktokShows',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('tiktokShipmentItems', {
      fields: ['importId'],
      type: 'foreign key',
      name: 'fk_tiktok_shipment_item_import_id',
      references: {
        table: 'tiktokShipmentImports',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addIndex('tiktokShipmentItems', ['tiktokShowId', 'importId']);
    await queryInterface.addIndex('tiktokShipmentItems', ['shipmentId']);
    await queryInterface.addIndex('tiktokShipmentItems', ['tracking']);
    await queryInterface.addIndex('tiktokShipmentItems', ['status']);
    await queryInterface.addIndex('tiktokShipmentItems', ['shipmentId', 'stickerNumber']);

    await queryInterface.createTable('tiktokShipmentScans', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      tiktokShowId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      importId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      shipmentId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tracking: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      scannedValue: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      auctionStickerNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      productSku: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      previousQuantity: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      newQuantity: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      soldPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      scanType: {
        type: Sequelize.ENUM('tracking', 'item'),
        allowNull: false,
      },
      result: {
        type: Sequelize.ENUM(
          'matched',
          'shipment_loaded',
          'shipment_not_found',
          'tracking_conflict',
          'pending_review_blocked',
          'duplicate',
          'unexpected'
        ),
        allowNull: false,
      },
      message: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addConstraint('tiktokShipmentScans', {
      fields: ['tiktokShowId'],
      type: 'foreign key',
      name: 'fk_tiktok_shipment_scan_show_id',
      references: {
        table: 'tiktokShows',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('tiktokShipmentScans', {
      fields: ['importId'],
      type: 'foreign key',
      name: 'fk_tiktok_shipment_scan_import_id',
      references: {
        table: 'tiktokShipmentImports',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('tiktokShipmentScans', ['tiktokShowId', 'createdAt']);
    await queryInterface.addIndex('tiktokShipmentScans', ['shipmentId']);
    await queryInterface.addIndex('tiktokShipmentScans', ['tracking']);

    await queryInterface.createTable('tiktokFailedOrders', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      tiktokShowId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      importId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      buyer: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      stickerNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      soldPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      failureStatus: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      attemptCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      latestPlacedAtRaw: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      latestOrderId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      latestOrderNumericId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addConstraint('tiktokFailedOrders', {
      fields: ['tiktokShowId'],
      type: 'foreign key',
      name: 'fk_tiktok_failed_order_show_id',
      references: {
        table: 'tiktokShows',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('tiktokFailedOrders', {
      fields: ['importId'],
      type: 'foreign key',
      name: 'fk_tiktok_failed_order_import_id',
      references: {
        table: 'tiktokShipmentImports',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addIndex('tiktokFailedOrders', ['tiktokShowId', 'importId']);
    await queryInterface.addIndex('tiktokFailedOrders', ['stickerNumber']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tiktokFailedOrders');
    await queryInterface.dropTable('tiktokShipmentScans');
    await queryInterface.dropTable('tiktokShipmentItems');
    await queryInterface.dropTable('tiktokShipmentImports');
    await queryInterface.dropTable('tiktokShows');
  },
};

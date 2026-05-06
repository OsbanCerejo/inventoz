'use strict';

const tableExists = async (queryInterface, tableName) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch (error) {
    return false;
  }
};

const ensureTable = async (queryInterface, tableName, definition) => {
  if (!(await tableExists(queryInterface, tableName))) {
    await queryInterface.createTable(tableName, definition);
  }
};

const ensureIndex = async (queryInterface, tableName, fields, options = {}) => {
  const existingIndexes = await queryInterface.showIndex(tableName);
  const requestedName =
    options.name || `${tableName}_${fields.join('_')}`;
  const alreadyExists = existingIndexes.some((index) => index.name === requestedName);
  if (!alreadyExists) {
    await queryInterface.addIndex(tableName, fields, { ...options, name: requestedName });
  }
};

const ensureConstraint = async (queryInterface, tableName, options) => {
  const tableDefinition = await queryInterface.describeTable(tableName);
  if (tableDefinition[options.fields[0]]?.references) {
    return;
  }

  try {
    await queryInterface.addConstraint(tableName, options);
  } catch (error) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate')) {
      throw error;
    }
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await ensureTable(queryInterface, 'tiktokShows', {
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
    await ensureIndex(queryInterface, 'tiktokShows', ['isActive'], {
      name: 'tiktok_shows_is_active',
    });

    await ensureTable(queryInterface, 'tiktokShipmentImports', {
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
    await ensureConstraint(queryInterface, 'tiktokShipmentImports', {
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
    await ensureIndex(queryInterface, 'tiktokShipmentImports', ['tiktokShowId'], {
      name: 'tiktok_shipment_imports_show_id',
    });
    await ensureIndex(queryInterface, 'tiktokShipmentImports', ['tiktokShowId', 'isActive'], {
      name: 'tiktok_shipment_imports_show_id_is_active',
    });

    await ensureTable(queryInterface, 'tiktokShipmentItems', {
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
    await ensureConstraint(queryInterface, 'tiktokShipmentItems', {
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
    await ensureConstraint(queryInterface, 'tiktokShipmentItems', {
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
    await ensureIndex(queryInterface, 'tiktokShipmentItems', ['tiktokShowId', 'importId'], {
      name: 'tiktok_shipment_items_show_import',
    });
    await ensureIndex(queryInterface, 'tiktokShipmentItems', ['shipmentId'], {
      name: 'tiktok_shipment_items_shipment_id',
    });
    await ensureIndex(queryInterface, 'tiktokShipmentItems', ['tracking'], {
      name: 'tiktok_shipment_items_tracking',
    });
    await ensureIndex(queryInterface, 'tiktokShipmentItems', ['status'], {
      name: 'tiktok_shipment_items_status',
    });
    await ensureIndex(queryInterface, 'tiktokShipmentItems', ['shipmentId', 'stickerNumber'], {
      name: 'tiktok_shipment_items_shipment_sticker',
    });

    await ensureTable(queryInterface, 'tiktokShipmentScans', {
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
    await ensureConstraint(queryInterface, 'tiktokShipmentScans', {
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
    await ensureConstraint(queryInterface, 'tiktokShipmentScans', {
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
    await ensureIndex(queryInterface, 'tiktokShipmentScans', ['tiktokShowId', 'createdAt'], {
      name: 'tiktok_shipment_scans_show_created_at',
    });
    await ensureIndex(queryInterface, 'tiktokShipmentScans', ['shipmentId'], {
      name: 'tiktok_shipment_scans_shipment_id',
    });
    await ensureIndex(queryInterface, 'tiktokShipmentScans', ['tracking'], {
      name: 'tiktok_shipment_scans_tracking',
    });

    await ensureTable(queryInterface, 'tiktokFailedOrders', {
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
    await ensureConstraint(queryInterface, 'tiktokFailedOrders', {
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
    await ensureConstraint(queryInterface, 'tiktokFailedOrders', {
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
    await ensureIndex(queryInterface, 'tiktokFailedOrders', ['tiktokShowId', 'importId'], {
      name: 'tiktok_failed_orders_show_import',
    });
    await ensureIndex(queryInterface, 'tiktokFailedOrders', ['stickerNumber'], {
      name: 'tiktok_failed_orders_sticker_number',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tiktokFailedOrders');
    await queryInterface.dropTable('tiktokShipmentScans');
    await queryInterface.dropTable('tiktokShipmentItems');
    await queryInterface.dropTable('tiktokShipmentImports');
    await queryInterface.dropTable('tiktokShows');
  },
};

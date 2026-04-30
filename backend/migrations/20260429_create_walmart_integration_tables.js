"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("walmartConnections", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      storeName: { type: Sequelize.STRING(255), allowNull: false, defaultValue: "Walmart USA Store" },
      market: { type: Sequelize.STRING(16), allowNull: false, defaultValue: "US" },
      apiBaseUrl: { type: Sequelize.STRING(255), allowNull: false, defaultValue: "https://marketplace.walmartapis.com" },
      clientIdHint: { type: Sequelize.STRING(255), allowNull: true },
      status: { type: Sequelize.ENUM("active", "error", "disconnected"), allowNull: false, defaultValue: "disconnected" },
      lastTokenSuccessAt: { type: Sequelize.DATE, allowNull: true },
      lastTokenErrorAt: { type: Sequelize.DATE, allowNull: true },
      lastTokenErrorMessage: { type: Sequelize.TEXT, allowNull: true },
      lastOrdersSyncAt: { type: Sequelize.DATE, allowNull: true },
      lastItemsSyncAt: { type: Sequelize.DATE, allowNull: true },
      lastInventorySyncAt: { type: Sequelize.DATE, allowNull: true },
      lastPricingSyncAt: { type: Sequelize.DATE, allowNull: true },
      createdBy: { type: Sequelize.INTEGER, allowNull: true },
      lastUpdatedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("walmartProductMappings", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      localSku: { type: Sequelize.STRING(255), allowNull: false },
      walmartSku: { type: Sequelize.STRING(255), allowNull: false },
      walmartItemId: { type: Sequelize.STRING(255), allowNull: true },
      walmartProductId: { type: Sequelize.STRING(255), allowNull: true },
      isMapped: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      mappingSource: { type: Sequelize.ENUM("auto", "manual"), allowNull: false, defaultValue: "auto" },
      listingStatus: { type: Sequelize.STRING(64), allowNull: true },
      lastSyncedAt: { type: Sequelize.DATE, allowNull: true },
      lastSyncStatus: { type: Sequelize.STRING(64), allowNull: true },
      lastSyncError: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("walmartItems", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      walmartSku: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      walmartItemId: { type: Sequelize.STRING(255), allowNull: true },
      productName: { type: Sequelize.STRING(255), allowNull: true },
      brand: { type: Sequelize.STRING(255), allowNull: true },
      publishedStatus: { type: Sequelize.STRING(64), allowNull: true },
      lifecycleStatus: { type: Sequelize.STRING(64), allowNull: true },
      productType: { type: Sequelize.STRING(255), allowNull: true },
      gtin: { type: Sequelize.STRING(64), allowNull: true },
      currentPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      currency: { type: Sequelize.STRING(8), allowNull: true },
      rawPayload: { type: Sequelize.TEXT("long"), allowNull: true },
      lastSyncedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("walmartInventorySnapshots", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      walmartSku: { type: Sequelize.STRING(255), allowNull: false },
      fulfillmentType: { type: Sequelize.STRING(64), allowNull: true },
      shipNode: { type: Sequelize.STRING(255), allowNull: true },
      availableQuantity: { type: Sequelize.INTEGER, allowNull: true },
      rawPayload: { type: Sequelize.TEXT("long"), allowNull: true },
      syncedAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("walmartPricingSnapshots", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      walmartSku: { type: Sequelize.STRING(255), allowNull: false },
      currentPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      currency: { type: Sequelize.STRING(8), allowNull: true },
      comparisonPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      promoPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      promoStartAt: { type: Sequelize.DATE, allowNull: true },
      promoEndAt: { type: Sequelize.DATE, allowNull: true },
      rawPayload: { type: Sequelize.TEXT("long"), allowNull: true },
      syncedAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("walmartOrders", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      purchaseOrderId: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      customerOrderId: { type: Sequelize.STRING(64), allowNull: true },
      orderDate: { type: Sequelize.DATE, allowNull: true },
      shippingMethod: { type: Sequelize.STRING(64), allowNull: true },
      orderStatus: { type: Sequelize.STRING(64), allowNull: true },
      fulfillmentOption: { type: Sequelize.STRING(64), allowNull: true },
      customerName: { type: Sequelize.STRING(255), allowNull: true },
      customerEmailMasked: { type: Sequelize.STRING(255), allowNull: true },
      shippingCity: { type: Sequelize.STRING(255), allowNull: true },
      shippingState: { type: Sequelize.STRING(255), allowNull: true },
      shippingPostalCode: { type: Sequelize.STRING(64), allowNull: true },
      shippingCountry: { type: Sequelize.STRING(64), allowNull: true },
      totalAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      currency: { type: Sequelize.STRING(8), allowNull: true },
      acknowledgedAt: { type: Sequelize.DATE, allowNull: true },
      shippedAt: { type: Sequelize.DATE, allowNull: true },
      deliveredAt: { type: Sequelize.DATE, allowNull: true },
      cancelledAt: { type: Sequelize.DATE, allowNull: true },
      rawPayload: { type: Sequelize.TEXT("long"), allowNull: true },
      lastSyncedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("walmartOrderLines", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      walmartOrderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "walmartOrders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      purchaseOrderId: { type: Sequelize.STRING(64), allowNull: false },
      lineNumber: { type: Sequelize.STRING(64), allowNull: false },
      walmartSku: { type: Sequelize.STRING(255), allowNull: true },
      productName: { type: Sequelize.STRING(255), allowNull: true },
      quantity: { type: Sequelize.INTEGER, allowNull: true },
      unitPrice: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      shippingPrice: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      taxAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      lineStatus: { type: Sequelize.STRING(64), allowNull: true },
      trackingNumber: { type: Sequelize.STRING(255), allowNull: true },
      carrier: { type: Sequelize.STRING(255), allowNull: true },
      rawPayload: { type: Sequelize.TEXT("long"), allowNull: true },
      lastSyncedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("walmartSyncRuns", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      resourceType: { type: Sequelize.ENUM("orders", "items", "inventory", "pricing"), allowNull: false },
      triggerType: { type: Sequelize.ENUM("manual", "scheduled"), allowNull: false, defaultValue: "manual" },
      status: { type: Sequelize.ENUM("running", "success", "partial", "failed"), allowNull: false, defaultValue: "running" },
      startedAt: { type: Sequelize.DATE, allowNull: false },
      completedAt: { type: Sequelize.DATE, allowNull: true },
      recordsFetched: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      recordsInserted: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      recordsUpdated: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      errorCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      summaryMessage: { type: Sequelize.TEXT, allowNull: true },
      requestedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("walmartSyncErrors", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      syncRunId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "walmartSyncRuns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      resourceType: { type: Sequelize.STRING(64), allowNull: false },
      referenceType: { type: Sequelize.STRING(64), allowNull: true },
      referenceValue: { type: Sequelize.STRING(255), allowNull: true },
      errorCode: { type: Sequelize.STRING(128), allowNull: true },
      errorMessage: { type: Sequelize.TEXT, allowNull: false },
      payloadSnippet: { type: Sequelize.TEXT("long"), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("walmartProductMappings", ["localSku"], { name: "walmart_product_mappings_local_sku" });
    await queryInterface.addIndex("walmartProductMappings", ["walmartSku"], { name: "walmart_product_mappings_walmart_sku" });
    await queryInterface.addIndex("walmartItems", ["publishedStatus"], { name: "walmart_items_published_status" });
    await queryInterface.addIndex("walmartInventorySnapshots", ["walmartSku"], { name: "walmart_inventory_snapshots_walmart_sku" });
    await queryInterface.addIndex("walmartPricingSnapshots", ["walmartSku"], { name: "walmart_pricing_snapshots_walmart_sku" });
    await queryInterface.addIndex("walmartOrders", ["orderDate"], { name: "walmart_orders_order_date" });
    await queryInterface.addIndex("walmartOrders", ["orderStatus"], { name: "walmart_orders_order_status" });
    await queryInterface.addIndex("walmartOrderLines", ["purchaseOrderId"], { name: "walmart_order_lines_purchase_order_id" });
    await queryInterface.addIndex("walmartOrderLines", ["walmartSku"], { name: "walmart_order_lines_walmart_sku" });
    await queryInterface.addIndex("walmartSyncRuns", ["resourceType", "startedAt"], { name: "walmart_sync_runs_resource_started" });
    await queryInterface.addIndex("walmartSyncErrors", ["syncRunId"], { name: "walmart_sync_errors_sync_run_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("walmartSyncErrors");
    await queryInterface.dropTable("walmartSyncRuns");
    await queryInterface.dropTable("walmartOrderLines");
    await queryInterface.dropTable("walmartOrders");
    await queryInterface.dropTable("walmartPricingSnapshots");
    await queryInterface.dropTable("walmartInventorySnapshots");
    await queryInterface.dropTable("walmartItems");
    await queryInterface.dropTable("walmartProductMappings");
    await queryInterface.dropTable("walmartConnections");
  },
};

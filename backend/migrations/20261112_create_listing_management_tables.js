'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`lm_managed_skus\` (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        sku VARCHAR(191) NOT NULL,
        isGenericAuction TINYINT(1) NOT NULL DEFAULT 0,
        syncEnabled TINYINT(1) NOT NULL DEFAULT 0,
        addedBy INT DEFAULT NULL,
        addedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notes TEXT DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_lm_managed_skus_sku (sku)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`lm_marketplace_mappings\` (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        managedSkuId INT UNSIGNED NOT NULL,
        marketplace ENUM('tiktok','walmart') NOT NULL DEFAULT 'tiktok',
        shopId VARCHAR(191) NOT NULL,
        marketplaceProductId VARCHAR(191) DEFAULT NULL,
        marketplaceSkuId VARCHAR(191) DEFAULT NULL,
        sellerSku VARCHAR(191) DEFAULT NULL,
        warehouseId VARCHAR(191) DEFAULT NULL,
        listingStatus VARCHAR(64) DEFAULT 'active',
        currentQty INT NOT NULL DEFAULT 0,
        desiredQty INT NOT NULL DEFAULT 0,
        lastConfirmedQty INT DEFAULT NULL,
        currentPrice DECIMAL(10,2) DEFAULT NULL,
        syncEnabled TINYINT(1) NOT NULL DEFAULT 0,
        lastSyncAt DATETIME DEFAULT NULL,
        lastSyncStatus ENUM('ok','failed','pending') DEFAULT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_lm_mappings_managed_sku (managedSkuId),
        KEY idx_lm_mappings_shop (shopId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`lm_inventory_events\` (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        sku VARCHAR(191) NOT NULL,
        previousQty INT NOT NULL,
        newQty INT NOT NULL,
        delta INT NOT NULL,
        eventType ENUM('MANUAL_ADJUSTMENT','INBOUND','INVOICE_INBOUND','TIKTOK_SHIPMENT_CLOSE','MARKETPLACE_DEDUCTION','DAMAGE','SKU_MERGE','OTHER') NOT NULL DEFAULT 'OTHER',
        eventSource VARCHAR(128) DEFAULT NULL,
        referenceId VARCHAR(191) DEFAULT NULL,
        userId INT DEFAULT NULL,
        processedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        syncStatus ENUM('pending','processed','skipped','failed') NOT NULL DEFAULT 'pending',
        syncNotes TEXT DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_lm_events_sku (sku),
        KEY idx_lm_events_sync_status (syncStatus),
        KEY idx_lm_events_processed_at (processedAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`lm_tiktok_orders\` (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        tiktokOrderId VARCHAR(191) NOT NULL,
        tiktokOrderLineId VARCHAR(191) NOT NULL,
        tiktokSkuId VARCHAR(191) NOT NULL,
        mappingId INT UNSIGNED DEFAULT NULL,
        sku VARCHAR(191) DEFAULT NULL,
        quantity INT NOT NULL DEFAULT 1,
        orderStatus VARCHAR(64) DEFAULT NULL,
        shipmentStatus VARCHAR(64) DEFAULT NULL,
        placedAt DATETIME DEFAULT NULL,
        shippedAt DATETIME DEFAULT NULL,
        deductedAt DATETIME DEFAULT NULL,
        deductionEventId INT UNSIGNED DEFAULT NULL,
        idempotencyKey VARCHAR(255) NOT NULL,
        cancelledAt DATETIME DEFAULT NULL,
        rawPayload JSON DEFAULT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_lm_tiktok_orders_idempotency (idempotencyKey),
        KEY idx_lm_tiktok_orders_sku (sku),
        KEY idx_lm_tiktok_orders_status (orderStatus)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`lm_sync_jobs\` (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        mappingId INT UNSIGNED NOT NULL,
        jobType ENUM('qty_update','price_update','reconcile') NOT NULL DEFAULT 'qty_update',
        targetQty INT DEFAULT NULL,
        targetPrice DECIMAL(10,2) DEFAULT NULL,
        inventoryEventId INT UNSIGNED DEFAULT NULL,
        status ENUM('pending','processing','done','failed','cancelled') NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        lastAttemptAt DATETIME DEFAULT NULL,
        nextRetryAt DATETIME DEFAULT NULL,
        apiResponse TEXT DEFAULT NULL,
        errorMessage TEXT DEFAULT NULL,
        completedAt DATETIME DEFAULT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_lm_sync_jobs_status (status),
        KEY idx_lm_sync_jobs_next_retry (nextRetryAt),
        KEY idx_lm_sync_jobs_mapping (mappingId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`lm_tiktok_credentials\` (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        shopId VARCHAR(191) NOT NULL,
        shopName VARCHAR(255) DEFAULT NULL,
        accessToken TEXT DEFAULT NULL,
        refreshToken TEXT DEFAULT NULL,
        accessTokenExpiry DATETIME DEFAULT NULL,
        refreshTokenExpiry DATETIME DEFAULT NULL,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        lastHealthCheck DATETIME DEFAULT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_lm_tiktok_creds_shop (shopId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`lm_price_history\` (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        mappingId INT UNSIGNED NOT NULL,
        oldPrice DECIMAL(10,2) DEFAULT NULL,
        newPrice DECIMAL(10,2) NOT NULL,
        changedBy INT DEFAULT NULL,
        changedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_lm_price_history_mapping (mappingId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`lm_qty_history\` (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        mappingId INT UNSIGNED NOT NULL,
        oldQty INT DEFAULT NULL,
        newQty INT NOT NULL,
        reason VARCHAR(255) DEFAULT NULL,
        changedBy INT DEFAULT NULL,
        changedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_lm_qty_history_mapping (mappingId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  async down(queryInterface) {
    for (const table of [
      'lm_qty_history', 'lm_price_history', 'lm_sync_jobs',
      'lm_tiktok_orders', 'lm_inventory_events',
      'lm_marketplace_mappings', 'lm_managed_skus', 'lm_tiktok_credentials',
    ]) {
      await queryInterface.dropTable(table, { force: true });
    }
  },
};

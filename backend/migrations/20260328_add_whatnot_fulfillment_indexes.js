'use strict';

const ensureIndex = async (queryInterface, tableName, indexName, definition) => {
  const existing = await queryInterface.showIndex(tableName);
  if (existing.some((entry) => entry.name === indexName)) {
    return;
  }
  await queryInterface.addIndex(tableName, definition.fields, {
    name: indexName,
    ...definition.options,
  });
};

const dropIndexIfExists = async (queryInterface, tableName, indexName) => {
  const existing = await queryInterface.showIndex(tableName);
  if (!existing.some((entry) => entry.name === indexName)) {
    return;
  }
  await queryInterface.removeIndex(tableName, indexName);
};

module.exports = {
  async up(queryInterface) {
    await ensureIndex(queryInterface, 'whatnotShipmentItems', 'idx_whatnot_items_show_import_tracking', {
      fields: ['whatnotShowId', 'importId', 'tracking'],
    });
    await ensureIndex(queryInterface, 'whatnotShipmentItems', 'idx_whatnot_items_show_import_shipment', {
      fields: ['whatnotShowId', 'importId', 'shipmentId'],
    });
    await ensureIndex(queryInterface, 'whatnotShipmentItems', 'idx_whatnot_items_show_import_status', {
      fields: ['whatnotShowId', 'importId', 'status'],
    });
    await ensureIndex(queryInterface, 'whatnotShipmentScans', 'idx_whatnot_scans_show_import_shipment_result', {
      fields: ['whatnotShowId', 'importId', 'shipmentId', 'result'],
    });
    await ensureIndex(queryInterface, 'whatnotShipmentScans', 'idx_whatnot_scans_show_import_shipment_scan_type', {
      fields: ['whatnotShowId', 'importId', 'shipmentId', 'scanType'],
    });
    await ensureIndex(queryInterface, 'whatnotShipmentScans', 'idx_whatnot_scans_show_import_shipment_sticker', {
      fields: ['whatnotShowId', 'importId', 'shipmentId', 'auctionStickerNumber'],
    });
  },

  async down(queryInterface) {
    await dropIndexIfExists(queryInterface, 'whatnotShipmentScans', 'idx_whatnot_scans_show_import_shipment_sticker');
    await dropIndexIfExists(queryInterface, 'whatnotShipmentScans', 'idx_whatnot_scans_show_import_shipment_scan_type');
    await dropIndexIfExists(queryInterface, 'whatnotShipmentScans', 'idx_whatnot_scans_show_import_shipment_result');
    await dropIndexIfExists(queryInterface, 'whatnotShipmentItems', 'idx_whatnot_items_show_import_status');
    await dropIndexIfExists(queryInterface, 'whatnotShipmentItems', 'idx_whatnot_items_show_import_shipment');
    await dropIndexIfExists(queryInterface, 'whatnotShipmentItems', 'idx_whatnot_items_show_import_tracking');
  },
};

'use strict';

// TikTok CSV exports datetime columns in Eastern Time (the seller's timezone).
// The original parseDateTime() treated them as UTC, storing all timestamps
// 4 hours too early (EDT, UTC-4). This migration corrects existing rows by
// adding 4 hours to convert stored EDT values to real UTC.
//
// All current data (May–July 2026) falls within EDT (UTC-4), so the offset
// is a flat +4 hours. Future imports use the corrected parseDateTime() which
// handles EST/EDT automatically.
//
// Affected columns: placedAt, paidAt, rtsAt, shippedAt, deliveredAt,
//                   cancelledAt, closedAt
// NOT touched: createdAt, updatedAt (our own DB timestamps, not from CSV)

const CSV_DATE_COLUMNS = [
  'placedAt',
  'paidAt',
  'rtsAt',
  'shippedAt',
  'deliveredAt',
  'cancelledAt',
  'closedAt',
];

module.exports = {
  async up(queryInterface) {
    for (const col of CSV_DATE_COLUMNS) {
      await queryInterface.sequelize.query(
        `UPDATE tiktokShipmentItems
         SET ${col} = DATE_ADD(${col}, INTERVAL 4 HOUR)
         WHERE ${col} IS NOT NULL`
      );
    }
  },

  async down(queryInterface) {
    for (const col of CSV_DATE_COLUMNS) {
      await queryInterface.sequelize.query(
        `UPDATE tiktokShipmentItems
         SET ${col} = DATE_SUB(${col}, INTERVAL 4 HOUR)
         WHERE ${col} IS NOT NULL`
      );
    }
  },
};

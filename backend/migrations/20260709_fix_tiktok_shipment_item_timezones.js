'use strict';

// TikTok CSV exports datetime columns in Pacific Time (PDT/PST).
// The original parseDateTime() treated them as UTC, storing all timestamps
// 7 hours too early (PDT, UTC-7). This migration corrects existing rows by
// adding 7 hours to convert stored PDT values to real UTC.
//
// All current data (May–July 2026) falls within PDT (UTC-7), so the offset
// is a flat +7 hours. Future imports use the corrected parseDateTime() which
// handles PST/PDT automatically.
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
         SET ${col} = DATE_ADD(${col}, INTERVAL 7 HOUR)
         WHERE ${col} IS NOT NULL`
      );
    }
  },

  async down(queryInterface) {
    for (const col of CSV_DATE_COLUMNS) {
      await queryInterface.sequelize.query(
        `UPDATE tiktokShipmentItems
         SET ${col} = DATE_SUB(${col}, INTERVAL 7 HOUR)
         WHERE ${col} IS NOT NULL`
      );
    }
  },
};

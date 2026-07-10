'use strict';

// Shows 67 and 68 were imported after the parseDateTime fix was deployed,
// but that fix had a sign error: it parsed as EST then added 1h instead of
// subtracting 1h, storing times 2 hours too late instead of correct UTC.
// This migration subtracts 2 hours from those two shows only.

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
         SET ${col} = DATE_SUB(${col}, INTERVAL 2 HOUR)
         WHERE ${col} IS NOT NULL
           AND tiktokShowId IN (67, 68)`
      );
    }
  },

  async down(queryInterface) {
    for (const col of CSV_DATE_COLUMNS) {
      await queryInterface.sequelize.query(
        `UPDATE tiktokShipmentItems
         SET ${col} = DATE_ADD(${col}, INTERVAL 2 HOUR)
         WHERE ${col} IS NOT NULL
           AND tiktokShowId IN (67, 68)`
      );
    }
  },
};

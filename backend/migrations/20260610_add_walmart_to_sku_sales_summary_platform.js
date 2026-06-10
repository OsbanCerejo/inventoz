'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('skuSalesSummary', 'platform', {
      type: Sequelize.ENUM('tiktok', 'whatnot', 'ebay', 'walmart'),
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('skuSalesSummary', 'platform', {
      type: Sequelize.ENUM('tiktok', 'whatnot', 'ebay'),
      allowNull: false,
    });
  },
};

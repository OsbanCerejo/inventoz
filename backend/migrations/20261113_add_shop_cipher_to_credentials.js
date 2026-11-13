'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lm_tiktok_credentials', 'shopCipher', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'shopName',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lm_tiktok_credentials', 'shopCipher');
  },
};

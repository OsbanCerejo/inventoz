module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("hbaOrders");

    if (!table.customerNotificationStatus) {
      await queryInterface.addColumn("hbaOrders", "customerNotificationStatus", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "skipped",
      });
    }

    if (!table.customerNotificationSentAt) {
      await queryInterface.addColumn("hbaOrders", "customerNotificationSentAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!table.customerNotificationError) {
      await queryInterface.addColumn("hbaOrders", "customerNotificationError", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("hbaOrders");

    if (table.customerNotificationError) {
      await queryInterface.removeColumn("hbaOrders", "customerNotificationError");
    }

    if (table.customerNotificationSentAt) {
      await queryInterface.removeColumn("hbaOrders", "customerNotificationSentAt");
    }

    if (table.customerNotificationStatus) {
      await queryInterface.removeColumn("hbaOrders", "customerNotificationStatus");
    }
  },
};

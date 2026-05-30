module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("hbaOrders");

    if (!table.status) {
      await queryInterface.addColumn("hbaOrders", "status", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "new",
      });
    }

    if (!table.internalNotes) {
      await queryInterface.addColumn("hbaOrders", "internalNotes", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!table.reviewedBy) {
      await queryInterface.addColumn("hbaOrders", "reviewedBy", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!table.reviewedAt) {
      await queryInterface.addColumn("hbaOrders", "reviewedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("hbaOrders");

    if (table.reviewedAt) {
      await queryInterface.removeColumn("hbaOrders", "reviewedAt");
    }

    if (table.reviewedBy) {
      await queryInterface.removeColumn("hbaOrders", "reviewedBy");
    }

    if (table.internalNotes) {
      await queryInterface.removeColumn("hbaOrders", "internalNotes");
    }

    if (table.status) {
      await queryInterface.removeColumn("hbaOrders", "status");
    }
  },
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("Products");

    if (!table.hbaMoq) {
      await queryInterface.addColumn("Products", "hbaMoq", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
    }

    if (!table.hbaStepCount) {
      await queryInterface.addColumn("Products", "hbaStepCount", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("Products");

    if (table.hbaStepCount) {
      await queryInterface.removeColumn("Products", "hbaStepCount");
    }

    if (table.hbaMoq) {
      await queryInterface.removeColumn("Products", "hbaMoq");
    }
  },
};

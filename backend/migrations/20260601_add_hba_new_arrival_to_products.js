module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("Products");

    if (!table.hbaNewArrival) {
      await queryInterface.addColumn("Products", "hbaNewArrival", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("Products");

    if (table.hbaNewArrival) {
      await queryInterface.removeColumn("Products", "hbaNewArrival");
    }
  },
};

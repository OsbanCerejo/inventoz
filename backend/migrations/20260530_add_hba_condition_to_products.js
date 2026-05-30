module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("Products");

    if (!table.hbaCondition) {
      await queryInterface.addColumn("Products", "hbaCondition", {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("Products");

    if (table.hbaCondition) {
      await queryInterface.removeColumn("Products", "hbaCondition");
    }
  },
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("Products");

    if (!table.hbaEnabled) {
      await queryInterface.addColumn("Products", "hbaEnabled", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!table.hbaQuantity) {
      await queryInterface.addColumn("Products", "hbaQuantity", {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!table.hbaPrice) {
      await queryInterface.addColumn("Products", "hbaPrice", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("Products");

    if (table.hbaPrice) {
      await queryInterface.removeColumn("Products", "hbaPrice");
    }

    if (table.hbaQuantity) {
      await queryInterface.removeColumn("Products", "hbaQuantity");
    }

    if (table.hbaEnabled) {
      await queryInterface.removeColumn("Products", "hbaEnabled");
    }
  },
};

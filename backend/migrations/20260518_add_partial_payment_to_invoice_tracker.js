module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    if (!table.partialPaymentAmount) {
      await queryInterface.addColumn("invoiceTrackerInvoices", "partialPaymentAmount", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }

    await queryInterface.changeColumn("invoiceTrackerInvoices", "paymentStatus", {
      type: Sequelize.ENUM("paid", "unpaid", "credit", "partial"),
      allowNull: false,
      defaultValue: "unpaid",
    });
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("invoiceTrackerInvoices");

    await queryInterface.sequelize.query(
      "UPDATE invoiceTrackerInvoices SET paymentStatus = 'credit' WHERE paymentStatus = 'partial'"
    );

    await queryInterface.changeColumn("invoiceTrackerInvoices", "paymentStatus", {
      type: Sequelize.ENUM("paid", "unpaid", "credit"),
      allowNull: false,
      defaultValue: "unpaid",
    });

    if (table.partialPaymentAmount) {
      await queryInterface.removeColumn("invoiceTrackerInvoices", "partialPaymentAmount");
    }
  },
};

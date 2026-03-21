"use strict";

const EMPLOYEE_PERMISSION_KEYS = [
  "employeeInfo.view",
  "employeeInfo.create",
  "employeeInfo.edit",
  "employeeInfo.delete",
  "menu.employeeInfo",
];

const hasColumn = async (queryInterface, tableName, columnName) => {
  try {
    const definition = await queryInterface.describeTable(tableName);
    return !!definition?.[columnName];
  } catch (error) {
    return false;
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `DELETE up
       FROM UserPermissions up
       JOIN Permissions p ON p.id = up.permissionId
       WHERE p.key IN (:keys)`,
      { replacements: { keys: EMPLOYEE_PERMISSION_KEYS } }
    );

    await queryInterface.bulkDelete("Permissions", {
      [Sequelize.Op.or]: [
        { key: EMPLOYEE_PERMISSION_KEYS },
        { resource: "employeeInfo" },
        { menuKey: "employeeInfo" },
      ],
    });

    await queryInterface.dropTable("employee_information");

    if (await hasColumn(queryInterface, "settings", "employee_info_username")) {
      await queryInterface.removeColumn("settings", "employee_info_username");
    }

    if (await hasColumn(queryInterface, "settings", "employee_info_password")) {
      await queryInterface.removeColumn("settings", "employee_info_password");
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable("employee_information", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      photoIdPath: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      termsAndConditionsSigned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      termsAndConditionsDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("pending", "approved", "rejected"),
        defaultValue: "pending",
      },
      additionalDocuments: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    if (!(await hasColumn(queryInterface, "settings", "employee_info_username"))) {
      await queryInterface.addColumn("settings", "employee_info_username", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "admin",
      });
    }

    if (!(await hasColumn(queryInterface, "settings", "employee_info_password"))) {
      await queryInterface.addColumn("settings", "employee_info_password", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "1234",
      });
    }
  },
};


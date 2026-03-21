"use strict";

const ROLE_BASELINE = {
  admin: {
    resources: {
      orders: ["view", "create", "edit", "delete"],
      pricelist: ["view", "create", "edit", "delete"],
      products: ["view", "create", "edit", "delete"],
      inbound: ["view", "create", "edit", "delete"],
      addProduct: ["view", "create", "edit", "delete"],
      pricing: ["view", "create", "edit", "delete"],
      packing: ["view"],
      whatnot: ["view", "create", "edit", "delete"],
      employeeInfo: ["view", "create", "edit", "delete"],
      users: ["view", "create", "edit", "delete"],
      sales: ["view", "create", "edit", "delete"],
      barcodeScan: ["view", "create", "edit", "delete"],
    },
    menu: ["orders", "pricelist", "products", "inbound", "packing", "whatnot", "employeeInfo", "users", "addProduct", "barcodeScan", "sales"],
  },
  listing: {
    resources: {
      addProduct: ["view", "create", "edit"],
      products: ["view", "create", "edit"],
      inbound: ["view", "create", "edit"],
      sales: ["view", "create", "edit"],
    },
    menu: ["products", "inbound", "addProduct", "sales"],
  },
  packing: {
    resources: {
      packing: ["view"],
      products: ["view"],
      orders: ["view"],
      barcodeScan: ["view", "create"],
    },
    menu: ["packing", "barcodeScan"],
  },
  warehouse_l1: {
    resources: {
      products: ["view", "create", "edit"],
      addProduct: ["view", "create", "edit"],
      inbound: ["view", "create", "edit"],
      sales: ["view", "create", "edit"],
      whatnot: ["view"],
    },
    menu: ["products", "inbound", "whatnot", "addProduct", "sales"],
  },
  warehouse_l2: {
    resources: {
      pricelist: ["view"],
    },
    menu: ["pricelist"],
  },
  accounts: {
    resources: {},
    menu: [],
  },
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Permissions", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      key: {
        type: Sequelize.STRING(128),
        allowNull: false,
        unique: true,
      },
      scopeType: {
        type: Sequelize.ENUM("resource_action", "menu"),
        allowNull: false,
      },
      resource: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      action: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      menuKey: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      label: {
        type: Sequelize.STRING(255),
        allowNull: false,
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

    await queryInterface.createTable("UserPermissions", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      permissionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Permissions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      allowed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.addIndex("UserPermissions", ["userId"], { name: "user_permissions_user_id" });
    await queryInterface.addIndex("UserPermissions", ["permissionId"], { name: "user_permissions_permission_id" });
    await queryInterface.addIndex("UserPermissions", ["userId", "permissionId"], {
      name: "user_permissions_user_permission_unique",
      unique: true,
    });

    const now = new Date();
    const permissionRows = [];
    const seen = new Set();

    Object.values(ROLE_BASELINE).forEach((roleConfig) => {
      Object.entries(roleConfig.resources || {}).forEach(([resource, actions]) => {
        actions.forEach((action) => {
          const key = `${resource}.${action}`;
          if (seen.has(key)) return;
          seen.add(key);
          permissionRows.push({
            key,
            scopeType: "resource_action",
            resource,
            action,
            menuKey: null,
            label: `${resource} ${action}`,
            createdAt: now,
            updatedAt: now,
          });
        });
      });

      (roleConfig.menu || []).forEach((menuKey) => {
        const key = `menu.${menuKey}`;
        if (seen.has(key)) return;
        seen.add(key);
        permissionRows.push({
          key,
          scopeType: "menu",
          resource: null,
          action: null,
          menuKey,
          label: `menu ${menuKey}`,
          createdAt: now,
          updatedAt: now,
        });
      });
    });

    if (permissionRows.length > 0) {
      await queryInterface.bulkInsert("Permissions", permissionRows);
    }

    const [permissions] = await queryInterface.sequelize.query(
      "SELECT id, `key` FROM `Permissions`"
    );
    const permissionByKey = new Map(permissions.map((p) => [p.key, p.id]));

    const [users] = await queryInterface.sequelize.query(
      "SELECT id, role FROM `Users` WHERE role <> 'admin'"
    );

    const userPermissionRows = [];
    users.forEach((user) => {
      const baseline = ROLE_BASELINE[user.role] || { resources: {}, menu: [] };
      Object.entries(baseline.resources || {}).forEach(([resource, actions]) => {
        actions.forEach((action) => {
          const permissionId = permissionByKey.get(`${resource}.${action}`);
          if (!permissionId) return;
          userPermissionRows.push({
            userId: user.id,
            permissionId,
            allowed: true,
            createdAt: now,
            updatedAt: now,
          });
        });
      });
      (baseline.menu || []).forEach((menuKey) => {
        const permissionId = permissionByKey.get(`menu.${menuKey}`);
        if (!permissionId) return;
        userPermissionRows.push({
          userId: user.id,
          permissionId,
          allowed: true,
          createdAt: now,
          updatedAt: now,
        });
      });
    });

    if (userPermissionRows.length > 0) {
      await queryInterface.bulkInsert("UserPermissions", userPermissionRows);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("UserPermissions");
    await queryInterface.dropTable("Permissions");
  },
};


"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("priceListUploads", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      vendorName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fileName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      originalName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      filePath: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("completed", "failed"),
        allowNull: false,
        defaultValue: "completed",
      },
      productCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      uploadedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      catalogVersion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex("priceListUploads", ["vendorName"], {
      name: "price_list_uploads_vendor_name",
    });
    await queryInterface.addIndex("priceListUploads", ["isActive"], {
      name: "price_list_uploads_is_active",
    });
    await queryInterface.addIndex("priceListUploads", ["catalogVersion"], {
      name: "price_list_uploads_catalog_version",
    });

    await queryInterface.createTable("priceListOffers", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      priceListUploadId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "priceListUploads",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      vendorName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      upc: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      brand: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      productName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      availableQty: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      identityKey: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      searchText: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex("priceListOffers", ["priceListUploadId"], {
      name: "price_list_offers_upload_id",
    });
    await queryInterface.addIndex("priceListOffers", ["vendorName"], {
      name: "price_list_offers_vendor_name",
    });
    await queryInterface.addIndex("priceListOffers", ["upc"], {
      name: "price_list_offers_upc",
    });
    await queryInterface.addIndex("priceListOffers", ["identityKey"], {
      name: "price_list_offers_identity_key",
    });

    await queryInterface.createTable("priceListCartState", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      activeCatalogVersion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      cartCatalogVersion: {
        type: Sequelize.INTEGER,
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

    await queryInterface.createTable("priceListCartItems", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      vendorName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      identityKey: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      upc: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      brand: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      productName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      availableQty: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      sourceUploadId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "priceListUploads",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      lastUpdatedBy: {
        type: Sequelize.INTEGER,
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

    await queryInterface.addIndex("priceListCartItems", ["vendorName"], {
      name: "price_list_cart_items_vendor_name",
    });
    await queryInterface.addIndex("priceListCartItems", ["vendorName", "identityKey"], {
      name: "price_list_cart_items_vendor_identity",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("priceListCartItems");
    await queryInterface.dropTable("priceListCartState");
    await queryInterface.dropTable("priceListOffers");
    await queryInterface.dropTable("priceListUploads");
  },
};

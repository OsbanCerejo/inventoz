'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('whatnotShipmentImports', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      whatnotShowId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      fileName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      uploadedBy: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      totalRows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      totalShipments: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      readyShipments: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      pendingReviewShipments: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addConstraint('whatnotShipmentImports', {
      fields: ['whatnotShowId'],
      type: 'foreign key',
      name: 'fk_whatnot_shipment_import_show_id',
      references: {
        table: 'whatnotShows',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addIndex('whatnotShipmentImports', ['whatnotShowId']);
    await queryInterface.addIndex('whatnotShipmentImports', ['whatnotShowId', 'isActive']);

    await queryInterface.createTable('whatnotShipmentItems', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      whatnotShowId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      importId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      shipmentId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tracking: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      stickerNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      expectedQty: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      scannedQty: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM('ready', 'in_progress', 'completed', 'pending_review'),
        allowNull: false,
        defaultValue: 'ready',
      },
      mismatchReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      buyer: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      orderId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      orderNumericId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addConstraint('whatnotShipmentItems', {
      fields: ['whatnotShowId'],
      type: 'foreign key',
      name: 'fk_whatnot_shipment_item_show_id',
      references: {
        table: 'whatnotShows',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('whatnotShipmentItems', {
      fields: ['importId'],
      type: 'foreign key',
      name: 'fk_whatnot_shipment_item_import_id',
      references: {
        table: 'whatnotShipmentImports',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addIndex('whatnotShipmentItems', ['whatnotShowId', 'importId']);
    await queryInterface.addIndex('whatnotShipmentItems', ['shipmentId']);
    await queryInterface.addIndex('whatnotShipmentItems', ['tracking']);
    await queryInterface.addIndex('whatnotShipmentItems', ['status']);
    await queryInterface.addIndex('whatnotShipmentItems', ['shipmentId', 'stickerNumber']);

    await queryInterface.createTable('whatnotShipmentScans', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      whatnotShowId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      importId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      shipmentId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tracking: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      scannedValue: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      scanType: {
        type: Sequelize.ENUM('tracking', 'item'),
        allowNull: false,
      },
      result: {
        type: Sequelize.ENUM(
          'matched',
          'shipment_loaded',
          'shipment_not_found',
          'tracking_conflict',
          'pending_review_blocked',
          'duplicate',
          'unexpected'
        ),
        allowNull: false,
      },
      message: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addConstraint('whatnotShipmentScans', {
      fields: ['whatnotShowId'],
      type: 'foreign key',
      name: 'fk_whatnot_shipment_scan_show_id',
      references: {
        table: 'whatnotShows',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('whatnotShipmentScans', {
      fields: ['importId'],
      type: 'foreign key',
      name: 'fk_whatnot_shipment_scan_import_id',
      references: {
        table: 'whatnotShipmentImports',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('whatnotShipmentScans', ['whatnotShowId', 'createdAt']);
    await queryInterface.addIndex('whatnotShipmentScans', ['shipmentId']);
    await queryInterface.addIndex('whatnotShipmentScans', ['tracking']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('whatnotShipmentScans');
    await queryInterface.dropTable('whatnotShipmentItems');
    await queryInterface.dropTable('whatnotShipmentImports');
  },
};

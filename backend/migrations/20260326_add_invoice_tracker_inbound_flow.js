'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const invoiceTable = await queryInterface.describeTable('invoiceTrackerInvoices');

    if (!invoiceTable.inboundCompletedAt) {
      await queryInterface.addColumn('invoiceTrackerInvoices', 'inboundCompletedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!invoiceTable.inboundCompletedBy) {
      await queryInterface.addColumn('invoiceTrackerInvoices', 'inboundCompletedBy', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (invoiceTable.inboundStatus) {
      await queryInterface.changeColumn('invoiceTrackerInvoices', 'inboundStatus', {
        type: Sequelize.ENUM('pending', 'partial', 'done'),
        allowNull: false,
        defaultValue: 'pending',
      });
    }

    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.TABLE_NAME));

    if (!normalizedTables.includes('invoiceTrackerInboundBatches')) {
      await queryInterface.createTable('invoiceTrackerInboundBatches', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        invoiceId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'invoiceTrackerInvoices',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        rowCount: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        submittedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onDelete: 'SET NULL',
        },
        submittedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
      await queryInterface.addIndex('invoiceTrackerInboundBatches', ['invoiceId']);
    }

    if (!normalizedTables.includes('invoiceTrackerInboundRows')) {
      await queryInterface.createTable('invoiceTrackerInboundRows', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        invoiceId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'invoiceTrackerInvoices',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        batchId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'invoiceTrackerInboundBatches',
            key: 'id',
          },
          onDelete: 'SET NULL',
        },
        sku: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        itemName: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        unitPrice: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },
        expectedQty: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        actualQty: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        deltaQty: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        resolutionStatus: {
          type: Sequelize.ENUM('pending', 'resolved', 'inbounded'),
          allowNull: false,
          defaultValue: 'pending',
        },
        resolutionType: {
          type: Sequelize.ENUM('match', 'mismatch'),
          allowNull: true,
        },
        mismatchReason: {
          type: Sequelize.ENUM('short_shipped', 'damaged', 'backordered', 'not_in_carton', 'counting_error', 'overage'),
          allowNull: true,
        },
        inboundedQty: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        inboundCompositeSku: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        resolvedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onDelete: 'SET NULL',
        },
        resolvedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        inboundedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onDelete: 'SET NULL',
        },
        inboundedAt: {
          type: Sequelize.DATE,
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
      await queryInterface.addIndex('invoiceTrackerInboundRows', ['invoiceId']);
      await queryInterface.addIndex('invoiceTrackerInboundRows', ['batchId']);
      await queryInterface.addIndex('invoiceTrackerInboundRows', ['resolutionStatus']);
    }
  },

  async down(queryInterface) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.TABLE_NAME));

    if (normalizedTables.includes('invoiceTrackerInboundRows')) {
      await queryInterface.dropTable('invoiceTrackerInboundRows');
    }
    if (normalizedTables.includes('invoiceTrackerInboundBatches')) {
      await queryInterface.dropTable('invoiceTrackerInboundBatches');
    }

    const invoiceTable = await queryInterface.describeTable('invoiceTrackerInvoices');
    if (invoiceTable.inboundCompletedBy) {
      await queryInterface.removeColumn('invoiceTrackerInvoices', 'inboundCompletedBy');
    }
    if (invoiceTable.inboundCompletedAt) {
      await queryInterface.removeColumn('invoiceTrackerInvoices', 'inboundCompletedAt');
    }
    if (invoiceTable.inboundStatus) {
      await queryInterface.changeColumn('invoiceTrackerInvoices', 'inboundStatus', {
        type: Sequelize.ENUM('pending', 'done'),
        allowNull: false,
        defaultValue: 'pending',
      });
    }
  },
};

module.exports = (sequelize, DataTypes) => {
  const Logs = sequelize.define(
    "Logs",
    {
      timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'The specific action performed (e.g., "create", "update", "delete")'
      },
      entityType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'The type of entity being logged (e.g., "product", "product_details", "listings")'
      },
      entityId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'The identifier of the entity (e.g., SKU for products)'
      },
      changes: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'The specific changes made to the entity'
      },
      previousState: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'The previous state of the entity before changes'
      },
      newState: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'The new state of the entity after changes'
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'The ID of the user who performed the action'
      },
      metaData: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional metadata about the action'
      }
    },
    {
      timestamps: true,
      indexes: [
        {
          fields: ['timestamp']
        },
        {
          fields: ['type']
        },
        {
          fields: ['entityType']
        },
        {
          fields: ['entityId']
        }
      ]
    }
  );

  return Logs;
};

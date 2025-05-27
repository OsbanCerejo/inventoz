module.exports = (sequelize, DataTypes) => {
    const EbayOrders = sequelize.define("EbayOrders", {
        orderId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        lineItemId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        sku: {
            type: DataTypes.STRING,
            allowNull: false
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        orderStatus: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'UNKNOWN'
        },
        creationDate: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW
        },
        lastModifiedDate: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW
        },
        buyerUsername: {
            type: DataTypes.STRING,
            allowNull: true
        },
        totalAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0
        },
        currency: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'USD'
        },
        shippingAddress: {
            type: DataTypes.JSON,
            allowNull: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: true
        },
        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0
        },
        logs: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        timestamps: true,
        indexes: [
            {
                fields: ['sku']
            },
            {
                fields: ['creationDate']
            },
            {
                fields: ['orderStatus']
            }
        ]
    });

    EbayOrders.removeAttribute('id');
    EbayOrders.primaryKeys = ['orderId', 'lineItemId'];

    return EbayOrders;
}; 
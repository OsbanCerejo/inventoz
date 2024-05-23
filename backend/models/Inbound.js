module.exports = (sequelize, DataTypes) => {

    const Inbound = sequelize.define("Inbound", {
        sku: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        quantity: {
            type: DataTypes.STRING,
            allowNull: false
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        batch: {
            type: DataTypes.STRING,
            allowNull: true
        },
        vendor: {
            type: DataTypes.STRING,
            allowNull: true
        },
        compositeSku: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        }
    }, {
        timestamps: false
    });

    return Inbound;
}
module.exports = (sequelize, DataTypes) => {

    const Inbound = sequelize.define("Inbound", {
        sku: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        vendor: {
            type: DataTypes.STRING,
            allowNull: true
        },
        quantity: {
            type: DataTypes.STRING,
            allowNull: false
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false,
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
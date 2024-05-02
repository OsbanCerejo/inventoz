module.exports = (sequelize, DataTypes) => {

    const Sales = sequelize.define("Sales", {
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
        compositeSalesSku: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        }
    }, {
        timestamps: false
    });

    return Sales;
}
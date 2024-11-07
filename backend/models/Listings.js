module.exports = (sequelize, DataTypes) => {

    const Listings = sequelize.define("Listings", {
        sku: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        ebayBuy4LessToday: {
            type: DataTypes.INTEGER,
        },
        ebayOneLifeLuxuries4: {
            type: DataTypes.INTEGER,
        },
        walmartOneLifeLuxuries: {
            type: DataTypes.INTEGER,
        },
    }, {
        timestamps: false
    });

    Listings.associate = (models) => {
        Listings.belongsTo(models.Products, { foreignKey: "sku" });
      };

    return Listings;
}
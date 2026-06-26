module.exports = (sequelize, DataTypes) => {
  const ProductFragranceNote = sequelize.define(
    'ProductFragranceNote',
    {
      productSku: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
      noteId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
      tier: { type: DataTypes.ENUM('top', 'middle', 'base'), allowNull: false, primaryKey: true },
    },
    { timestamps: false, tableName: 'product_fragrance_notes' }
  );

  ProductFragranceNote.associate = (models) => {
    ProductFragranceNote.belongsTo(models.Products, { foreignKey: 'productSku', targetKey: 'sku' });
    ProductFragranceNote.belongsTo(models.FragranceNote, { foreignKey: 'noteId', as: 'note' });
  };

  return ProductFragranceNote;
};

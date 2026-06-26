module.exports = (sequelize, DataTypes) => {
  const FragranceNote = sequelize.define(
    'FragranceNote',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    },
    { timestamps: false, tableName: 'fragrance_notes' }
  );

  FragranceNote.associate = (models) => {
    FragranceNote.hasMany(models.ProductFragranceNote, { foreignKey: 'noteId', as: 'productNotes' });
  };

  return FragranceNote;
};

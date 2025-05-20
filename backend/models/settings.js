'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Settings extends Model {
    static associate(models) {
      // define associations here if needed
    }
  }
  
  Settings.init({
    whatnot_menu_pass: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '1234'
    }
  }, {
    sequelize,
    modelName: 'Settings',
    tableName: 'settings',
    timestamps: true
  });
  
  return Settings;
}; 
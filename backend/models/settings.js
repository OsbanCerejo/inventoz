'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Settings extends Model {
    static associate(models) {
      // define associations here if needed
    }
  }
  
  Settings.init({
    whatnot_username: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'admin'
    },
    whatnot_password: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '1234'
    },
    data_entry_fields: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
  }, {
    sequelize,
    modelName: 'Settings',
    tableName: 'settings',
    timestamps: true
  });
  
  return Settings;
}; 

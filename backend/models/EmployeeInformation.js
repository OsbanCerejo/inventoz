'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmployeeInformation extends Model {
    static associate(models) {
      // define associations here if needed
    }
  }
  
  EmployeeInformation.init({
    firstName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    photoIdPath: {
      type: DataTypes.STRING,
      allowNull: false
    },
    termsAndConditionsSigned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    termsAndConditionsDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    additionalDocuments: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'EmployeeInformation',
    tableName: 'employee_information',
    timestamps: true
  });
  
  return EmployeeInformation;
}; 
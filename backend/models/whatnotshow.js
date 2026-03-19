'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WhatnotShow = sequelize.define('WhatnotShow', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'whatnotShows',
    timestamps: true,
    indexes: [
      {
        fields: ['isActive']
      }
    ]
  });

  WhatnotShow.associate = (models) => {
    WhatnotShow.hasMany(models.WhatnotLog, {
      foreignKey: 'whatnotShowId',
      as: 'logs'
    });
  };

  return WhatnotShow;
};

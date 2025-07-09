const { User } = require('../models');
const { Sequelize } = require('sequelize');
const dbConfig = require('../config/databaseConfig');

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    logging: false
  }
);

async function updateAdminRole() {
  try {
    await sequelize.authenticate();

    // Find users with old role format
    const users = await User.findAll();

    // Update admin users to new role format
    const adminUsers = await User.findAll({
      where: {
        role: 'admin'
      }
    });

    if (adminUsers.length > 0) {
      for (const user of adminUsers) {
      }
    } else {
    }

    // Check if there are any users with old 'user' role that should be updated to 'listing'
    const oldUserRoleUsers = await User.findAll({
      where: {
        role: 'user'
      }
    });

    if (oldUserRoleUsers.length > 0) {
      for (const user of oldUserRoleUsers) {
        await user.update({ role: 'listing' });
      }
    }

  } catch (error) {
    console.error('Error updating admin role:', error);
  } finally {
    await sequelize.close();
  }
}

updateAdminRole(); 
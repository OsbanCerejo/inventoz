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
    console.log('Connected to database successfully.');

    // Find users with old role format
    const users = await User.findAll();
    console.log('Current users:');
    users.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
    });

    // Update admin users to new role format
    const adminUsers = await User.findAll({
      where: {
        role: 'admin'
      }
    });

    if (adminUsers.length > 0) {
      console.log(`Found ${adminUsers.length} admin user(s)`);
      for (const user of adminUsers) {
        console.log(`Admin user: ${user.username} (ID: ${user.id})`);
      }
    } else {
      console.log('No admin users found. You may need to create one or update an existing user to admin role.');
    }

    // Check if there are any users with old 'user' role that should be updated to 'listing'
    const oldUserRoleUsers = await User.findAll({
      where: {
        role: 'user'
      }
    });

    if (oldUserRoleUsers.length > 0) {
      console.log(`Found ${oldUserRoleUsers.length} user(s) with old 'user' role. Updating to 'listing'...`);
      for (const user of oldUserRoleUsers) {
        await user.update({ role: 'listing' });
        console.log(`Updated ${user.username} role from 'user' to 'listing'`);
      }
    }

    console.log('Role update completed.');
  } catch (error) {
    console.error('Error updating admin role:', error);
  } finally {
    await sequelize.close();
  }
}

updateAdminRole(); 
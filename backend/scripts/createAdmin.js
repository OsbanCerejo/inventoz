require('dotenv').config();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: process.env.DB_DIALECT || 'mysql',
  timezone: process.env.DB_TIMEZONE || '-04:00',
  define: {
    charset: process.env.DB_CHARSET || 'utf8mb4',
    collate: process.env.DB_COLLATE || 'utf8mb4_unicode_ci'
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createAdminUser() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database successfully.');

    rl.question('Enter admin username: ', async (username) => {
      rl.question('Enter admin email: ', async (email) => {
        rl.question('Enter admin password: ', async (password) => {
          try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            await sequelize.query(`
              INSERT INTO Users (username, email, password, role, createdAt, updatedAt)
              VALUES (?, ?, ?, 'admin', NOW(), NOW())
            `, {
              replacements: [username, email, hashedPassword]
            });

            console.log('Admin user created successfully!');
            rl.close();
            process.exit(0);
          } catch (error) {
            console.error('Error creating admin user:', error);
            rl.close();
            process.exit(1);
          }
        });
      });
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
}

createAdminUser(); 
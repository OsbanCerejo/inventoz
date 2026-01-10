require('dotenv').config();
const environment = process.env.NODE_ENV || "development";

const config = {
  development: {
    username: process.env.DB_USERNAME || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "inventoz",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: process.env.DB_DIALECT || "mysql",
    timezone: process.env.DB_TIMEZONE || "-04:00",
    define: {
      charset: process.env.DB_CHARSET || "utf8mb4",
      collate: process.env.DB_COLLATE || "utf8mb4_unicode_ci"
    }
  },
  production: {
    username: process.env.DB_USERNAME || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "inventoz",
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: process.env.DB_DIALECT || "mysql",
    timezone: process.env.DB_TIMEZONE || "-04:00",
    define: {
      charset: process.env.DB_CHARSET || "utf8mb4",
      collate: process.env.DB_COLLATE || "utf8mb4_unicode_ci"
    }
  }
};

module.exports = config; 
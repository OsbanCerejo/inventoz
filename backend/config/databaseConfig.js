const config = require("./config.json");

const environment = process.env.NODE_ENV || "development";
const dbConfig = config[environment];

module.exports = dbConfig;

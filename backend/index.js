const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { Sequelize } = require("sequelize");
const dbConfig = require("./config/databaseConfig");
const db = require("./models");
const stockUpdateCron = require("./cron/stockUpdate");
const orderProcessingCron = require("./cron/orderProcessing");

app.use(express.json());
app.use(cors());

// Database configuration
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
  }
);

//Routers
const productRouter = require("./routes/Products");
app.use("/products", productRouter);

const productDetailsRouter = require("./routes/ProductDetails");
app.use("/productDetails", productDetailsRouter);

const inboundRouter = require("./routes/Inbound");
app.use("/inbound", inboundRouter);

const salesRouter = require("./routes/Sales");
app.use("/sales", salesRouter);

const brandsRouter = require("./routes/Brands");
app.use("/brands", brandsRouter);

const ordersRouter = require("./routes/Orders");
app.use("/orders", ordersRouter);

const sephoraRouter = require("./routes/Sephora");
app.use("/sephora", sephoraRouter);

const logsRouter = require("./routes/Logs");
app.use("/logs", logsRouter);

const listingsRouter = require("./routes/Listings");
app.use("/listings", listingsRouter);

const priceListParserRouter = require("./routes/PricelistParser");
app.use("/priceListParser", priceListParserRouter);

const ebayApiRouter = require("./routes/EbayAPI");
app.use("/ebayAPI", ebayApiRouter);

const ebayOrdersRouter = require("./routes/EbayOrders");
app.use("/ebayOrders", ebayOrdersRouter);

sequelize
  .authenticate()
  .then(() => {
    console.log("Connection to Database has been established successfully.");
    return db.sequelize.sync();
  })
  .then(() => {
    // Initialize cron jobs
    console.log("Initializing cron jobs...");
    stockUpdateCron;
    orderProcessingCron;
    
    app.listen(process.env.PORT, '0.0.0.0', () => {
      console.log(`Server is running on http://${process.env.SERVER_IP}:${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

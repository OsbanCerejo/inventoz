const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { Sequelize } = require("sequelize");
const db = require("./models");
const stockUpdateCron = require("./cron/stockUpdate");
const orderProcessingCron = require("./cron/orderProcessing");
const path = require("path");

app.use(express.json());

// CORS configuration for production domains
const corsOptions = {
  origin: true, // Allow all origins temporarily for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Additional CORS headers for preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://inventoz-frontend.lprpnx.easypanel.host');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  
  next();
});

// Database connection is handled in models/index.js
const sequelize = db.sequelize;

// Authentication routes
const authRouter = require("./routes/auth");
app.use("/auth", authRouter);

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

const whatnotRouter = require("./routes/whatnot");
app.use("/whatnot", whatnotRouter);

const priceListRouter = require("./routes/priceList");
app.use("/api/price-list", priceListRouter);

const employeeInfoRouter = require("./routes/EmployeeInformation");
app.use("/api/employee-info", employeeInfoRouter);

const usersRouter = require("./routes/Users");
app.use("/api/users", usersRouter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint (no database required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint for CORS debugging
app.get('/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin
  });
});

// Start server even if database connection fails
const startServer = () => {
  const port = process.env.PORT || 3000;
  console.log(`Environment variables:`);
  console.log(`- PORT: ${process.env.PORT || 'not set (using default 3000)'}`);
  console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`- DB_HOST: ${process.env.DB_HOST || 'not set'}`);
  console.log(`Attempting to start server on port ${port}...`);
  
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Server URL: http://0.0.0.0:${port}`);
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
};

// Try to connect to database, but start server regardless
sequelize
  .authenticate()
  .then(() => {
    console.log("Connection to Database has been established successfully.");
    return db.sequelize.sync();
  })
  .then(() => {
    console.log("Database synchronized successfully.");
    // Initialize cron jobs
    console.log("Initializing cron jobs...");
    // stockUpdateCron;
    // orderProcessingCron;
    
    startServer();
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
    console.log("Starting server without database connection...");
    startServer();
  });

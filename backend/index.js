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

// CORS configuration for allowed domains
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://inventoz-frontend.lprpnx.easypanel.host',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin requests with no Origin header
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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

const barcodeScanRouter = require("./routes/BarcodeScan");
app.use("/api/barcode-scan", barcodeScanRouter);

const productVendorPricesRouter = require("./routes/ProductVendorPrices");
app.use("/product-vendor-prices", productVendorPricesRouter);

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
  // Use a single, predictable port; configure this in EasyPanel
  const port = Number(process.env.PORT) || 3000;

  console.log(`Environment variables:`);
  console.log(`- PORT: ${process.env.PORT || 'not set'}`);
  console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`- DB_HOST: ${process.env.DB_HOST || 'not set'}`);
  console.log(`Attempting to start server on port ${port}...`);

  const server = app
    .listen(port, '0.0.0.0', () => {
      console.log(`✅ Server is running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Server URL: http://0.0.0.0:${port}`);
    })
    .on('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
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

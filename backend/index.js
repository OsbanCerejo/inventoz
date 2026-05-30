const express = require("express");
const app = express();
app.set('trust proxy', true);
const cors = require("cors");
require("dotenv").config();
const { Sequelize } = require("sequelize");
const db = require("./models");
const stockUpdateCron = require("./cron/stockUpdate");
const orderProcessingCron = require("./cron/orderProcessing");
const invoiceTrackerPaymentReminderCron = require("./cron/invoiceTrackerPaymentReminders");
const path = require("path");

app.use(express.json());

const validateCriticalEnv = () => {
  if (process.env.NODE_ENV !== "production") return;
  const requiredVars = ["JWT_SECRET", "JWT_REFRESH_SECRET"];
  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required production env variables: ${missing.join(", ")}`);
  }
};

validateCriticalEnv();

// CORS configuration for allowed domains
const envOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://inventoz-frontend.lprpnx.easypanel.host',
  'https://inventoz-backend.lprpnx.easypanel.host',
  'https://orders.hbadeals.com',
  ...envOrigins,
];

const allowedOriginSet = new Set(allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin requests with no Origin header
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOriginSet.has(origin)) {
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

const whatnotFulfillmentRouter = require("./routes/whatnotFulfillment");
app.use("/whatnot/fulfillment", whatnotFulfillmentRouter);

const whatnotAnalyticsRouter = require("./routes/whatnotAnalytics");
app.use("/whatnot/analytics", whatnotAnalyticsRouter);

const tiktokRouter = require("./routes/tiktok");
app.use("/tiktok", tiktokRouter);

const tiktokFulfillmentRouter = require("./routes/tiktokFulfillment");
app.use("/tiktok/fulfillment", tiktokFulfillmentRouter);

const walmartIntegrationRouter = require("./routes/WalmartIntegration");
app.use("/walmart-integration", walmartIntegrationRouter);

const walmartOrdersRouter = require("./routes/WalmartOrders");
app.use("/walmart-orders", walmartOrdersRouter);

const walmartProductsRouter = require("./routes/WalmartProducts");
app.use("/walmart-products", walmartProductsRouter);

const priceListRouter = require("./routes/priceList");
app.use("/api/price-list", priceListRouter);

const usersRouter = require("./routes/Users");
app.use("/api/users", usersRouter);

const barcodeScanRouter = require("./routes/BarcodeScan");
app.use("/api/barcode-scan", barcodeScanRouter);

const productVendorPricesRouter = require("./routes/ProductVendorPrices");
app.use("/product-vendor-prices", productVendorPricesRouter);

const ticketsRouter = require("./routes/Tickets");
app.use("/tickets", ticketsRouter);

const invoiceTrackerRouter = require("./routes/InvoiceTracker");
app.use("/invoice-tracker", invoiceTrackerRouter);

const hbaOrdersRouter = require("./routes/HbaOrders");
app.use("/hba-orders", hbaOrdersRouter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public', 'hba-site')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hba-site', 'index.html'));
});
app.get('/hba-site', (req, res) => {
  res.redirect(301, '/');
});
app.get('/hba-site/*', (req, res) => {
  res.redirect(301, '/');
});

// Health check endpoint (no database required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    buildId: process.env.APP_BUILD_ID || process.env.SOURCE_VERSION || process.env.npm_package_version || "development",
  });
});

app.get('/meta/version', (req, res) => {
  res.json({
    buildId: process.env.APP_BUILD_ID || process.env.SOURCE_VERSION || process.env.npm_package_version || "development",
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
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
    // invoiceTrackerPaymentReminderCron;
    
    startServer();
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
    console.log("Starting server without database connection...");
    startServer();
  });

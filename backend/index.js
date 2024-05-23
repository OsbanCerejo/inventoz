const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const sequelize = require("./config/database");

app.use(express.json());
app.use(cors());

//Routers
const productRouter = require("./routes/Products");
app.use("/products", productRouter);

const inboundRouter = require("./routes/Inbound");
app.use("/inbound", inboundRouter);

const salesRouter = require("./routes/Sales");
app.use("/sales", salesRouter);

const listingsRouter = require("./routes/Listings");
app.use("/listings", listingsRouter);

const brandsRouter = require("./routes/Brands");
app.use("/brands", brandsRouter);

const ordersRouter = require("./routes/Orders");
app.use("/orders", ordersRouter);

sequelize
  .authenticate()
  .then(() => {
    console.log(
      "Connection to AWS Database has been established successfully."
    );
    return sequelize.sync();
  })
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`Server is running on http://localhost:${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

const express = require('express');
const app = express();
const cors = require("cors");
const mysql = require("mysql");
require('dotenv').config()

app.use(express.json());
app.use(cors());

const db = require('./models');
const awsdb = mysql.createConnection({
    host: "database.cpgwowuq84pb.us-east-2.rds.amazonaws.com",
    port: "3306",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "inventory"
})


awsdb.connect((error) => {
    if(error) {
        console.log(error);
        return;
    } 
    console.log("Connected to AWS Database.");
})



//Routers
const productRouter = require('./routes/Products');
app.use("/products", productRouter);

const inboundRouter = require('./routes/Inbound');
app.use("/inbound", inboundRouter);

const salesRouter = require('./routes/Sales');
app.use("/sales", salesRouter);

const listingsRouter = require('./routes/Listings');
app.use("/listings", listingsRouter);

const brandsRouter = require('./routes/Brands');
app.use("/brands", brandsRouter);

const ordersRouter = require('./routes/Orders');
app.use("/orders", ordersRouter);

db.sequelize.sync().then(() => {
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on http://localhost:${process.env.PORT}`);
    });
});



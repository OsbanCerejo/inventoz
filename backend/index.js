const express = require('express');
const app = express();
const cors = require("cors");

app.use(express.json());
app.use(cors());

const db = require('./models');

//Routers
const productRouter = require('./routes/Products');
app.use("/products", productRouter);

db.sequelize.sync().then(() => {
    app.listen(3001, () => {
        console.log("Server is running on http://localhost:3001");
    });
});



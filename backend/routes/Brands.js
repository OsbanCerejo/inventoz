const express = require("express");
const router = express.Router();
const Sequelize = require("sequelize");
const { Brands } = require("../models");
const Op = Sequelize.Op;

router.get("/", async (req, res) => {
  const { brandName } = req.query;
  const nextNumber = await Brands.findAll({
    where: {
      brand: {
        [Op.like]: "%" + brandName + "%",
      },
    },
  });
  res.json(nextNumber);
});

router.put("/", async (req, res) => {
  const brandObject = req.body;
  // console.log("Edited Brand Value in Server : " , brandObject);
  await Brands.update(
    {
      nextNumber: brandObject.nextNumber,
    },
    { where: { id: brandObject.id } }
  );
  res.json("Updated Brand Object in Backend");
});

module.exports = router;
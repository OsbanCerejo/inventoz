const express = require("express");
const router = express.Router();
const { Logs } = require("../models");

router.post("/addLog", async (req, res) => {
  const logData = req.body;
  try {
    const newLog = await Logs.create(logData);
    res.status(200).send({ success: true });
  } catch (error) {
    console.error("Error saving log data:", error);
    res.status(500).send({ success: false, error: "Failed to save log data" });
  }
});

module.exports = router;

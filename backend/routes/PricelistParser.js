const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const uploadDir = "./uploads";

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

let uploadedData = [];

// Upload Excel files
router.post("/upload", upload.array("files"), (req, res) => {
  try {
    uploadedData = [];

    req.files.forEach((file) => {
      const filePath = path.join(uploadDir, file.filename);
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      data.forEach((row) => {
        if (row.UPC) {
          uploadedData.push({
            upc: row.UPC.toString().trim(),
            data: row,
            filename: file.filename,
          });
        }
      });
    });

    res.status(200).json({ message: "Files processed successfully!" });
  } catch (error) {
    console.error("Error processing files:", error);
    res.status(500).json({ error: "Failed to process files" });
  }
});

// Search by UPC
router.get("/search", (req, res) => {
  const { upc } = req.query;
  console.log("UPC Searched: ", upc);
  console.log("UPC SEARCHED IN FILE : ", uploadedData);
  if (!upc) {
    return res.status(400).json({ error: "UPC is required" });
  }

  const results = uploadedData.filter((entry) => entry.upc === upc);

  if (results.length > 0) {
    res.status(200).json(results);
  } else {
    res.status(404).json({ message: "No matching records found" });
  }
});

// Clear uploadedData on page refresh by adding an endpoint
router.get("/clearPriceLists", (req, res) => {
  uploadedData = [];
  res.status(200).json({ message: "Session data cleared successfully" });
});

// Remove data associated with deleted files
router.post("/removePriceLists", (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  // Remove entries belonging to the deleted file
  uploadedData = uploadedData.filter((entry) => entry.filename !== filename);

  res
    .status(200)
    .json({ message: `Data for ${filename} removed successfully` });
});

module.exports = router;

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ExcelParser = require("../utils/excelParser");

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
      
      // Parse Excel file with smart header detection
      const { headers, rows, headerMapping } = ExcelParser.parseExcel(filePath, {
        maxRowsToCheck: 30,
        minHeaderLength: 2
      });

      // Process rows with mapped headers
      rows.forEach((row) => {
        const mappedRow = {};
        Object.entries(row).forEach(([originalHeader, value]) => {
          const standardHeader = headerMapping[originalHeader];
          if (standardHeader === 'upc' || standardHeader === 'price') {
            mappedRow[standardHeader] = value;
          }
        });

        // Only add rows that have both UPC and price
        if (mappedRow.upc && mappedRow.price) {
          uploadedData.push({
            upc: mappedRow.upc.toString().trim(),
            price: parseFloat(mappedRow.price),
            filename: file.filename
          });
        }
      });
    });

    res.status(200).json({ 
      message: "Files processed successfully!",
      totalRecords: uploadedData.length
    });
  } catch (error) {
    console.error("Error processing files:", error);
    res.status(500).json({ error: "Failed to process files: " + error.message });
  }
});

// Search by UPC
router.get("/search", (req, res) => {
  const { upc } = req.query;
  if (!upc) {
    return res.status(400).json({ error: "UPC is required" });
  }

  const results = uploadedData.filter(item => item.upc === upc);
  res.json(results);
});

// Clear uploaded data
router.get("/clearPriceLists", (req, res) => {
  uploadedData = [];
  res.json({ message: "Price lists cleared successfully" });
});

// Remove specific file data
router.post("/removePriceLists", (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  uploadedData = uploadedData.filter(item => item.filename !== filename);
  res.json({ message: "Price list removed successfully" });
});

module.exports = router;

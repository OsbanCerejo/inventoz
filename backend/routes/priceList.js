const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { PriceListFile, PriceListProduct } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../models');
const ExcelParser = require('../utils/excelParser');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
});

// Upload price list file
router.post('/upload-file', auth, checkPermission('pricelist', 'create'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { customName } = req.body;
    if (!customName) {
      return res.status(400).json({ error: 'Custom name is required' });
    }

    const priceListFile = await PriceListFile.create({
      fileName: req.file.filename,
      originalName: req.file.originalname,
      customName,
      filePath: req.file.path,
      status: 'pending'
    });

    res.json(priceListFile);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get all price list files
router.get('/files', auth, checkPermission('pricelist', 'view'), async (req, res) => {
  try {
    const files = await PriceListFile.findAll({
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'customName', 'productCount', 'status', 'createdAt']
    });
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get file headers
router.get('/file/:id/headers', auth, checkPermission('pricelist', 'view'), async (req, res) => {
  try {
    const file = await PriceListFile.findByPk(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { headers, headerRowIndex } = ExcelParser.parseExcel(file.filePath, {
      maxRowsToCheck: 30
    });

    res.json({
      headers,
      headerRowIndex,
      message: `Headers found in row ${headerRowIndex + 1}`
    });
  } catch (error) {
    console.error('Error reading headers:', error);
    res.status(500).json({ error: 'Failed to read headers' });
  }
});

// Update header mapping
router.put('/file/:id/mapping', auth, checkPermission('pricelist', 'edit'), async (req, res) => {
  try {
    const { mapping } = req.body;
    const file = await PriceListFile.findByPk(req.params.id);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Validate required mappings
    const requiredFields = ['upc', 'productName', 'price'];
    const missingFields = requiredFields.filter(field => !mapping[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required mappings: ${missingFields.join(', ')}` 
      });
    }

    await file.update({
      headerMapping: mapping,
      status: 'processing'
    });

    // Process the file in the background
    processFile(file.id).catch(console.error);

    res.json(file);
  } catch (error) {
    console.error('Error updating mapping:', error);
    res.status(500).json({ error: 'Failed to update mapping' });
  }
});

// Search products
router.get('/search-products', auth, checkPermission('pricelist', 'view'), async (req, res) => {
  try {
    const { query } = req.query;
    const where = {};
    
    if (query) {
      where[Op.or] = [
        { productName: { [Op.like]: `%${query}%` } },
        { upc: { [Op.like]: `%${query}%` } }
      ];
    }

    const products = await PriceListProduct.findAll({
      where,
      include: [{
        model: PriceListFile,
        as: 'priceListFile',
        attributes: ['customName']
      }],
      order: [['productName', 'ASC']]
    });

    res.json(products);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Delete price list file and associated products
router.delete('/file/:id', auth, checkPermission('pricelist', 'delete'), async (req, res) => {
  try {
    const file = await PriceListFile.findByPk(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Start a transaction to ensure data consistency
    const result = await sequelize.transaction(async (t) => {
      // Delete associated products first
      const deletedProducts = await PriceListProduct.destroy({
        where: { priceListFileId: file.id },
        transaction: t
      });

      // Delete the file from storage
      if (fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }

      // Delete the database record
      await file.destroy({ transaction: t });

      return { deletedProducts };
    });

    res.json({ 
      message: 'File and associated products deleted successfully',
      deletedProducts: result.deletedProducts
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Helper function to process the file
async function processFile(fileId) {
  let file;
  try {
    file = await PriceListFile.findByPk(fileId);
    if (!file) return;

    const { rows } = ExcelParser.parseExcel(file.filePath, {
      maxRowsToCheck: 30
    });

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const row of rows) {
      try {
        // Map the data according to header mapping
        const mappedData = {
          productName: row[file.headerMapping.productName],
          upc: row[file.headerMapping.upc] || '',
          price: row[file.headerMapping.price],
          priceListFileId: file.id
        };

        // Validate the data
        const validationErrors = [];
        
        // Product name is mandatory
        if (!mappedData.productName || String(mappedData.productName).trim() === '') {
          validationErrors.push('Product name is required');
        }

        // Price is mandatory and must be a valid number
        if (!mappedData.price || isNaN(mappedData.price) || Number(mappedData.price) <= 0) {
          validationErrors.push('Valid price is required');
        }

        // UPC is optional but if provided must be valid
        if (mappedData.upc) {
          const upcStr = String(mappedData.upc).trim();
          if (upcStr !== '' && !ExcelParser.isUPC(upcStr)) {
            validationErrors.push('Invalid UPC format');
          }
        }

        if (validationErrors.length > 0) {
          // Skip invalid rows instead of failing
          skippedCount++;
          errors.push(`Row skipped: ${validationErrors.join(', ')}`);
          continue;
        }

        await PriceListProduct.create(mappedData);
        successCount++;
      } catch (error) {
        console.error('Error processing row:', error);
        errorCount++;
        errors.push(`Error processing row: ${error.message}`);
      }
    }

    // Update file status based on results
    let status = 'completed';
    if (successCount === 0) {
      status = 'failed';
    } else if (errorCount > 0) {
      status = 'failed';
    } else if (skippedCount > 0) {
      status = 'completed'; // Changed from 'failed' to 'completed' if we have successful imports
    }

    await file.update({
      status,
      productCount: successCount,
      errorCount,
      skippedCount,
      errors: errors.length > 0 ? errors : null
    });

    return {
      success: true,
      message: `Processed ${successCount} rows successfully. ${skippedCount} rows skipped. ${errorCount} errors.`,
      status,
      successCount,
      errorCount,
      skippedCount
    };
  } catch (error) {
    console.error('Error processing file:', error);
    if (file) {
      await file.update({
        status: 'failed',
        error: error.message
      });
    }
  }
}

// Process file endpoint
router.post('/process-file', async (req, res) => {
  try {
    const { fileId } = req.body;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    const result = await processFile(fileId);
    res.json(result);
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: error.message || 'Failed to process file' });
  }
});

module.exports = router; 
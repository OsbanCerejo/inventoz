const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { EmployeeInformation, Settings } = require('../models');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/employee_documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Verify admin credentials
router.post('/verify-admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    const settings = await Settings.findOne({
      where: {
        employee_info_username: username,
        employee_info_password: password
      }
    });
    
    if (!settings) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit new employee information
router.post('/submit', upload.single('photoId'), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      termsAndConditionsSigned
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Photo ID is required' });
    }

    const employeeInfo = await EmployeeInformation.create({
      firstName,
      lastName,
      email,
      phone,
      address,
      photoIdPath: req.file.path,
      termsAndConditionsSigned: termsAndConditionsSigned === 'true',
      termsAndConditionsDate: termsAndConditionsSigned === 'true' ? new Date() : null
    });

    res.status(201).json(employeeInfo);
  } catch (error) {
    res.status(500).json({ error: 'Error submitting employee information' });
  }
});

// Get all employee information
router.get('/all', async (req, res) => {
  try {
    const employees = await EmployeeInformation.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching employee information' });
  }
});

// Update employee status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const employee = await EmployeeInformation.findByPk(id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    await employee.update({ status });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Error updating employee status' });
  }
});

// Upload additional documents
router.post('/:id/documents', upload.array('documents', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await EmployeeInformation.findByPk(id);
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const documents = req.files.map(file => ({
      name: file.originalname,
      path: file.path,
      uploadedAt: new Date()
    }));

    const additionalDocuments = employee.additionalDocuments || [];
    additionalDocuments.push(...documents);

    await employee.update({ additionalDocuments });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Error uploading documents' });
  }
});

module.exports = router; 
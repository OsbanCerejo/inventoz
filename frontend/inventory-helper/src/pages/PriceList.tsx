import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,

  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Delete as DeleteIcon, Upload as UploadIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import ProductSearch from '../components/PriceList/ProductSearch';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/api`;

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

interface PriceListFile {
  id: string;
  customName: string;
  status: string;
  productCount: number;
  createdAt: string;
  originalName: string;
  successCount?: number;
  errorCount?: number;
  skippedCount?: number;
  errors?: string[];
  file: File;
}



interface HeaderResponse {
  headers: string[];
  headerRowIndex: number;
  message: string;
}

const PriceList: React.FC = () => {
  const { token } = useAuth();
  const [files, setFiles] = useState<PriceListFile[]>([]);
  const [openNameDialog, setOpenNameDialog] = useState(false);
  const [openMappingDialog, setOpenMappingDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<PriceListFile | null>(null);
  const [customName, setCustomName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerMessage, setHeaderMessage] = useState<string>('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile({
        id: '', // This will be set after upload
        customName: file.name,
        status: 'pending',
        productCount: 0,
        createdAt: new Date().toISOString(),
        originalName: file.name,
        file: file
      });
      setOpenNameDialog(true);
    }
  };

  const handleNameConfirm = () => {
    if (!customName.trim()) {
      setError('Please enter a name for the price list');
      return;
    }
    setOpenNameDialog(false);
    handleUploadFile();
  };

  const handleUploadFile = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile.file);
    formData.append('customName', customName);

    try {
      const response = await axios.post(
        `${API_URL}/price-list/upload-file`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const uploadedFile = response.data;
      setFiles([...files, uploadedFile]);
      setSelectedFile(uploadedFile); // Update selectedFile with the uploaded file data
      setSuccess('File uploaded successfully');
      
      // Fetch headers for mapping
      const headersResponse = await axios.get(
        `${API_URL}/price-list/file/${uploadedFile.id}/headers`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      const headersData: HeaderResponse = headersResponse.data;
      setHeaders(headersData.headers);
      setHeaderMessage(headersData.message);
      setOpenMappingDialog(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to upload file');
    }
  };

  const handleMappingConfirm = async () => {
    if (!selectedFile?.id) {
      setError('No file selected');
      return;
    }

    if (!mapping.productName || !mapping.price) {
      setError('Please map all required fields');
      return;
    }

    try {
      const response = await axios.put(
        `${API_URL}/price-list/file/${selectedFile.id}/mapping`,
        { mapping },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setOpenMappingDialog(false);
      setSuccess('Mapping updated successfully. Processing file...');
      
      // Update the file in the list
      const updatedFile = response.data;
      setFiles(files.map(file => 
        file.id === updatedFile.id ? updatedFile : file
      ));
      
      // Start processing
      handleProcessFile();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update mapping');
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await axios.delete(
        `${API_URL}/price-list/file/${fileId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setFiles(files.filter(file => file.id !== fileId));
      setSuccess('File deleted successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete file');
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${API_URL}/price-list/files`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setFiles(response.data);
    } catch (error) {
      console.error('Error fetching files:', error);
      setError('Failed to fetch price list files');
    }
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;

    try {
      const response = await axios.post(`${API_URL}/price-list/process-file`, {
        fileId: selectedFile.id,
        headerMapping: mapping
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Show success message with detailed stats
      const { successCount, errorCount, skippedCount, status } = response.data;
      let message = `File processed successfully!\n`;
      message += `- ${successCount} rows imported\n`;
      if (skippedCount > 0) {
        message += `- ${skippedCount} rows skipped (invalid data)\n`;
      }
      if (errorCount > 0) {
        message += `- ${errorCount} rows failed to process\n`;
      }
      
      if (status === 'partial') {
        message += '\nSome rows were skipped or failed to process. Check the file details for more information.';
      }

      alert(message);
      fetchFiles(); // Refresh the file list
    } catch (error: any) {
      console.error('Error processing file:', error);
      setError('Error processing file: ' + (error.response?.data?.message || error.message));
    } finally {
      setOpenMappingDialog(false);
    }
  };

  useEffect(() => {
    // Fetch existing files
    fetchFiles();
  }, []);

  return (
    <Box sx={{ mt: 4, mb: 4, px: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 0 }}>
          Price List
        </Typography>
        <Button
          component="label"
          variant="contained"
          startIcon={<UploadIcon />}
        >
          Upload Excel File
          <VisuallyHiddenInput type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ mt: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>File Name</TableCell>
              <TableCell>Upload Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Products</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file.id}>
                <TableCell>{file.customName}</TableCell>
                <TableCell>{new Date(file.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{file.status}</TableCell>
                <TableCell>{file.productCount}</TableCell>
                <TableCell>
                  <IconButton
                    color="error"
                    onClick={() => handleDelete(file.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ProductSearch />

      {/* Custom Name Dialog */}
      <Dialog open={openNameDialog} onClose={() => setOpenNameDialog(false)}>
        <DialogTitle>Enter Price List Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Price List Name"
            fullWidth
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNameDialog(false)}>Cancel</Button>
          <Button onClick={handleNameConfirm} variant="contained">
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      {/* Header Mapping Dialog */}
      <Dialog open={openMappingDialog} onClose={() => setOpenMappingDialog(false)}>
        <DialogTitle>Map Excel Columns</DialogTitle>
        <DialogContent>
          {headerMessage && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {headerMessage}
            </Alert>
          )}
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>UPC/EAN Column</InputLabel>
              <Select
                value={mapping.upc || ''}
                label="UPC/EAN Column"
                onChange={(e) => setMapping({ ...mapping, upc: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {headers.map((header) => (
                  <MenuItem key={header} value={header}>
                    {header}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Product Name Column</InputLabel>
              <Select
                value={mapping.productName || ''}
                label="Product Name Column"
                onChange={(e) => setMapping({ ...mapping, productName: e.target.value })}
              >
                {headers.map((header) => (
                  <MenuItem key={header} value={header}>
                    {header}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Price Column</InputLabel>
              <Select
                value={mapping.price || ''}
                label="Price Column"
                onChange={(e) => setMapping({ ...mapping, price: e.target.value })}
              >
                {headers.map((header) => (
                  <MenuItem key={header} value={header}>
                    {header}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMappingDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleMappingConfirm} 
            variant="contained"
            disabled={!mapping.productName || !mapping.price}
          >
            Start Import
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default PriceList; 
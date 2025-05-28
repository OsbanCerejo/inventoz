import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
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
} from '@mui/material';
import { Delete as DeleteIcon, Upload as UploadIcon, Search as SearchIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import ProductSearch from '../components/PriceList/ProductSearch';

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

const PriceList = () => {
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setOpenDialog(true);
    }
  };

  const handleUploadConfirm = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('customName', selectedFile.name);

    try {
      const response = await fetch(
        `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/api/price-list/upload-file`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setFiles([...files, data]);
      setSuccess('File uploaded successfully');
      setOpenDialog(false);
      setSelectedFile(null);
    } catch (err) {
      setError('Failed to upload file');
    }
  };

  const handleDelete = async (fileId) => {
    try {
      const response = await fetch(
        `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/api/price-list/file/${fileId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setFiles(files.filter(file => file.id !== fileId));
      setSuccess('File deleted successfully');
    } catch (err) {
      setError('Failed to delete file');
    }
  };

  useEffect(() => {
    // Fetch existing files
    const fetchFiles = async () => {
      try {
        const response = await fetch(
          `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/api/price-list/files`
        );
        if (response.ok) {
          const data = await response.json();
          setFiles(data);
        }
      } catch (err) {
        setError('Failed to fetch files');
      }
    };

    fetchFiles();
  }, []);

  const filteredFiles = files.filter(file =>
    file.customName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Price List Management
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

        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />
        </Box>

        <TableContainer component={Paper} sx={{ mb: 4 }}>
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
              {filteredFiles.map((file) => (
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

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
          <DialogTitle>Confirm Upload</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to upload {selectedFile?.name}?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleUploadConfirm} variant="contained">
              Upload
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default PriceList; 
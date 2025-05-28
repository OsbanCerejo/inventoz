import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
} from '@mui/material';

interface HeaderMappingProps {
  open: boolean;
  onClose: () => void;
  headers: string[];
  onMappingComplete: (mapping: Record<string, string>) => void;
}

const REQUIRED_FIELDS = [
  'productName',
  'productCode',
  'price',
  'quantity',
  'category',
];

const HeaderMapping: React.FC<HeaderMappingProps> = ({
  open,
  onClose,
  headers,
  onMappingComplete,
}) => {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleMappingChange = (excelHeader: string, dbField: string) => {
    setMapping((prev) => ({
      ...prev,
      [excelHeader]: dbField,
    }));
  };

  const handleSubmit = () => {
    const mappedFields = Object.values(mapping);
    const missingFields = REQUIRED_FIELDS.filter(
      (field) => !mappedFields.includes(field)
    );

    if (missingFields.length > 0) {
      setError(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    onMappingComplete(mapping);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Map Excel Headers to Database Fields</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Please map each Excel header to its corresponding database field
        </Typography>
        <Box sx={{ display: 'grid', gap: 2 }}>
          {headers.map((header) => (
            <FormControl key={header} fullWidth>
              <InputLabel>{header}</InputLabel>
              <Select
                value={mapping[header] || ''}
                label={header}
                onChange={(e) => handleMappingChange(header, e.target.value)}
              >
                <MenuItem value="productName">Product Name</MenuItem>
                <MenuItem value="productCode">Product Code</MenuItem>
                <MenuItem value="price">Price</MenuItem>
                <MenuItem value="quantity">Quantity</MenuItem>
                <MenuItem value="category">Category</MenuItem>
                <MenuItem value="description">Description</MenuItem>
                <MenuItem value="brand">Brand</MenuItem>
                <MenuItem value="supplier">Supplier</MenuItem>
                <MenuItem value="sku">SKU</MenuItem>
                <MenuItem value="barcode">Barcode</MenuItem>
              </Select>
            </FormControl>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          Confirm Mapping
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HeaderMapping; 
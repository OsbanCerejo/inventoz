import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import { useAuth } from "../context/AuthContext";
import { getApiUrl } from "../config/api";

type BrandRecord = {
  id: number;
  brand: string;
  abbreviation: string;
  nextNumber: number;
  productCount?: number;
};

type BrandFormState = {
  id: number | null;
  brand: string;
  abbreviation: string;
  nextNumber: string;
};

const INITIAL_FORM_STATE: BrandFormState = {
  id: null,
  brand: "",
  abbreviation: "",
  nextNumber: "1",
};

const normalizeAbbreviation = (value: string) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);

function Brands() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("brands", "create");
  const canEdit = hasPermission("brands", "edit");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState<BrandFormState>(INITIAL_FORM_STATE);

  const isEditing = formState.id !== null;

  const sortedBrands = useMemo(
    () =>
      [...brands].sort((a, b) =>
        String(a.brand || "").localeCompare(String(b.brand || ""))
      ),
    [brands]
  );

  const loadBrands = async () => {
    try {
      setLoading(true);
      const response = await axios.get(getApiUrl("brands"));
      setBrands(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error("Failed to load brands:", error);
      toast.error(error.response?.data?.error || "Failed to load brands");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
  }, []);

  const openCreateDialog = () => {
    setFormState(INITIAL_FORM_STATE);
    setDialogOpen(true);
  };

  const openEditDialog = (brand: BrandRecord) => {
    setFormState({
      id: brand.id,
      brand: brand.brand,
      abbreviation: brand.abbreviation,
      nextNumber: String(brand.nextNumber || 1),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setFormState(INITIAL_FORM_STATE);
  };

  const validateForm = () => {
    const brandName = String(formState.brand || "").trim();
    const abbreviation = normalizeAbbreviation(formState.abbreviation);
    const nextNumber = Number.parseInt(String(formState.nextNumber || "").trim(), 10);

    if (!isEditing && !brandName) {
      toast.error("Brand name is required.");
      return false;
    }

    if (!/^[A-Z0-9]{3}$/.test(abbreviation)) {
      toast.error("Abbreviation must be exactly 3 letters or numbers.");
      return false;
    }

    if (!Number.isInteger(nextNumber) || nextNumber < 1) {
      toast.error("Next number must be 1 or greater.");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const payload = {
      brand: String(formState.brand || "").trim(),
      abbreviation: normalizeAbbreviation(formState.abbreviation),
      nextNumber: Number.parseInt(formState.nextNumber, 10),
    };

    try {
      setSaving(true);
      if (isEditing && formState.id) {
        await axios.put(getApiUrl(`brands/${formState.id}`), payload);
        toast.success("Brand updated successfully");
      } else {
        await axios.post(getApiUrl("brands"), payload);
        toast.success("Brand created successfully");
      }
      closeDialog();
      await loadBrands();
    } catch (error: any) {
      console.error("Failed to save brand:", error);
      toast.error(error.response?.data?.error || "Failed to save brand");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ mt: 4, px: 3, pb: 4 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            Brands
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage SKU brand prefixes without touching code or redeploying.
          </Typography>
        </Box>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Add Brand
          </Button>
        )}
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        New brands become available in Add Product and Edit Product automatically. Existing brand names are locked here on purpose so product history does not get split by accidental renames.
      </Alert>

      <Paper variant="outlined">
        {loading ? (
          <Box display="flex" justifyContent="center" py={5}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Brand</strong></TableCell>
                  <TableCell><strong>3-Letter Code</strong></TableCell>
                  <TableCell><strong>Next Number</strong></TableCell>
                  <TableCell><strong>Products Using Brand</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedBrands.map((brand) => (
                  <TableRow key={brand.id} hover>
                    <TableCell>{brand.brand}</TableCell>
                    <TableCell>{brand.abbreviation}</TableCell>
                    <TableCell>{brand.nextNumber}</TableCell>
                    <TableCell>{brand.productCount || 0}</TableCell>
                    <TableCell align="right">
                      {canEdit && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={() => openEditDialog(brand)}
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {sortedBrands.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No brands found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{isEditing ? "Edit Brand" : "Add Brand"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Brand Name"
              value={formState.brand}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, brand: event.target.value }))
              }
              disabled={isEditing}
              helperText={
                isEditing
                  ? "Brand names stay locked to avoid splitting existing product history."
                  : "Use the exact brand name you want product records to store."
              }
              fullWidth
            />
            <TextField
              label="3-Letter Code"
              value={formState.abbreviation}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  abbreviation: normalizeAbbreviation(event.target.value),
                }))
              }
              helperText="This is the 3-character prefix used in generated SKUs."
              inputProps={{ maxLength: 3 }}
              fullWidth
            />
            <TextField
              label="Next Number"
              type="number"
              value={formState.nextNumber}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, nextNumber: event.target.value }))
              }
              helperText="The next SKU serial number that will be used for this brand."
              inputProps={{ min: 1 }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Brand"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Brands;

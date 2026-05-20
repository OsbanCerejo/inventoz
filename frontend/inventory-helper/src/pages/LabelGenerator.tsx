import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";

type BarcodeFormat = "CODE128" | "CODE39";

const LABEL_WIDTH_IN = 1;
const LABEL_HEIGHT_IN = 0.5;
const SIDE_MARGIN_IN = 0.09;
const TOP_MARGIN_IN = 0.03;
const BOTTOM_MARGIN_IN = 0.03;
const BARCODE_TOP_SECTION_HEIGHT_IN = 0.23;
const NUMBER_TEXT_Y_IN = 0.355;

const LabelGenerator = () => {
  const [startNumber, setStartNumber] = useState("1");
  const [endNumber, setEndNumber] = useState("100");
  const [customValues, setCustomValues] = useState("");
  const [labelPrefix, setLabelPrefix] = useState("");
  const [barcodePrefix, setBarcodePrefix] = useState("");
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>("CODE128");
  const [copiesPerOrder, setCopiesPerOrder] = useState("1");
  const [includeText, setIncludeText] = useState("yes");
  const [fileName, setFileName] = useState("whatnot-order-labels");
  const [barcodeWidth, setBarcodeWidth] = useState<number>(1.8);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const normalizePrefix = (value: string) =>
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "");

  const applyPrefix = (value: string, prefix: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "";
    const normalizedPrefix = normalizePrefix(prefix);
    if (!normalizedPrefix) return trimmedValue;
    if (trimmedValue.toUpperCase().startsWith(`${normalizedPrefix}-`)) {
      return trimmedValue.toUpperCase();
    }
    return `${normalizedPrefix}-${trimmedValue}`;
  };

  const parsedValues = useMemo(() => {
    const trimmedCustom = customValues.trim();
    if (trimmedCustom) {
      return trimmedCustom
        .split(/[\n,\s]+/g)
        .map((token) => token.trim())
        .filter(Boolean);
    }

    const start = Number(startNumber);
    const end = Number(endNumber);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) return [];

    const values: string[] = [];
    for (let value = start; value <= end; value += 1) {
      values.push(String(value));
    }
    return values;
  }, [customValues, startNumber, endNumber]);

  const labelEntries = useMemo(
    () =>
      parsedValues
        .map((value) => {
          const trimmedValue = value.trim();
          const suffix = trimmedValue.includes("-") ? trimmedValue.split("-").pop() || trimmedValue : trimmedValue;
          return {
            displayValue: applyPrefix(trimmedValue, labelPrefix),
            barcodeValue: applyPrefix(suffix, barcodePrefix),
          };
        })
        .filter((entry) => entry.displayValue && entry.barcodeValue),
    [parsedValues, labelPrefix, barcodePrefix]
  );

  const buildBarcodeCanvas = (value: string) => {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, {
      format: barcodeFormat,
      lineColor: "#000000",
      background: "#ffffff",
      displayValue: false,
      margin: 10,
      // Render higher intrinsic resolution first for sharper thermal output.
      height: 240,
      width: barcodeFormat === "CODE39" ? Math.max(2.2, barcodeWidth * 1.2) : barcodeWidth * 1.2,
    });
    return canvas;
  };

  const buildCroppedBarcodeImage = (value: string, targetAspect: number) => {
    const source = buildBarcodeCanvas(value);
    const srcW = source.width;
    const srcH = source.height;
    const srcAspect = srcW / srcH;

    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;

    // Crop center to target aspect so barcode can appear larger without horizontal stretching.
    if (srcAspect > targetAspect) {
      sw = Math.round(srcH * targetAspect);
      sx = Math.max(0, Math.floor((srcW - sw) / 2));
    } else if (srcAspect < targetAspect) {
      sh = Math.round(srcW / targetAspect);
      sy = Math.max(0, Math.floor((srcH - sh) / 2));
    }

    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
    }

    return {
      dataUrl: out.toDataURL("image/png"),
      width: out.width,
      height: out.height,
    };
  };

  const handleGenerate = async () => {
    setError(null);
    setSuccess(null);

    const copies = Number(copiesPerOrder);
    if (!Number.isInteger(copies) || copies < 1) {
      setError("Copies per order must be a whole number of 1 or more.");
      return;
    }
    if (!labelEntries.length) {
      setError("No order numbers found. Use a valid range or custom order list.");
      return;
    }

    setIsGenerating(true);
    try {
      const allLabels: Array<{ displayValue: string; barcodeValue: string }> = [];
      for (const entry of labelEntries) {
        for (let i = 0; i < copies; i += 1) {
          allLabels.push(entry);
        }
      }

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "in",
        format: [LABEL_WIDTH_IN, LABEL_HEIGHT_IN],
      });

      allLabels.forEach((entry, index) => {
        if (index > 0) {
          doc.addPage([LABEL_WIDTH_IN, LABEL_HEIGHT_IN], "landscape");
        }
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const maxImageW = Math.max(0.2, pageWidth - SIDE_MARGIN_IN * 2);
        const maxImageH =
          includeText === "yes"
            ? Math.min(BARCODE_TOP_SECTION_HEIGHT_IN, pageHeight * 0.5 - TOP_MARGIN_IN)
            : Math.max(0.22, pageHeight - TOP_MARGIN_IN - BOTTOM_MARGIN_IN);
        const targetAspect = maxImageW / maxImageH;
        const image = buildCroppedBarcodeImage(entry.barcodeValue, targetAspect);
        const imageY = TOP_MARGIN_IN;
        const imageW = maxImageW;
        const imageH = maxImageH;
        const imageX = (pageWidth - imageW) / 2;

        doc.addImage(image.dataUrl, "PNG", imageX, imageY, imageW, imageH, undefined, "FAST");

        if (includeText === "yes") {
          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          const textY = Math.min(pageHeight - 0.07, NUMBER_TEXT_Y_IN);
          doc.text(entry.displayValue, pageWidth / 2, textY, {
            align: "center",
            baseline: "middle",
          });
        }
      });

      doc.save(`${fileName.trim() || "whatnot-order-labels"}.pdf`);
      setSuccess(`Generated ${allLabels.length} thermal labels in PDF.`);
    } catch (generateError) {
      console.error("Error generating labels:", generateError);
      setError("Failed to generate labels PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Box sx={{ mt: 4, px: 3, pb: 6 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Order Label Generator
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Thermal Label Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Output is fixed for thermal roll labels: black/white, landscape, 1 inch wide x 0.5 inch tall.
          Each label includes barcode + order number text.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Start Number"
              value={startNumber}
              onChange={(e) => setStartNumber(e.target.value)}
              disabled={customValues.trim().length > 0}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="End Number"
              value={endNumber}
              onChange={(e) => setEndNumber(e.target.value)}
              disabled={customValues.trim().length > 0}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Copies Per Order"
              value={copiesPerOrder}
              onChange={(e) => setCopiesPerOrder(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Label Prefix (optional)"
              placeholder="AUC1"
              value={labelPrefix}
              onChange={(e) => setLabelPrefix(e.target.value)}
              helperText="Printed text, like AUC1-1"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Barcode Prefix (optional)"
              placeholder="A1"
              value={barcodePrefix}
              onChange={(e) => setBarcodePrefix(e.target.value)}
              helperText="Scanned value, like A1-1"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel id="barcode-format-label">Barcode Format</InputLabel>
              <Select
                labelId="barcode-format-label"
                value={barcodeFormat}
                label="Barcode Format"
                onChange={(e) => setBarcodeFormat(e.target.value as BarcodeFormat)}
              >
                <MenuItem value="CODE128">CODE128 (Recommended)</MenuItem>
                <MenuItem value="CODE39">CODE39</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Custom Order Numbers (optional)"
              placeholder="Use comma/newline/space separated values, e.g. 1, 2, 507, 1120"
              value={customValues}
              onChange={(e) => setCustomValues(e.target.value)}
              multiline
              minRows={3}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="include-text-label">Include Number Text</InputLabel>
              <Select
                labelId="include-text-label"
                value={includeText}
                label="Include Number Text"
                onChange={(e) => setIncludeText(e.target.value)}
              >
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="PDF File Name"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Barcode Width: <strong>{barcodeWidth.toFixed(1)}</strong>
            </Typography>
            <Slider
              value={barcodeWidth}
              min={1}
              max={3}
              step={0.1}
              marks={[
                { value: 1, label: "Thin" },
                { value: 1.8, label: "Default" },
                { value: 3, label: "Thick" },
              ]}
              onChange={(_, value) => setBarcodeWidth(Array.isArray(value) ? value[0] : value)}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={2} sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Total distinct labels: <strong>{labelEntries.length}</strong>
        </Typography>
        {(normalizePrefix(labelPrefix) || normalizePrefix(barcodePrefix)) && (
          <Stack spacing={0.5} sx={{ mt: 0.75 }}>
            <Typography variant="body2" color="text.secondary">
              Printed example: <strong>{applyPrefix(startNumber || "1", labelPrefix)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Barcode scans as: <strong>{applyPrefix(startNumber || "1", barcodePrefix)}</strong>
            </Typography>
          </Stack>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Button variant="contained" size="large" onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? "Generating..." : "Generate PDF Labels"}
      </Button>
    </Box>
  );
};

export default LabelGenerator;

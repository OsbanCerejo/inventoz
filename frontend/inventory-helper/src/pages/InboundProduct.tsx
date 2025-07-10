import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useFormik } from "formik";
import { useLocation, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import dayjs from "dayjs";
import { useState } from "react";

function InboundProduct() {
  const location = useLocation();
  const navigate = useNavigate();

  const productObject = location.state.productObject;
  const today = new Date();
  const [newDate, setNewDate] = useState(dayjs(today.toLocaleString()));
  const formikInitialValues = {
    sku: "" + productObject.sku,
    vendor: "",
    quantity: "",
    date: newDate,
    batch: "",
    compositeSku: "",
  };

  const formikValidationSchema = Yup.object().shape({
    sku: Yup.string(),
    vendor: Yup.string(),
    quantity: Yup.string().required(),
    date: Yup.date().required(),
    batch: Yup.string(),
  });

  const formik = useFormik({
    initialValues: formikInitialValues,
    validationSchema: formikValidationSchema,
    onSubmit: (data) => {
      const compositeInboundKey =
        data.sku +
        "-" +
        (data.date.month() + 1) +
        "-" +
        data.date.date() +
        "-" +
        data.date.year() +
        "-" +
        data.batch;
      data.compositeSku = compositeInboundKey; //Change compositeSKU in data to compositeInboundSku
      axios
        .put(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/inbound`, {
          quantity: parseInt(productObject.quantity) + parseInt(data.quantity),
          sku: productObject.sku,
        })
        .then(() => {
          console.log("Quantity Updated in Inventory Table");
        });
      axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/inbound`, data).then((response) => {
        if (response.data === "Created New") {
          toast.success("Success Notification !", {
            position: "top-right",
          });
          console.log("Created New");
          navigate("/", { state: { clearFilters: true } });
        } else {
          toast.error("Inbound Entry Already Exists!", {
            position: "top-right",
          });
          console.log("Already Exists");
        }
      });
    },
  });

  return (
    <Container>
      <Typography variant="h4" component="h1" sx={{ mt: 4, mb: 3 }}>
        Inbound Product
      </Typography>
      
      <form onSubmit={formik.handleSubmit}>
        <Container component="main" maxWidth="sm" sx={{ mb: 4 }}>
          <Paper
            variant="outlined"
            sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 4 } }}
          >
            <Box m={2} pt={3}>
              <Typography variant="h6" color="text.secondary">
                SKU: {productObject.sku}
              </Typography>
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="vendor"
                name="vendor"
                label="Vendor"
                value={formik.values.vendor}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.vendor && Boolean(formik.errors.vendor)}
                helperText={formik.touched.vendor && formik.errors.vendor}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="quantity"
                name="quantity"
                label="Quantity"
                value={formik.values.quantity}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.quantity && Boolean(formik.errors.quantity)
                }
                helperText={formik.touched.quantity && formik.errors.quantity}
              />
            </Box>
            <Box m={2} pt={3}>
              <TextField
                fullWidth
                id="batch"
                name="batch"
                label="Batch Code"
                value={formik.values.batch}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.batch && Boolean(formik.errors.batch)}
                helperText={formik.touched.batch && formik.errors.batch}
              />
            </Box>
            <Box m={2} pt={3}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DemoContainer components={["DatePicker"]}>
                  <DatePicker
                    label="Inbound Date"
                    value={newDate}
                    onChange={(event) => {
                      if (event) {
                        setNewDate(event);
                        formik.setFieldValue("date", event);
                      }
                    }}
                  />
                </DemoContainer>
              </LocalizationProvider>
            </Box>
            <Button color="primary" variant="contained" fullWidth type="submit">
              Submit
            </Button>
          </Paper>
        </Container>
      </form>
    </Container>
  );
}

export default InboundProduct;

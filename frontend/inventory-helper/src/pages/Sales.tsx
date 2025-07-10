import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Button,
} from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import axios from "axios";
import dayjs from "dayjs";
import { useFormik } from "formik";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as Yup from "yup";

function Sales() {
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
    compositeSalesSku: "",
  };

  const formikValidationSchema = Yup.object().shape({
    sku: Yup.string(),
    vendor: Yup.string(),
    quantity: Yup.string().required(),
    date: Yup.date().required(),
  });

  const formik = useFormik({
    initialValues: formikInitialValues,
    validationSchema: formikValidationSchema,
    onSubmit: (data) => {
      const compositeSalesKey =
        data.sku +
        "-" +
        data.date.month() +
        "-" +
        data.date.date() +
        "-" +
        data.date.year();
      data.compositeSalesSku = compositeSalesKey;
      axios
        .put(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/sales`, {
          quantity: parseInt(productObject.quantity) - parseInt(data.quantity),
          sku: productObject.sku,
        })
        .then(() => {
          console.log("Quantity Updated in Inventory Table");
        });
      axios.post(`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/sales`, data).then((response) => {
        console.log(response);
      });
      navigate("/", { state: { clearFilters: true } });
    },
  });
  return (
    <Container>
      <Typography variant="h4" component="h1" sx={{ mt: 4, mb: 3 }}>
        Sales
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
                id="quantity"
                name="quantity"
                label="Quantity Sold"
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
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DemoContainer components={["DatePicker"]}>
                  <DatePicker
                    label="Date of Sale"
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

export default Sales;

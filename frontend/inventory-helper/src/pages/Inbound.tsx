import {
  Box,
  Button,
  Container,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useFormik } from "formik";
import { useLocation, useNavigate } from "react-router-dom";
import * as Yup from "yup";

import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import dayjs from "dayjs";
import { useState } from "react";

function Inbound() {
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
    compositeSku: "",
  };

  //   console.log(newDate);
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
      //   console.log(productObject);
      const compositeKey =
        data.sku +
        "-" +
        data.date.month() +
        "-" +
        data.date.date() +
        "-" +
        data.date.year();
      data.compositeSku = compositeKey;
      axios
        .put("http://localhost:3001/inbound", {
          quantity: parseInt(productObject.quantity) + parseInt(data.quantity),
          sku: productObject.sku,
        })
        .then(() => {
          console.log("Quantity Updated in Inventory Table");
        });
      axios.post("http://localhost:3001/inbound", data).then((response) => {
        console.log(response);
      });
      navigate("/");
    },
  });

  return (
    <Container>
      <form onSubmit={formik.handleSubmit}>
        <Container component="main" maxWidth="sm" sx={{ mb: 4 }}>
          <Paper
            variant="outlined"
            sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 4 } }}
          >
            <Box m={2} pt={3}>
              <Typography variant="h4"> SKU: {productObject.sku}</Typography>
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
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DemoContainer components={["DatePicker"]}>
                  <DatePicker
                    label="Controlled picker"
                    value={newDate}
                    onChange={(event) => {
                      if (event) {
                        setNewDate(event);
                        formik.setFieldValue("date", newDate);
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

export default Inbound;

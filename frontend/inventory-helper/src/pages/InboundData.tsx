import { Box, TextField, Button } from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";

function InboundData() {
  const [listOfInbound, setListOfInbound] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    axios.get("http://localhost:3001/inbound").then((response) => {
      setListOfInbound(response.data);
    });
  }, []);

  const handleSearch = () => {
    // TODO: Move this to Search.tsx eventually
    console.log("Clicked Search ", searchQuery);
    if (searchQuery.length != 0) {
      axios
        .get(`http://localhost:3001/inbound/search/${searchQuery}`)
        .then((response) => {
          // console.log(response.data);
          setListOfInbound(response.data);
        });
    } else {
      // TODO: Fix this to reduce API GET calls and make it so empty string just resets the table state
      axios.get("http://localhost:3001/inbound").then((response) => {
        setListOfInbound(response.data);
      });
    }
  };
  const handleKeypress = (e: any) => {
    //It triggers by pressing the enter key
    if (e.keyCode === 13) {
      handleSearch();
    }
  };
  return (
    <div>
      <Box alignItems="center" my={4} p={2}>
        <TextField
          fullWidth
          label="Search Product SKU"
          id="fullWidth"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
          }}
          onKeyDown={handleKeypress}
        />
        <Button variant="contained" color="success" onClick={handleSearch}>
          Search
        </Button>
      </Box>
      {listOfInbound.length === 0 && <p>No item found</p>}
      <table className="table table-bordered table-hover" border={2}>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">SKU</th>
            <th scope="col">Quantity</th>
            <th scope="col">Date</th>
            <th scope="col">Batch Code</th>
            <th scope="col">Vendor</th>
          </tr>
        </thead>
        <tbody>
          {listOfInbound.map((inboundProduct: any, index) => (
            <tr
              key={index}
              //   onClick={() => {
              //     // setSelectedIndex(index);
              //     handleSelect(product);
              //   }}
            >
              <th scope="row">{index + 1}</th>
              <td>{inboundProduct.sku}</td>
              <td>{inboundProduct.quantity}</td>
              <td>{inboundProduct.date}</td>
              <td>{inboundProduct.batch}</td>
              <td>{inboundProduct.vendor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default InboundData;

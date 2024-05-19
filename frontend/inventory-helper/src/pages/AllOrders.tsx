import axios from "axios";
import { useEffect, useState } from "react";

function AllOrders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    // Fetch orders when component mounts
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      // Make a request to your backend server
      console.log("Succesful until here front end 1");
      //   authenticate();
      console.log("Succesful until here front end 2");
      const response = await axios.get(
        "http://localhost:3001/orders/allOrders"
      );
      setOrders(response.data.orders);
    } catch (error) {
      console.error("Fetch orders error:", error);
    }
  };

  return <div>AllOrders</div>;
}

export default AllOrders;

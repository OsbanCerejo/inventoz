import { useEffect, useState } from "react";
import EbayAuthToken from "ebay-oauth-nodejs-client";
import axios from "axios";

function AllOrders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    // Fetch sandbox orders when component mounts
    fetchSandboxOrders();
  }, []);

  const fetchSandboxOrders = async () => {
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
      console.error("Fetch sandbox orders error:", error);
    }
  };

  //   async function authenticate() {
  //     try {
  //       const response = await axios.post("https://auth.ebay.com/oauth2/token", {
  //         grant_type: "client_credentials",
  //         client_id: "ShanksRe-Inventor-PRD-95ec4ed98-41a5d4f1",
  //         client_secret: "PRD-5ec4ed9865c0-97c7-48d2-a88c-e11f",
  //         // redirect_uri: "YOUR_REDIRECT_URI",
  //         scope: "https://api.ebay.com/oauth/api_scope",
  //       });

  //       // Extract the access token from the response
  //       const accessToken = response.data.access_token;
  //       return accessToken;
  //     } catch (error) {
  //       console.error("Authentication error:", error);
  //       throw error;
  //     }
  //   }

  return <div>AllOrders</div>;
}

export default AllOrders;

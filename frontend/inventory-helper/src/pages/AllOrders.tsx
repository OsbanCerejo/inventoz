import axios from "axios";
import { useEffect, useState } from "react";

function AllOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<any>({});
  const [orderMetrics, setOrderMetrics] = useState({
    totalOrders: 0,
    totalItems: 0,
  });

  useEffect(() => {
    // Fetch orders when component mounts
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(
        "http://localhost:3001/orders/allOrders"
      );
      const ordersData = response.data.orders;
      const totalOrders = response.data.total;

      const grouped = groupOrdersByProduct(ordersData);

      setOrders(ordersData);
      setGroupedOrders(grouped.groupedOrders);
      setOrderMetrics({ totalOrders, totalItems: grouped.totalItems });
    } catch (error) {
      console.error("Fetch orders error:", error);
    }
  };

  function groupOrdersByProduct(orders: any) {
    const result = {
      groupedOrders: {},
      totalItems: 0,
    };

    result.groupedOrders = orders.reduce((acc: any, order: any) => {
      order.items.forEach((item: any) => {
        const { sku } = item;
        if (!acc[sku]) {
          acc[sku] = [];
        }
        acc[sku].push({
          ...item,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          orderDate: order.orderDate,
          customerName: order.customerUsername,
          orderStatus: order.orderStatus,
        });
        result.totalItems += item.quantity; // Increment total item count
      });
      console.log(acc);
      return acc;
    }, {});

    return result;
  }

  return (
    <div>
      <h5>Total Items: {orderMetrics.totalItems}</h5>
      <h5>Total Orders : {orderMetrics.totalOrders}</h5>
      {Object.keys(groupedOrders)
        .sort()
        .map((sku, skuIndex) => (
          <div key={sku}>
            <h5>Product SKU: {sku}</h5>
            <table className="table table-bordered table-hover" border={2}>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col" style={{ width: "15%" }}>
                    Image
                  </th>
                  <th scope="col">Item Name</th>
                  <th scope="col" style={{ width: "10%" }}>
                    Location
                  </th>
                  <th scope="col" style={{ width: "5%" }}>
                    Quantity
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedOrders[sku].map((item: any, index: any) => (
                  <tr key={item.orderItemId}>
                    <th scope="row">{index + 1}</th>
                    <td>
                      <img src={item.imageUrl} height="50" alt={item.name} />
                    </td>
                    <td>{item.name}</td>
                    <td>{item.warehouseLocation}</td>
                    <td>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

export default AllOrders;

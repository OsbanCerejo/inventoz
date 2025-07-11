import { useNavigate } from "react-router-dom";
import { Box, Grid, Card, CardContent, Typography, Button } from "@mui/material";
import { 
  Inventory as InventoryIcon,
  LocalShipping as InboundIcon,
  ShoppingCart as OrdersIcon,
  LocalShipping as PackingIcon,
  AttachMoney as PriceListIcon,
  Store as WhatnotIcon,
  People as EmployeeIcon,
  Add as AddProductIcon
} from '@mui/icons-material';
import { useAuth } from "../context/AuthContext";

function Home() {
  const navigate = useNavigate();
  const { hasMenuAccess } = useAuth();

  const dashboardItems = [
    {
      title: "Products",
      description: "View and manage all products in inventory",
      icon: <InventoryIcon sx={{ fontSize: 40, color: '#1976d2' }} />,
      path: "/products",
      menuKey: "products",
      color: "#e3f2fd"
    },
    {
      title: "Add Product",
      description: "Add new products to the inventory",
      icon: <AddProductIcon sx={{ fontSize: 40, color: '#2e7d32' }} />,
      path: "/addProduct",
      menuKey: "addProduct",
      action: "create",
      color: "#e8f5e8"
    },
    {
      title: "Inbound",
      description: "Manage incoming inventory and shipments",
      icon: <InboundIcon sx={{ fontSize: 40, color: '#ed6c02' }} />,
      path: "/inbound/showAll",
      menuKey: "inbound",
      color: "#fff4e5"
    },
    {
      title: "Orders",
      description: "View and manage all orders",
      icon: <OrdersIcon sx={{ fontSize: 40, color: '#9c27b0' }} />,
      path: "/orders/showAll",
      menuKey: "orders",
      color: "#f3e5f5"
    },
    {
      title: "Packing Mode",
      description: "Order packing interface",
      icon: <PackingIcon sx={{ fontSize: 40, color: '#d32f2f' }} />,
      path: "/orders/packingMode",
      menuKey: "packing",
      color: "#ffebee"
    },
    {
      title: "Price List",
      description: "Manage product pricing and lists",
      icon: <PriceListIcon sx={{ fontSize: 40, color: '#388e3c' }} />,
      path: "/price-list",
      menuKey: "pricelist",
      color: "#e8f5e8"
    },
    {
      title: "Whatnot",
      description: "Whatnot barcode scanner",
      icon: <WhatnotIcon sx={{ fontSize: 40, color: '#7b1fa2' }} />,
      path: "/whatnot",
      menuKey: "whatnot",
      color: "#f3e5f5"
    },
    {
      title: "Employees",
      description: "Manage employee information",
      icon: <EmployeeIcon sx={{ fontSize: 40, color: '#1976d2' }} />,
      path: "/employee-info",
      menuKey: "employeeInfo",
      color: "#e3f2fd"
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 4, fontWeight: 600, color: '#1976d2' }}>
        Welcome to Inventoz
      </Typography>
      <Typography variant="h6" sx={{ mb: 4, color: '#666' }}>
        Select a section to get started
      </Typography>
      
      <Grid container spacing={3}>
        {dashboardItems
          .filter((item) => {
            // Check if user has access to this menu item
            return hasMenuAccess(item.menuKey);
          })
          .map((item) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={item.title}>
              <Card 
                sx={{ 
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                  },
                  backgroundColor: item.color
                }}
                onClick={() => navigate(item.path)}
              >
                <CardContent sx={{ 
                  textAlign: 'center', 
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%'
                }}>
                  <Box sx={{ mb: 2 }}>
                    {item.icon}
                  </Box>
                  <Typography variant="h6" component="h2" sx={{ mb: 1, fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {item.description}
                  </Typography>
                  <Button 
                    variant="contained" 
                    size="small"
                    sx={{ 
                      textTransform: 'none',
                      fontWeight: 500
                    }}
                  >
                    Open
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
      </Grid>
    </Box>
  );
}

export default Home;

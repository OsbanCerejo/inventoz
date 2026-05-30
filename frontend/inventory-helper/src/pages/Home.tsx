import { useNavigate } from "react-router-dom";
import { Box, Grid, Card, CardContent, Typography, Button } from "@mui/material";
import { 
  Inventory as InventoryIcon,
  LocalShipping as InboundIcon,
  ShoppingCart as OrdersIcon,
  Inventory2 as PackingIcon,
  AttachMoney as PriceListIcon,
  Store as WhatnotIcon,
  Add as AddProductIcon,
  People as UsersIcon,
  QrCodeScanner as BarcodeScanIcon,
  Insights as WhatnotAnalyticsIcon,
  QueryStats as PackingAnalyticsIcon,
  WarningAmber as LowStockIcon,
  PointOfSale as SalesIcon,
  ConfirmationNumber as TicketsIcon,
  ReceiptLong as InvoiceTrackerIcon,
  Storefront as WalmartIcon,
  BrandingWatermark as BrandsIcon,
  QrCodeScanner as PriceScannerIcon,
  AssignmentTurnedIn as HbaOrdersIcon,
} from '@mui/icons-material';
import { useAuth } from "../context/AuthContext";

function Home() {
  const navigate = useNavigate();
  const { hasMenuAccess, permissions } = useAuth();

  const tileConfig: Record<string, {
    title: string;
    description: string;
    icon: React.ReactNode;
    path: string;
    color: string;
  }> = {
    products: {
      title: "Products",
      description: "View and manage all products in inventory",
      icon: <InventoryIcon sx={{ fontSize: 40, color: '#1976d2' }} />,
      path: "/products",
      color: "#e3f2fd"
    },
    addProduct: {
      title: "Add Product",
      description: "Add new products to the inventory",
      icon: <AddProductIcon sx={{ fontSize: 40, color: '#2e7d32' }} />,
      path: "/addProduct",
      color: "#e8f5e8"
    },
    inbound: {
      title: "Inbound",
      description: "Manage incoming inventory and shipments",
      icon: <InboundIcon sx={{ fontSize: 40, color: '#ed6c02' }} />,
      path: "/inbound/showAll",
      color: "#fff4e5"
    },
    orders: {
      title: "Orders",
      description: "View and manage all orders",
      icon: <OrdersIcon sx={{ fontSize: 40, color: '#ef6c00' }} />,
      path: "/orders/showAll",
      color: "#fff3e0"
    },
    packing: {
      title: "Packing Mode",
      description: "Order packing interface",
      icon: <PackingIcon sx={{ fontSize: 40, color: '#d32f2f' }} />,
      path: "/orders/packingMode",
      color: "#ffebee"
    },
    pricelist: {
      title: "Price List",
      description: "Manage product pricing and lists",
      icon: <PriceListIcon sx={{ fontSize: 40, color: '#2e7d32' }} />,
      path: "/price-list",
      color: "#e8f5e9"
    },
    priceScanner: {
      title: "Price Scanner",
      description: "Scan an item barcode to view the expected selling price",
      icon: <PriceScannerIcon sx={{ fontSize: 40, color: '#00838f' }} />,
      path: "/price-scanner",
      color: "#e0f7fa"
    },
    whatnotFulfillment: {
      title: "Whatnot Fulfilment",
      description: "Fulfilment workflow for Whatnot shipments",
      icon: <WhatnotIcon sx={{ fontSize: 40, color: '#6a1b9a' }} />,
      path: "/whatnot-fulfillment",
      color: "#f3e5f5"
    },
    users: {
      title: "Users",
      description: "Manage users and permissions",
      icon: <UsersIcon sx={{ fontSize: 40, color: '#ad1457' }} />,
      path: "/users",
      color: "#fce4ec"
    },
    barcodeScan: {
      title: "Barcode Scan",
      description: "Scan and search barcode logs",
      icon: <BarcodeScanIcon sx={{ fontSize: 40, color: '#1565c0' }} />,
      path: "/barcode-scan",
      color: "#e8f1ff"
    },
    sales: {
      title: "Sales",
      description: "Track product sales and outbound movements",
      icon: <SalesIcon sx={{ fontSize: 40, color: '#6a1b9a' }} />,
      path: "/sales",
      color: "#f4e8ff"
    },
    hbaOrders: {
      title: "HBA Orders",
      description: "Review public HBA order requests and email status",
      icon: <HbaOrdersIcon sx={{ fontSize: 40, color: '#2e7d32' }} />,
      path: "/hba-orders",
      color: "#e8f5e9"
    },
    whatnotAnalytics: {
      title: "Whatnot Analytics",
      description: "View Whatnot scan and sales performance",
      icon: <WhatnotAnalyticsIcon sx={{ fontSize: 40, color: '#1565c0' }} />,
      path: "/whatnot-analytics",
      color: "#e8f1ff"
    },
    sortingAnalytics: {
      title: "Sorting Analytics",
      description: "Review sorter throughput, show split, and scan timing",
      icon: <WhatnotAnalyticsIcon sx={{ fontSize: 40, color: '#6a1b9a' }} />,
      path: "/sorting-analytics",
      color: "#f4e8ff"
    },
    packingAnalytics: {
      title: "Packing Analytics",
      description: "Analyze barcode packing productivity",
      icon: <PackingAnalyticsIcon sx={{ fontSize: 40, color: '#00838f' }} />,
      path: "/packing-analytics",
      color: "#e0f7fa"
    },
    lowStock: {
      title: "Low Stock",
      description: "Review low stock alerts and risks",
      icon: <LowStockIcon sx={{ fontSize: 40, color: '#ef6c00' }} />,
      path: "/low-stock",
      color: "#fff3e0"
    },
    tickets: {
      title: "Tickets",
      description: "Customer care reshipment ticket workflow",
      icon: <TicketsIcon sx={{ fontSize: 40, color: '#c62828' }} />,
      path: "/tickets",
      color: "#ffebee"
    },
    invoiceTracker: {
      title: "Invoice Tracker",
      description: "Track vendor invoices and received shipment lines",
      icon: <InvoiceTrackerIcon sx={{ fontSize: 40, color: '#6d4c41' }} />,
      path: "/invoice-tracker",
      color: "#efebe9"
    },
    brands: {
      title: "Brands",
      description: "Manage SKU brand codes and next serial numbers",
      icon: <BrandsIcon sx={{ fontSize: 40, color: '#283593' }} />,
      path: "/brands",
      color: "#e8eaf6"
    },
    walmartIntegration: {
      title: "Walmart Integration",
      description: "Monitor Walmart connection health and sync items, orders, inventory, and pricing",
      icon: <WalmartIcon sx={{ fontSize: 40, color: '#2e7d32' }} />,
      path: "/walmart-integration",
      color: "#e8f5e9"
    },
    walmartProductCatalog: {
      title: "Walmart Product Catalog",
      description: "Browse synced Walmart SKUs, mapping status, price, and inventory",
      icon: <WalmartIcon sx={{ fontSize: 40, color: '#1565c0' }} />,
      path: "/walmart-product-catalog",
      color: "#e8f1ff"
    },
    walmartOrders: {
      title: "Walmart Orders",
      description: "Review read-only Walmart orders pulled into Inventoz",
      icon: <WalmartIcon sx={{ fontSize: 40, color: '#1565c0' }} />,
      path: "/walmart-orders",
      color: "#e8f1ff"
    }
  };

  const dashboardOrder = [
    "products",
    "orders",
    "hbaOrders",
    "invoiceTracker",
    "brands",
    "packingAnalytics",
    "whatnotAnalytics",
    "sortingAnalytics",
    "walmartProductCatalog",
    "walmartIntegration",
    "walmartOrders",
    "tickets",
    "whatnotFulfillment",
    "pricelist",
    "priceScanner",
    "users",
  ];

  const dashboardItems = dashboardOrder
    .filter((menuKey) => tileConfig[menuKey] && hasMenuAccess(menuKey))
    .map((menuKey) => ({
      menuKey,
      ...tileConfig[menuKey],
    }));

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 4, fontWeight: 600, color: '#1976d2' }}>
        Welcome to Inventoz
      </Typography>
      <Typography variant="h6" sx={{ mb: 4, color: '#666' }}>
        Select a section to get started
      </Typography>
      
      <Grid container spacing={3}>
        {dashboardItems.map((item) => (
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

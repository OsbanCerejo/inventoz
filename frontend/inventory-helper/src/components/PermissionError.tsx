import React from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  Typography,
  Button,
  Paper
} from '@mui/material';
import { Security, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface PermissionErrorProps {
  resource?: string;
  action?: string;
  menuItem?: string;
  showBackButton?: boolean;
  customMessage?: string;
}

const PermissionError: React.FC<PermissionErrorProps> = ({
  resource,
  action,
  menuItem,
  showBackButton = true,
  customMessage
}) => {
  const navigate = useNavigate();

  const getActionDisplayName = (action: string) => {
    switch (action) {
      case 'view': return 'view';
      case 'create': return 'create';
      case 'edit': return 'edit';
      case 'delete': return 'delete';
      default: return action;
    }
  };

  const getResourceDisplayName = (resource: string) => {
    switch (resource) {
      case 'products': return 'Products';
      case 'orders': return 'Orders';
      case 'users': return 'Users';
      case 'inbound': return 'Inbound';
      case 'sales': return 'Sales';
      case 'pricelist': return 'Price List';
      case 'whatnot': return 'Whatnot';
      case 'employeeInfo': return 'Employee Information';
      case 'packing': return 'Packing';
      case 'ebay': return 'eBay';
      default: return resource;
    }
  };

  const getMenuDisplayName = (menuItem: string) => {
    switch (menuItem) {
      case 'products': return 'Products';
      case 'orders': return 'Orders';
      case 'users': return 'Users';
      case 'inbound': return 'Inbound';
      case 'sales': return 'Sales';
      case 'pricelist': return 'Price List';
      case 'whatnot': return 'Whatnot';
      case 'employeeInfo': return 'Employee Information';
      case 'packing': return 'Packing';
      default: return menuItem;
    }
  };

  const generateErrorMessage = () => {
    if (customMessage) {
      return customMessage;
    }

    if (resource && action) {
      const resourceName = getResourceDisplayName(resource);
      const actionName = getActionDisplayName(action);
      return `You don't have permission to ${actionName} ${resourceName}.`;
    }

    if (menuItem) {
      const menuName = getMenuDisplayName(menuItem);
      return `You don't have access to the ${menuName} section.`;
    }

    return "You don't have permission to access this resource.";
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="60vh"
      px={2}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 600,
          width: '100%',
          textAlign: 'center'
        }}
      >
        <Security
          sx={{
            fontSize: 64,
            color: 'warning.main',
            mb: 2
          }}
        />

        <Alert
          severity="warning"
          sx={{
            mb: 3,
            textAlign: 'left'
          }}
        >
          <AlertTitle>Access Denied</AlertTitle>
          <Typography variant="body1" sx={{ mt: 1 }}>
            {generateErrorMessage()}
          </Typography>
        </Alert>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          {showBackButton && (
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={handleGoBack}
            >
              Go Back
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleGoHome}
          >
            Go to Home
          </Button>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="caption" color="text.secondary">
            If you believe you should have access to this feature, please contact your administrator.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default PermissionError; 
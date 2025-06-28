import React from 'react';
import { useAuth } from '../context/AuthContext';
import PermissionError from './PermissionError';
import { Box, Alert, AlertTitle, Typography } from '@mui/material';
import { Security } from '@mui/icons-material';

interface PermissionGuardProps {
  children: React.ReactNode;
  resource?: string;
  action?: string;
  menuItem?: string;
  fallback?: React.ReactNode;
  showError?: boolean;
  errorMessage?: string;
  inline?: boolean;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  resource,
  action,
  menuItem,
  fallback,
  showError = true,
  errorMessage,
  inline = false
}) => {
  const { hasPermission, hasMenuAccess, isLoading } = useAuth();

  // If still loading, show nothing
  if (isLoading) {
    return null;
  }

  // Check permissions
  let hasAccess = true;
  let missingPermission = '';

  if (resource && action) {
    hasAccess = hasPermission(resource, action);
    if (!hasAccess) {
      missingPermission = `${action} permission for ${resource}`;
    }
  }

  if (menuItem && hasAccess) {
    hasAccess = hasMenuAccess(menuItem);
    if (!hasAccess) {
      missingPermission = `menu access for ${menuItem}`;
    }
  }

  // If user has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If custom fallback is provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // If inline error is requested, show compact error
  if (inline) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" icon={<Security />}>
          <AlertTitle>Access Denied</AlertTitle>
          <Typography variant="body2">
            {errorMessage || `You don't have ${missingPermission}.`}
          </Typography>
        </Alert>
      </Box>
    );
  }

  // If showError is false, show nothing
  if (!showError) {
    return null;
  }

  // Show full permission error page
  return (
    <PermissionError
      resource={resource}
      action={action}
      menuItem={menuItem}
      customMessage={errorMessage}
    />
  );
};

export default PermissionGuard; 
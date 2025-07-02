import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PermissionError from './PermissionError';
import { CircularProgress, Box } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  resource?: string;
  action?: string;
  menuItem?: string;
  showError?: boolean;
}

const ProtectedRoute = ({ 
  children, 
  requireAdmin = false, 
  resource,
  action = 'view',
  menuItem,
  showError = true
}: ProtectedRouteProps) => {
  const { isAuthenticated, user, hasPermission, hasMenuAccess, isLoading } = useAuth();
  const location = useLocation();

  // If still loading, show loading state
  if (isLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login but save the attempted url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check admin requirement
  if (requireAdmin && user?.role !== 'admin') {
    if (showError) {
      return (
        <PermissionError
          customMessage="This feature requires administrator privileges."
          showBackButton={false}
        />
      );
    }
    return <Navigate to="/" replace />;
  }

  // Check resource permission (if specified)
  if (resource && !hasPermission(resource, action)) {
    if (showError) {
      return (
        <PermissionError
          resource={resource}
          action={action}
          showBackButton={false}
        />
      );
    }
    return <Navigate to="/" replace />;
  }

  // Check menu access (if specified)
  if (menuItem && !hasMenuAccess(menuItem)) {
    if (showError) {
      return (
        <PermissionError
          menuItem={menuItem}
          showBackButton={false}
        />
      );
    }
    return <Navigate to="/" replace />;
  }

  // If both resource and menuItem are specified, user must have BOTH permissions
  if (resource && menuItem) {
    const hasResourcePermission = hasPermission(resource, action);
    const hasMenuAccessPermission = hasMenuAccess(menuItem);
    
    if (!hasResourcePermission || !hasMenuAccessPermission) {
      if (showError) {
        return (
          <PermissionError
            resource={resource}
            action={action}
            menuItem={menuItem}
            customMessage={`You don't have the required permissions. ${!hasResourcePermission ? `Missing ${action} permission for ${resource}.` : ''} ${!hasMenuAccessPermission ? `Missing menu access for ${menuItem}.` : ''}`}
            showBackButton={false}
          />
        );
      }
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute; 
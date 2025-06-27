import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  resource?: string;
  action?: string;
  menuItem?: string;
}

const ProtectedRoute = ({ 
  children, 
  requireAdmin = false, 
  resource,
  action = 'view',
  menuItem
}: ProtectedRouteProps) => {
  const { isAuthenticated, user, hasPermission, hasMenuAccess, isLoading } = useAuth();
  const location = useLocation();

  // If still loading, show loading state
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    // Redirect to login but save the attempted url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check admin requirement
  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Check resource permission (if specified)
  if (resource && !hasPermission(resource, action)) {
    console.warn(`Access denied: User ${user?.role} does not have ${action} permission for ${resource}`);
    return <Navigate to="/" replace />;
  }

  // Check menu access (if specified)
  if (menuItem && !hasMenuAccess(menuItem)) {
    console.warn(`Access denied: User ${user?.role} does not have menu access for ${menuItem}`);
    return <Navigate to="/" replace />;
  }

  // If both resource and menuItem are specified, user must have BOTH permissions
  if (resource && menuItem) {
    const hasResourcePermission = hasPermission(resource, action);
    const hasMenuAccessPermission = hasMenuAccess(menuItem);
    
    if (!hasResourcePermission || !hasMenuAccessPermission) {
      console.warn(`Access denied: User ${user?.role} missing required permissions - Resource: ${hasResourcePermission}, Menu: ${hasMenuAccessPermission}`);
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute; 
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

  // Check resource permission
  if (resource && !hasPermission(resource, action)) {
    return <Navigate to="/" replace />;
  }

  // Check menu access
  if (menuItem && !hasMenuAccess(menuItem)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 
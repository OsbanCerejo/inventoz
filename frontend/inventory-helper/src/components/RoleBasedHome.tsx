import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

interface RoleBasedHomeProps {
  children: React.ReactNode;
}

const RoleBasedHome: React.FC<RoleBasedHomeProps> = ({ children }) => {
  const { user, hasMenuAccess, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      // Define role-based default homepages
      const roleDefaults = {
        admin: '/', // Products page
        packing: '/orders/packingMode', // Packing mode
        warehouse_l1: '/whatnot', // Whatnot page
        warehouse_l2: '/price-list', // Price list page
        listing: '/', // Products page (fallback)
        accounts: '/' // Products page (fallback)
      };

      const defaultPath = roleDefaults[user.role as keyof typeof roleDefaults] || '/';
      
      // Check if user has access to their default page
      const hasAccessToDefault = (() => {
        switch (user.role) {
          case 'admin':
            return hasMenuAccess('products');
          case 'packing':
            return hasMenuAccess('packing');
          case 'warehouse_l1':
            return hasMenuAccess('whatnot');
          case 'warehouse_l2':
            return hasMenuAccess('pricelist');
          default:
            return hasMenuAccess('products');
        }
      })();

      // If user doesn't have access to their default page, find the first accessible page
      if (!hasAccessToDefault) {
        const accessiblePages = [
          { path: '/', menuItem: 'products' },
          { path: '/orders/packingMode', menuItem: 'packing' },
          { path: '/whatnot', menuItem: 'whatnot' },
          { path: '/price-list', menuItem: 'pricelist' },
          { path: '/orders/showAll', menuItem: 'orders' },
          { path: '/inbound/showAll', menuItem: 'inbound' },
          { path: '/employee-info', menuItem: 'employeeInfo' },
          { path: '/users', menuItem: 'users' }
        ];

        const firstAccessiblePage = accessiblePages.find(page => hasMenuAccess(page.menuItem));
        if (firstAccessiblePage) {
          navigate(firstAccessiblePage.path, { replace: true });
          return;
        }
      }

      // Navigate to default page if user has access
      if (hasAccessToDefault) {
        navigate(defaultPath, { replace: true });
      }
    }
  }, [user, hasMenuAccess, isLoading, navigate]);

  // Show loading while determining the redirect
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

  return <>{children}</>;
};

export default RoleBasedHome; 
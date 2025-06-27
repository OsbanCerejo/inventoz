import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

interface RoleBasedHomeProps {
  children: React.ReactNode;
}

const RoleBasedHome: React.FC<RoleBasedHomeProps> = ({ children }) => {
  const { isLoading } = useAuth();

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
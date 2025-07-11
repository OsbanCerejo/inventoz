import React, { useState, useCallback } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import EmployeeList from '../components/Employee/EmployeeList';
import EmployeeForm from '../components/Employee/EmployeeForm';

const EmployeeInformation: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleOpenForm = () => {
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
  };

  const handleEmployeeAdded = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <Box sx={{ mt: 4, px: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Employees
      </Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenForm}
        >
          Add Employee
        </Button>
      </Box>

      <EmployeeList refreshTrigger={refreshTrigger} />
      <EmployeeForm 
        open={isFormOpen} 
        onClose={handleCloseForm} 
        onEmployeeAdded={handleEmployeeAdded}
      />
    </Box>
  );
};

export default EmployeeInformation; 
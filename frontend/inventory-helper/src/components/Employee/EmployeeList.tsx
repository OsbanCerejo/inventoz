import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  CircularProgress
} from '@mui/material';
import { Close as CloseIcon, Download as DownloadIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  photoIdPath: string;
  termsAndConditionsSigned: boolean;
  termsAndConditionsDate: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface EmployeeListProps {
  refreshTrigger: number;
}

const API_BASE_URL = `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/api`;

const EmployeeList: React.FC<EmployeeListProps> = ({ refreshTrigger }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { token } = useAuth();

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/employee-info/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch employees');
      }

      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      toast.error('Failed to fetch employee information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [refreshTrigger, token]);

  const handleStatusChange = async (id: number, newStatus: 'approved' | 'rejected') => {
    try {
      const response = await fetch(`${API_BASE_URL}/employee-info/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      toast.success('Status updated successfully');
      fetchEmployees();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleViewDetails = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedEmployee(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'warning';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Submitted</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>{`${employee.firstName} ${employee.lastName}`}</TableCell>
                <TableCell>{employee.email}</TableCell>
                <TableCell>{employee.phone}</TableCell>
                <TableCell>
                  <Chip
                    label={employee.status}
                    color={getStatusColor(employee.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {new Date(employee.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={() => handleViewDetails(employee)}
                    sx={{ mr: 1 }}
                  >
                    View
                  </Button>
                  {employee.status === 'pending' && (
                    <>
                      <Button
                        size="small"
                        color="success"
                        onClick={() => handleStatusChange(employee.id, 'approved')}
                        sx={{ mr: 1 }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleStatusChange(employee.id, 'rejected')}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedEmployee && (
          <>
            <DialogTitle>
              Employee Details
              <IconButton
                aria-label="close"
                onClick={handleCloseDialog}
                sx={{ position: 'absolute', right: 8, top: 8 }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Personal Information
                </Typography>
                <Typography>
                  <strong>Name:</strong> {`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
                </Typography>
                <Typography>
                  <strong>Email:</strong> {selectedEmployee.email}
                </Typography>
                <Typography>
                  <strong>Phone:</strong> {selectedEmployee.phone}
                </Typography>
                <Typography>
                  <strong>Address:</strong> {selectedEmployee.address}
                </Typography>
                <Typography>
                  <strong>Status:</strong>{' '}
                  <Chip
                    label={selectedEmployee.status}
                    color={getStatusColor(selectedEmployee.status)}
                    size="small"
                  />
                </Typography>
                <Typography>
                  <strong>Submitted:</strong>{' '}
                  {new Date(selectedEmployee.createdAt).toLocaleString()}
                </Typography>

                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Documents
                  </Typography>
                  <Button
                    startIcon={<DownloadIcon />}
                    href={`http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/uploads/${selectedEmployee.photoIdPath.split('/').pop()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download Photo ID
                  </Button>
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Terms and Conditions
                  </Typography>
                  <Typography>
                    <strong>Signed:</strong>{' '}
                    {selectedEmployee.termsAndConditionsSigned ? 'Yes' : 'No'}
                  </Typography>
                  {selectedEmployee.termsAndConditionsDate && (
                    <Typography>
                      <strong>Date:</strong>{' '}
                      {new Date(selectedEmployee.termsAndConditionsDate).toLocaleString()}
                    </Typography>
                  )}
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default EmployeeList; 
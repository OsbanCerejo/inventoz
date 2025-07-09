import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import UserForm from '../components/Users/UserForm';
import UserList from '../components/Users/UserList';
import { User } from '../types/User';
import { Add as AddIcon } from '@mui/icons-material';
import {
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { user: currentUser, token } = useAuth();

  // Use the same API URL pattern as Login page
  const API_BASE_URL = `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}/api`;

  const fetchUsers = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token]);

  const handleAddUser = async (userData: Partial<User>) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/users`, userData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUsers([response.data, ...users]);
      setShowForm(false);
      toast.success('User created successfully');
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (userId: number, userData: Partial<User>) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/users/${userId}`, userData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUsers(users.map(user => user.id === userId ? response.data : user));
      setEditingUser(null);
      toast.success('User updated successfully');
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUsers(users.filter(user => user.id !== userId));
      toast.success('User deleted successfully');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setShowForm(false);
  };

  const handleFormSubmit = async (userDataOrId: Partial<User> | number, userData2?: Partial<User>) => {
    if (typeof userDataOrId === 'number') {
      // This is an update operation
      await handleUpdateUser(userDataOrId, userData2!);
    } else {
      // This is an add operation
      await handleAddUser(userDataOrId);
    }
  };

  // Check if current user is admin
  if (!currentUser) {
    return (
      <Box sx={{ mt: 4, px: 3 }}>
        <Alert severity="info">
          Loading user information...
        </Alert>
      </Box>
    );
  }

  if (currentUser?.role !== 'admin') {
    return (
      <Box sx={{ mt: 4, px: 3 }}>
        <Alert severity="error">
          Access denied. Admin privileges required.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4, px: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Users
      </Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowForm(true)}
        >
          Add New User
        </Button>
      </Box>

      {showForm && (
        <Box mb={4}>
          <UserForm
            user={editingUser}
            onSubmit={handleFormSubmit}
            onCancel={handleCancelEdit}
          />
        </Box>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <UserList
          users={users}
          onEdit={handleEditUser}
          onDelete={handleDeleteUser}
          currentUserId={currentUser?.id}
        />
      )}
    </Box>
  );
};

export default Users; 
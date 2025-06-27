import React, { useState, useEffect } from 'react';
import { User } from '../../types/User';
import {
  Card,
  CardContent,
  CardHeader,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Box,
  Grid,
  CircularProgress,
  SelectChangeEvent
} from '@mui/material';

interface UserFormProps {
  user?: User | null;
  onSubmit: (userData: Partial<User> | number, userData2?: Partial<User>) => void | Promise<void>;
  onCancel: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ user, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'listing' as User['role'],
    isActive: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roles: User['role'][] = ['admin', 'listing', 'packing', 'warehouse_l1', 'warehouse_l2', 'accounts'];

  const getRoleDisplayName = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'listing':
        return 'Listing';
      case 'packing':
        return 'Packing';
      case 'warehouse_l1':
        return 'Warehouse L1';
      case 'warehouse_l2':
        return 'Warehouse L2';
      case 'accounts':
        return 'Accounts';
      default:
        return role;
    }
  };

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username,
        email: user.email,
        password: '',
        role: user.role,
        isActive: user.isActive
      });
    }
  }, [user]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!user && !formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.trim() && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData: Partial<User> = { 
        name: formData.name,
        username: formData.username,
        email: formData.email,
        role: formData.role,
        isActive: formData.isActive
      };
      
      if (formData.password.trim()) {
        (submitData as any).password = formData.password;
      }
      
      if (user) {
        await onSubmit(user.id, submitData);
      } else {
        await onSubmit(submitData);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const checked = e.target.checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (e: SelectChangeEvent<User['role']>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name as string]: value
    }));

    // Clear error when user starts typing
    if (name && errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <Card>
      <CardHeader
        title={user ? 'Edit User' : 'Add New User'}
        titleTypographyProps={{ variant: 'h6' }}
      />
      <CardContent>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                error={!!errors.name}
                helperText={errors.name}
                disabled={isSubmitting}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                error={!!errors.username}
                helperText={errors.username}
                disabled={isSubmitting}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                error={!!errors.email}
                helperText={errors.email}
                disabled={isSubmitting}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                error={!!errors.password}
                helperText={errors.password || (user ? 'Leave blank to keep current password' : '')}
                disabled={isSubmitting}
                required={!user}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={isSubmitting}>
                <InputLabel>Role</InputLabel>
                <Select
                  name="role"
                  value={formData.role}
                  label="Role"
                  onChange={handleSelectChange}
                >
                  {roles.map(role => (
                    <MenuItem key={role} value={role}>
                      {getRoleDisplayName(role)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {user && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                    />
                  }
                  label="Active"
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <Box display="flex" gap={1}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting}
                  startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}
                >
                  {isSubmitting ? (user ? 'Updating...' : 'Creating...') : (user ? 'Update User' : 'Create User')}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
};

export default UserForm; 
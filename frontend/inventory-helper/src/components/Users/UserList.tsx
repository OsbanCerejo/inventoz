import React from 'react';
import { User } from '../../types/User';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  People as PeopleIcon
} from '@mui/icons-material';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Chip,
  Typography,
  Box,
  Tooltip
} from '@mui/material';

interface UserListProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (userId: number) => void;
  currentUserId?: number;
}

// UserList component for displaying users in a table format
const UserList: React.FC<UserListProps> = ({ 
  users, 
  onEdit, 
  onDelete, 
  currentUserId 
}) => {
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

  const getRoleColor = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'listing':
        return 'primary';
      case 'packing':
        return 'success';
      case 'warehouse_l1':
        return 'warning';
      case 'warehouse_l2':
        return 'info';
      case 'accounts':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader
        title={`Users (${users.length})`}
        titleTypographyProps={{ variant: 'h6' }}
      />
      <CardContent>
        {users.length === 0 ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <PeopleIcon sx={{ fontSize: 60, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2" color="text.secondary">
              No users found
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Username</strong></TableCell>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell><strong>Role</strong></TableCell>
                  <TableCell><strong>Created</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {user.name || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight="medium">
                          {user.username}
                        </Typography>
                        {user.id === currentUserId && (
                          <Chip label="You" size="small" color="info" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getRoleDisplayName(user.role)}
                        color={getRoleColor(user.role) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {user.createdAt ? formatDate(user.createdAt) : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        <Tooltip title="Edit User">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => onEdit(user)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        {user.id !== currentUserId && (
                          <>
                            <Tooltip title="Delete User">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => onDelete(user.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default UserList; 
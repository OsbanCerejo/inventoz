import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import UserForm from '../components/Users/UserForm';
import UserList from '../components/Users/UserList';
import { getApiUrl } from '../config/api';
import { User } from '../types/User';
import { Add as AddIcon } from '@mui/icons-material';
import {
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  Card,
  CardHeader,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Divider,
  Grid
} from '@mui/material';

type ActiveSession = {
  id: number;
  sessionId: string;
  userId: number;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  geoCountry: string | null;
  geoRegion: string | null;
  geoCity: string | null;
  geoSource: string | null;
  loginAt: string;
  lastSeenAt: string;
  isActive: boolean;
  user: {
    id: number;
    name?: string;
    username: string;
    role: string;
  } | null;
};

type UserPermissionRow = {
  id: number;
  key: string;
  scopeType: 'resource_action' | 'menu';
  resource: string | null;
  action: string | null;
  menuKey: string | null;
  label: string;
  allowed: boolean;
};

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [inactiveSessions, setInactiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [permissionsTargetUser, setPermissionsTargetUser] = useState<User | null>(null);
  const [permissionRows, setPermissionRows] = useState<UserPermissionRow[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const { user: currentUser, token } = useAuth();

  const fetchUsers = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(getApiUrl('api/users'), {
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

  const fetchActiveSessions = async (silent = false) => {
    if (!token) {
      setSessionsLoading(false);
      return;
    }

    try {
      if (!silent) setSessionsLoading(true);
      const response = await axios.get(getApiUrl('api/users/sessions/active'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setActiveSessions(response.data || []);
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      if (!silent) {
        toast.error('Failed to fetch active sessions');
      }
    } finally {
      if (!silent) setSessionsLoading(false);
    }
  };

  const fetchInactiveSessions = async (silent = false) => {
    if (!token) {
      return;
    }

    try {
      const response = await axios.get(getApiUrl('api/users/sessions/inactive'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setInactiveSessions(response.data || []);
    } catch (error) {
      console.error('Error fetching inactive sessions:', error);
      if (!silent) {
        toast.error('Failed to fetch inactive sessions');
      }
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchActiveSessions();
      fetchInactiveSessions();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => {
      fetchActiveSessions(true);
      fetchInactiveSessions(true);
    }, 60000);
    return () => window.clearInterval(id);
  }, [token]);

  const handleAddUser = async (userData: Partial<User>) => {
    try {
      const response = await axios.post(getApiUrl('api/users'), userData, {
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
      const response = await axios.put(getApiUrl(`api/users/${userId}`), userData, {
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
      await axios.delete(getApiUrl(`api/users/${userId}`), {
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

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  };

  const handleEditPermissions = async (user: User) => {
    if (user.role === 'admin') {
      toast.info('Admin users always have full access.');
      return;
    }

    try {
      setPermissionsLoading(true);
      setPermissionsDialogOpen(true);
      setPermissionsTargetUser(user);
      const response = await axios.get(getApiUrl(`api/users/${user.id}/permissions`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPermissionRows(response.data?.permissions || []);
    } catch (error: any) {
      console.error('Error loading user permissions:', error);
      toast.error(error.response?.data?.error || 'Failed to load user permissions');
      setPermissionsDialogOpen(false);
      setPermissionsTargetUser(null);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handlePermissionToggle = (permissionId: number, allowed: boolean) => {
    setPermissionRows((prev) =>
      prev.map((row) => (row.id === permissionId ? { ...row, allowed } : row))
    );
  };

  const handleSavePermissions = async () => {
    if (!permissionsTargetUser) return;
    try {
      setPermissionsSaving(true);
      await axios.put(
        getApiUrl(`api/users/${permissionsTargetUser.id}/permissions`),
        {
          permissions: permissionRows.map((row) => ({
            permissionId: row.id,
            allowed: row.allowed,
          })),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success('Permissions updated successfully');
      setPermissionsDialogOpen(false);
      setPermissionsTargetUser(null);
      setPermissionRows([]);
    } catch (error: any) {
      console.error('Error saving user permissions:', error);
      toast.error(error.response?.data?.error || 'Failed to save user permissions');
    } finally {
      setPermissionsSaving(false);
    }
  };

  const closePermissionsDialog = () => {
    if (permissionsSaving) return;
    setPermissionsDialogOpen(false);
    setPermissionsTargetUser(null);
    setPermissionRows([]);
  };

  const formatGeo = (session: ActiveSession) => {
    const parts = [session.geoCity, session.geoRegion, session.geoCountry].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Unknown';
  };

  const groupedPermissions = permissionRows.reduce((acc, row) => {
    const group = row.scopeType === 'menu' ? 'Menu Visibility' : (row.resource || 'Other');
    if (!acc[group]) acc[group] = [];
    acc[group].push(row);
    return acc;
  }, {} as Record<string, UserPermissionRow[]>);

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
        <>
          <UserList
            users={users}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
            onEditPermissions={handleEditPermissions}
            currentUserId={currentUser?.id}
          />

          <Box mt={4}>
            <Card>
              <CardHeader
                title={`Active Sessions (${activeSessions.length})`}
                subheader="Shows only currently active sessions seen recently."
              />
              <CardContent>
                {sessionsLoading ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={24} />
                  </Box>
                ) : activeSessions.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No active sessions found.
                  </Typography>
                ) : (
                  <TableContainer component={Paper} elevation={0}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>User</strong></TableCell>
                          <TableCell><strong>Role</strong></TableCell>
                          <TableCell><strong>Computer / Device</strong></TableCell>
                          <TableCell><strong>IP</strong></TableCell>
                          <TableCell><strong>Location</strong></TableCell>
                          <TableCell><strong>Login At</strong></TableCell>
                          <TableCell><strong>Last Seen</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeSessions.map((session) => (
                          <TableRow key={session.id} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {session.user?.name || session.user?.username || `User #${session.userId}`}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={session.user?.role || 'N/A'} />
                            </TableCell>
                            <TableCell>{session.deviceName || 'Unknown device'}</TableCell>
                            <TableCell>{session.ipAddress || 'N/A'}</TableCell>
                            <TableCell>
                              <Typography variant="body2">{formatGeo(session)}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Source: {session.geoSource || 'unknown'}
                              </Typography>
                            </TableCell>
                            <TableCell>{formatDateTime(session.loginAt)}</TableCell>
                            <TableCell>{formatDateTime(session.lastSeenAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Box>

          <Box mt={4}>
            <Card>
              <CardHeader
                title={`Inactive Sessions (${inactiveSessions.length})`}
                subheader="Login history for logged-out or stale sessions."
              />
              <CardContent>
                {sessionsLoading ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={24} />
                  </Box>
                ) : inactiveSessions.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No inactive sessions found.
                  </Typography>
                ) : (
                  <TableContainer component={Paper} elevation={0}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>User</strong></TableCell>
                          <TableCell><strong>Role</strong></TableCell>
                          <TableCell><strong>Computer / Device</strong></TableCell>
                          <TableCell><strong>IP</strong></TableCell>
                          <TableCell><strong>Location</strong></TableCell>
                          <TableCell><strong>Login At</strong></TableCell>
                          <TableCell><strong>Last Seen</strong></TableCell>
                          <TableCell><strong>Logged Out</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {inactiveSessions.map((session) => (
                          <TableRow key={`inactive-${session.id}`} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {session.user?.name || session.user?.username || `User #${session.userId}`}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={session.user?.role || 'N/A'} />
                            </TableCell>
                            <TableCell>{session.deviceName || 'Unknown device'}</TableCell>
                            <TableCell>{session.ipAddress || 'N/A'}</TableCell>
                            <TableCell>
                              <Typography variant="body2">{formatGeo(session)}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Source: {session.geoSource || 'unknown'}
                              </Typography>
                            </TableCell>
                            <TableCell>{formatDateTime(session.loginAt)}</TableCell>
                            <TableCell>{formatDateTime(session.lastSeenAt)}</TableCell>
                            <TableCell>{formatDateTime(session.logoutAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Box>
        </>
      )}

      <Dialog
        open={permissionsDialogOpen}
        onClose={closePermissionsDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Edit Permissions{permissionsTargetUser ? ` - ${permissionsTargetUser.name || permissionsTargetUser.username}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {permissionsLoading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress size={24} />
            </Box>
          ) : permissionsTargetUser?.role === 'admin' ? (
            <Alert severity="info">Admins always have full access and cannot be edited.</Alert>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Toggle each permission on/off. Changes are saved for this user only.
              </Alert>
              {Object.entries(groupedPermissions).map(([groupName, rows]) => (
                <Box key={groupName} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                    {groupName}
                  </Typography>
                  <Grid container spacing={1}>
                    {rows.map((row) => (
                      <Grid item xs={12} sm={6} key={row.id}>
                        <Box
                          sx={{
                            border: '1px solid #e5e7eb',
                            borderRadius: 1,
                            px: 1.5,
                            py: 1,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {row.scopeType === 'menu' ? `Menu: ${row.menuKey}` : `${row.resource} - ${row.action}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.key}
                            </Typography>
                          </Box>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={!!row.allowed}
                                onChange={(e) => handlePermissionToggle(row.id, e.target.checked)}
                              />
                            }
                            label={row.allowed ? 'ON' : 'OFF'}
                            labelPlacement="start"
                          />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                  <Divider sx={{ mt: 2 }} />
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePermissionsDialog} disabled={permissionsSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSavePermissions} disabled={permissionsSaving || permissionsLoading}>
            {permissionsSaving ? 'Saving...' : 'Save Permissions'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Users; 

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
  Grid,
  TextField,
  Tooltip,
} from '@mui/material';

// ---------------------------------------------------------------------------
// Permission display configuration
// ---------------------------------------------------------------------------

type SubSectionConfig = {
  label: string;
  resources: string[];
  actions: Record<string, { label: string; description: string }>;
  menuLabel?: string;
};

type ModuleConfig = {
  /** Section header shown in the permissions dialog */
  label: string;
  /** All resource keys that belong to this module (for grouping) */
  resources: string[];
  /** Human-readable label per action key */
  actions: Record<string, { label: string; description: string }>;
  /** Human-readable label for the menu access toggle */
  menuLabel?: string;
  /** Optional sub-sections rendered within this module (e.g. Analytics within Whatnot) */
  subSections?: SubSectionConfig[];
};

const MODULE_CONFIG: Record<string, ModuleConfig> = {
  products: {
    label: 'Products',
    resources: ['products', 'addProduct'],
    menuLabel: 'Show Products in menu',
    actions: {
      view:   { label: 'View',   description: 'Browse and search the product catalog' },
      create: { label: 'Add',    description: 'Create new product records' },
      edit:   { label: 'Edit',   description: 'Update product details and stock' },
      delete: { label: 'Delete', description: 'Remove products from the system' },
    },
  },
  inbound: {
    label: 'Inbound',
    resources: ['inbound'],
    menuLabel: 'Show Inbound in menu',
    actions: {
      view:   { label: 'View',   description: 'View inbound shipment records' },
      create: { label: 'Create', description: 'Log new inbound shipments' },
      edit:   { label: 'Edit',   description: 'Update inbound records' },
      delete: { label: 'Delete', description: 'Remove inbound records' },
    },
  },
  orders: {
    label: 'Orders',
    resources: ['orders'],
    menuLabel: 'Show Orders in menu',
    actions: {
      view:    { label: 'View',    description: 'View all orders' },
      create:  { label: 'Create',  description: 'Create new orders' },
      edit:    { label: 'Edit',    description: 'Update order details' },
      delete:  { label: 'Delete',  description: 'Delete orders' },
      approve: { label: 'Approve', description: 'Approve orders for fulfillment' },
    },
  },
  packing: {
    label: 'Packing',
    resources: ['packing'],
    menuLabel: 'Show Packing in menu',
    actions: {
      view: { label: 'View', description: 'Access packing mode' },
    },
  },
  packingAnalytics: {
    label: 'Packing Analytics',
    resources: ['packingAnalytics'],
    menuLabel: 'Show Packing Analytics in menu',
    actions: {
      view: { label: 'View', description: 'View packing performance analytics' },
    },
  },
  sales: {
    label: 'Sales',
    resources: ['sales'],
    menuLabel: 'Show Sales in menu',
    actions: {
      view:   { label: 'View',   description: 'View sales records' },
      create: { label: 'Create', description: 'Log new sales' },
      edit:   { label: 'Edit',   description: 'Update sales records' },
      delete: { label: 'Delete', description: 'Delete sales records' },
    },
  },
  pricelist: {
    label: 'Price List',
    resources: ['pricelist'],
    menuLabel: 'Show Price List in menu',
    actions: {
      view:   { label: 'View',   description: 'View the price list' },
      create: { label: 'Create', description: 'Add price entries' },
      edit:   { label: 'Edit',   description: 'Update prices' },
      delete: { label: 'Delete', description: 'Remove price entries' },
    },
  },
  priceScanner: {
    label: 'Price Scanner',
    resources: ['priceScanner'],
    menuLabel: 'Show Price Scanner in menu',
    actions: {
      view: { label: 'View', description: 'Use the price scanner tool' },
    },
  },
  whatnot: {
    label: 'Whatnot',
    resources: ['whatnot', 'whatnotFulfillment'],
    menuLabel: 'Show Whatnot in menu',
    actions: {
      view:   { label: 'View',   description: 'View Whatnot shows and fulfillment orders' },
      create: { label: 'Create', description: 'Create Whatnot shows and fulfillment records' },
      edit:   { label: 'Edit',   description: 'Update Whatnot shows and fulfillment records' },
      delete: { label: 'Delete', description: 'Delete Whatnot records' },
    },
    subSections: [
      {
        label: 'Analytics',
        resources: ['whatnotAnalytics'],
        menuLabel: 'Show Whatnot Analytics in menu',
        actions: {
          view: { label: 'View', description: 'View Whatnot show and fulfillment analytics dashboards' },
        },
      },
    ],
  },
  tiktok: {
    label: 'TikTok',
    resources: ['tiktokFulfillment'],
    menuLabel: 'Show TikTok Fulfillment in menu',
    actions: {
      view:   { label: 'View',   description: 'View TikTok fulfillment orders' },
      create: { label: 'Create', description: 'Create TikTok fulfillment records' },
      edit:   { label: 'Edit',   description: 'Update TikTok fulfillment records' },
      delete: { label: 'Delete', description: 'Delete TikTok fulfillment records' },
    },
  },
  walmart: {
    label: 'Walmart',
    resources: ['walmartIntegration', 'walmartOrders'],
    menuLabel: 'Show Walmart in menu',
    actions: {
      view:   { label: 'View',   description: 'View Walmart integration, catalog, and orders' },
      create: { label: 'Create', description: 'Create Walmart records' },
      edit:   { label: 'Edit',   description: 'Update Walmart records' },
      delete: { label: 'Delete', description: 'Delete Walmart records' },
    },
  },
  hba: {
    label: 'HBA',
    resources: ['hbaOrders', 'hbaListing', 'hbaAnalytics'],
    menuLabel: 'Show HBA in menu',
    actions: {
      view:   { label: 'View',   description: 'View HBA orders, listings, and analytics' },
      create: { label: 'Create', description: 'Create HBA orders' },
      edit:   { label: 'Edit',   description: 'Update HBA orders and listings' },
      delete: { label: 'Delete', description: 'Delete HBA orders' },
    },
  },
  labelGenerator: {
    label: 'Label Generator',
    resources: ['labelGenerator'],
    menuLabel: 'Show Label Generator in menu',
    actions: {
      view: { label: 'View', description: 'Use the label generator tool' },
    },
  },
  barcodeScan: {
    label: 'Barcode Scanner',
    resources: ['barcodeScan'],
    menuLabel: 'Show Barcode Scanner in menu',
    actions: {
      view:   { label: 'View',   description: 'Use the barcode scanner' },
      create: { label: 'Scan',   description: 'Log barcode scans' },
    },
  },
  lowStock: {
    label: 'Low Stock Alerts',
    resources: ['lowStock'],
    menuLabel: 'Show Low Stock in menu',
    actions: {
      view: { label: 'View', description: 'View low stock alerts' },
    },
  },
  sortingAnalytics: {
    label: 'Sorting Analytics',
    resources: ['sortingAnalytics'],
    menuLabel: 'Show Sorting Analytics in menu',
    actions: {
      view: { label: 'View', description: 'View sorting performance analytics' },
    },
  },
  brands: {
    label: 'Brand Management',
    resources: ['brands'],
    menuLabel: 'Show Brand Management in menu',
    actions: {
      view:   { label: 'View',   description: 'View brand records' },
      create: { label: 'Create', description: 'Add new brands' },
      edit:   { label: 'Edit',   description: 'Update brand details' },
      delete: { label: 'Delete', description: 'Remove brands' },
    },
  },
  invoiceTracker: {
    label: 'Invoice Tracker',
    resources: ['invoiceTracker'],
    menuLabel: 'Show Invoice Tracker in menu',
    actions: {
      view:   { label: 'View',   description: 'View invoices and payment records' },
      create: { label: 'Create', description: 'Create new invoices' },
      edit:   { label: 'Edit',   description: 'Update invoice details' },
      delete: { label: 'Delete', description: 'Delete invoices' },
    },
  },
  tickets: {
    label: 'Reshipment Tickets',
    resources: ['tickets'],
    menuLabel: 'Show Reshipment Tickets in menu',
    actions: {
      view:   { label: 'View',   description: 'View reshipment tickets' },
      create: { label: 'Create', description: 'Open new reshipment tickets' },
      edit:   { label: 'Edit',   description: 'Update ticket details' },
      delete: { label: 'Delete', description: 'Delete tickets' },
    },
  },
  customerService: {
    label: 'Customer Service',
    resources: ['customerService'],
    menuLabel: 'Show Customer Service in menu',
    actions: {
      view:    { label: 'View',    description: 'View and work on CS tickets' },
      create:  { label: 'Create',  description: 'Open new CS tickets' },
      edit:    { label: 'Edit',    description: 'Update ticket details' },
      assign:  { label: 'Assign',  description: 'Assign tickets to team members, reopen resolved tickets, and receive manager notifications' },
      resolve: { label: 'Resolve', description: 'Mark tickets as resolved' },
      archive: { label: 'Archive', description: 'Archive or cancel tickets' },
    },
  },
  users: {
    label: 'User Management',
    resources: ['users'],
    menuLabel: 'Show User Management in menu',
    actions: {
      view:   { label: 'View',   description: 'View the user list' },
      create: { label: 'Create', description: 'Add new users' },
      edit:   { label: 'Edit',   description: 'Update user details and permissions' },
      delete: { label: 'Delete', description: 'Deactivate or remove users' },
    },
  },
};

// Resources that belong to dead/removed features — hide from the UI
const HIDDEN_RESOURCES = new Set(['employeeInfo', 'pricing', 'ebay']);

// Build a reverse lookup: resource → module key
const RESOURCE_TO_MODULE = new Map<string, string>();
for (const [moduleKey, config] of Object.entries(MODULE_CONFIG)) {
  for (const resource of config.resources) {
    RESOURCE_TO_MODULE.set(resource, moduleKey);
  }
}

// Menu keys that are sub-items of a merged module (don't show as separate top-level entries).
// whatnotAnalytics is NOT here — it has its own menu toggle inside the Whatnot sub-section.
const MERGED_MENU_KEYS = new Set<string>([
  'whatnotFulfillment',  // shown under 'whatnot' module (merged with main)
  'walmartOrders',       // shown under 'walmart' module
  'hbaAnalytics',        // shown under 'hba' module
]);

// ---------------------------------------------------------------------------

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

  const [csNotifDialogOpen, setCsNotifDialogOpen] = useState(false);
  const [csNotifTargetUser, setCsNotifTargetUser] = useState<User | null>(null);
  const [csNotifEmail, setCsNotifEmail] = useState('');
  const [csNotifEnabled, setCsNotifEnabled] = useState(true);
  const [csNotifInAppEnabled, setCsNotifInAppEnabled] = useState(true);
  const [csNotifLoading, setCsNotifLoading] = useState(false);
  const [csNotifSaving, setCsNotifSaving] = useState(false);

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

  const handleEditNotificationSettings = async (user: User) => {
    setCsNotifTargetUser(user);
    setCsNotifEmail('');
    setCsNotifEnabled(true);
    setCsNotifInAppEnabled(true);
    setCsNotifLoading(true);
    setCsNotifDialogOpen(true);
    try {
      const { data } = await axios.get(getApiUrl(`api/users/${user.id}/cs-notification-settings`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCsNotifEmail(data.customerServiceNotificationEmail || '');
      setCsNotifEnabled(data.customerServiceEmailNotificationsEnabled ?? true);
      setCsNotifInAppEnabled(data.customerServiceInAppNotificationsEnabled ?? true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load CS notification settings');
      setCsNotifDialogOpen(false);
    } finally {
      setCsNotifLoading(false);
    }
  };

  const handleSaveCsNotifSettings = async () => {
    if (!csNotifTargetUser) return;
    setCsNotifSaving(true);
    try {
      await axios.patch(
        getApiUrl(`api/users/${csNotifTargetUser.id}/cs-notification-settings`),
        { customerServiceNotificationEmail: csNotifEmail.trim() || null, customerServiceEmailNotificationsEnabled: csNotifEnabled, customerServiceInAppNotificationsEnabled: csNotifInAppEnabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('CS notification settings saved');
      setCsNotifDialogOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setCsNotifSaving(false);
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

  // Build a structured view of permissions grouped by module.
  // Each module section contains: an optional menu toggle + action toggles.
  // For modules that merge multiple resources (e.g. Whatnot), one toggle updates all sub-resource rows.
  type ActionEntry = {
    /** The representative row (used for display + primary toggle) */
    row: UserPermissionRow;
    /** All row IDs for this action across all resources in the module (toggling one toggles all) */
    allRowIds: number[];
    actionLabel: string;
    description: string;
  };
  type SubSection = {
    label: string;
    menuRow: UserPermissionRow | null;
    allMenuRowIds: number[];
    menuLabel: string;
    actionRows: ActionEntry[];
  };
  type ModuleSection = {
    moduleKey: string;
    label: string;
    menuRow: UserPermissionRow | null;
    /** All menu row IDs in this module (toggling menu toggles all sub-menus too) */
    allMenuRowIds: number[];
    menuLabel: string;
    actionRows: ActionEntry[];
    subSections: SubSection[];
  };

  const buildModuleSections = (): ModuleSection[] => {
    const rowByKey = new Map(permissionRows.map((r) => [r.key, r]));
    const sections: ModuleSection[] = [];
    const handledKeys = new Set<string>();

    for (const [moduleKey, config] of Object.entries(MODULE_CONFIG)) {
      // Collect all menu rows for this module (primary + merged sub-menus)
      const allMenuRowIds: number[] = [];
      const primaryMenuRow = rowByKey.get(`menu.${config.resources[0]}`) || null;
      if (primaryMenuRow) {
        handledKeys.add(primaryMenuRow.key);
        allMenuRowIds.push(primaryMenuRow.id);
      }
      // Also collect any merged sub-menu rows
      for (const resource of config.resources.slice(1)) {
        const subMenuRow = rowByKey.get(`menu.${resource}`);
        if (subMenuRow) {
          handledKeys.add(subMenuRow.key);
          allMenuRowIds.push(subMenuRow.id);
        }
      }

      // Collect action entries — one per unique action, merging across all resources
      const actionMap = new Map<string, ActionEntry>();
      for (const resource of config.resources) {
        for (const [action, actionConfig] of Object.entries(config.actions)) {
          const key = `${resource}.${action}`;
          const row = rowByKey.get(key);
          if (!row) continue;
          handledKeys.add(row.key);
          if (!actionMap.has(action)) {
            actionMap.set(action, {
              row,
              allRowIds: [row.id],
              actionLabel: actionConfig.label,
              description: actionConfig.description,
            });
          } else {
            const existing = actionMap.get(action)!;
            existing.allRowIds.push(row.id);
            // If any sub-resource has this ON, show the toggle as ON
            if (row.allowed && !existing.row.allowed) {
              existing.row = row;
            }
          }
        }
      }

      // Build sub-sections (e.g. Whatnot Analytics within Whatnot)
      const subSections: SubSection[] = [];
      for (const subConfig of config.subSections || []) {
        const subMenuRow = rowByKey.get(`menu.${subConfig.resources[0]}`) || null;
        const subMenuRowIds: number[] = subMenuRow ? [subMenuRow.id] : [];
        if (subMenuRow) handledKeys.add(subMenuRow.key);

        const subActionMap = new Map<string, ActionEntry>();
        for (const resource of subConfig.resources) {
          for (const [action, actionConfig] of Object.entries(subConfig.actions)) {
            const key = `${resource}.${action}`;
            const row = rowByKey.get(key);
            if (!row) continue;
            handledKeys.add(row.key);
            if (!subActionMap.has(action)) {
              subActionMap.set(action, { row, allRowIds: [row.id], actionLabel: actionConfig.label, description: actionConfig.description });
            } else {
              const existing = subActionMap.get(action)!;
              existing.allRowIds.push(row.id);
              if (row.allowed && !existing.row.allowed) existing.row = row;
            }
          }
        }

        if (subMenuRow || subActionMap.size > 0) {
          subSections.push({
            label: subConfig.label,
            menuRow: subMenuRow,
            allMenuRowIds: subMenuRowIds,
            menuLabel: subConfig.menuLabel || `Show ${subConfig.label} in menu`,
            actionRows: [...subActionMap.values()],
          });
        }
      }

      if (!primaryMenuRow && actionMap.size === 0 && subSections.length === 0) continue;

      sections.push({
        moduleKey,
        label: config.label,
        menuRow: primaryMenuRow,
        allMenuRowIds,
        menuLabel: config.menuLabel || `Show ${config.label} in menu`,
        actionRows: [...actionMap.values()],
        subSections,
      });
    }

    // Catch-all: any permissions not handled by a module config
    const unhandled = permissionRows.filter(
      (r) => !handledKeys.has(r.key) && !HIDDEN_RESOURCES.has(r.resource || '') && !MERGED_MENU_KEYS.has(r.menuKey || '')
    );
    if (unhandled.length > 0) {
      const otherGroups = new Map<string, UserPermissionRow[]>();
      for (const row of unhandled) {
        const groupKey = row.scopeType === 'menu' ? `menu:${row.menuKey}` : (row.resource || 'Other');
        if (!otherGroups.has(groupKey)) otherGroups.set(groupKey, []);
        otherGroups.get(groupKey)!.push(row);
      }
      for (const [groupKey, rows] of otherGroups) {
        sections.push({
          moduleKey: `__other_${groupKey}`,
          label: groupKey,
          menuRow: null,
          allMenuRowIds: [],
          menuLabel: '',
          actionRows: rows.map((r) => ({
            row: r,
            allRowIds: [r.id],
            actionLabel: r.action || r.menuKey || r.key,
            description: r.key,
          })),
          subSections: [],
        });
      }
    }

    return sections;
  };

  const moduleSections = buildModuleSections();

  // Toggle all rows for an action (handles merged multi-resource modules)
  const handleActionToggle = (allRowIds: number[], allowed: boolean) => {
    setPermissionRows((prev) =>
      prev.map((row) => allRowIds.includes(row.id) ? { ...row, allowed } : row)
    );
  };

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
            onEditNotificationSettings={handleEditNotificationSettings}
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
              {moduleSections.map((section, idx) => (
                <Box key={section.moduleKey} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                    {section.label}
                  </Typography>
                  <Grid container spacing={1}>
                    {/* Menu access toggle */}
                    {section.menuRow && (
                      <Grid item xs={12} sm={6} key={`menu-${section.menuRow.id}`}>
                        <Tooltip title="Controls whether this section appears in the navigation menu" placement="top" arrow>
                          <Box
                            sx={{
                              border: '1px solid #e5e7eb',
                              borderRadius: 1,
                              px: 1.5,
                              py: 1,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              bgcolor: '#f9fafb',
                            }}
                          >
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Menu Access
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {section.menuLabel}
                              </Typography>
                            </Box>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={!!section.menuRow.allowed}
                                  onChange={(e) => handleActionToggle(section.allMenuRowIds, e.target.checked)}
                                />
                              }
                              label={section.menuRow.allowed ? 'ON' : 'OFF'}
                              labelPlacement="start"
                            />
                          </Box>
                        </Tooltip>
                      </Grid>
                    )}
                    {/* Action permission toggles */}
                    {section.actionRows.map(({ row, allRowIds, actionLabel, description }) => (
                      <Grid item xs={12} sm={6} key={`action-${row.id}`}>
                        <Tooltip title={description} placement="top" arrow>
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
                                {actionLabel}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {row.key}
                              </Typography>
                            </Box>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={!!row.allowed}
                                  onChange={(e) => handleActionToggle(allRowIds, e.target.checked)}
                                />
                              }
                              label={row.allowed ? 'ON' : 'OFF'}
                              labelPlacement="start"
                            />
                          </Box>
                        </Tooltip>
                      </Grid>
                    ))}
                  </Grid>
                  {/* Sub-sections (e.g. Analytics within Whatnot) */}
                  {section.subSections.map((sub) => (
                    <Box key={sub.label} sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
                        {sub.label}
                      </Typography>
                      <Grid container spacing={1}>
                        {sub.menuRow && (
                          <Grid item xs={12} sm={6} key={`sub-menu-${sub.menuRow.id}`}>
                            <Tooltip title="Controls whether the analytics section appears in the navigation menu" placement="top" arrow>
                              <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1, px: 1.5, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f9fafb' }}>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Menu Access</Typography>
                                  <Typography variant="caption" color="text.secondary">{sub.menuLabel}</Typography>
                                </Box>
                                <FormControlLabel
                                  control={<Switch checked={!!sub.menuRow.allowed} onChange={(e) => handleActionToggle(sub.allMenuRowIds, e.target.checked)} />}
                                  label={sub.menuRow.allowed ? 'ON' : 'OFF'}
                                  labelPlacement="start"
                                />
                              </Box>
                            </Tooltip>
                          </Grid>
                        )}
                        {sub.actionRows.map(({ row, allRowIds, actionLabel, description }) => (
                          <Grid item xs={12} sm={6} key={`sub-action-${row.id}`}>
                            <Tooltip title={description} placement="top" arrow>
                              <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1, px: 1.5, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{actionLabel}</Typography>
                                  <Typography variant="caption" color="text.secondary">{row.key}</Typography>
                                </Box>
                                <FormControlLabel
                                  control={<Switch checked={!!row.allowed} onChange={(e) => handleActionToggle(allRowIds, e.target.checked)} />}
                                  label={row.allowed ? 'ON' : 'OFF'}
                                  labelPlacement="start"
                                />
                              </Box>
                            </Tooltip>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  ))}
                  {idx < moduleSections.length - 1 && <Divider sx={{ mt: 2 }} />}
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
      <Dialog open={csNotifDialogOpen} onClose={() => !csNotifSaving && setCsNotifDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          CS Notification Settings{csNotifTargetUser ? ` — ${csNotifTargetUser.name || csNotifTargetUser.username}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {csNotifLoading ? (
            <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                Controls Customer Service notification preferences for this user.
                Turning off in-app notifications stops the bell icon from showing CS alerts.
                Turning off email stops CS emails entirely.
              </Alert>
              <TextField
                label="CS Notification Email"
                type="email"
                fullWidth
                value={csNotifEmail}
                onChange={(e) => setCsNotifEmail(e.target.value)}
                placeholder={`Default: ${csNotifTargetUser?.email || 'login email'}`}
                helperText="Leave blank to use the user's login email address."
                sx={{ mb: 3 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={csNotifInAppEnabled}
                    onChange={(e) => setCsNotifInAppEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>In-App Notifications Enabled</Typography>
                    <Typography variant="caption" color="text.secondary">
                      When off, no bell notifications are created for this user for any CS event.
                    </Typography>
                  </Box>
                }
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={csNotifEnabled}
                    onChange={(e) => setCsNotifEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Email Notifications Enabled</Typography>
                    <Typography variant="caption" color="text.secondary">
                      When off, no CS emails are sent. In-app notifications are unaffected.
                    </Typography>
                  </Box>
                }
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCsNotifDialogOpen(false)} disabled={csNotifSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCsNotifSettings} disabled={csNotifSaving || csNotifLoading}>
            {csNotifSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default Users; 

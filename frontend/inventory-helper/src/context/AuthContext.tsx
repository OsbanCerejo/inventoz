import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: number;
  name?: string;
  username: string;
  email: string;
  role: 'admin' | 'listing' | 'packing' | 'warehouse_l1' | 'warehouse_l2' | 'accounts';
  isActive: boolean;
}

interface UserPermissions {
  role: string;
  permissions: Record<string, string[]>;
  menu: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  permissions: UserPermissions | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (resource: string, action: string) => boolean;
  hasMenuAccess: (menuItem: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get the server base URL
  const getServerUrl = () => {
    return `http://${import.meta.env.VITE_SERVER_IP}:${import.meta.env.VITE_SERVER_PORT}`;
  };

  // Fetch user permissions from backend
  const fetchUserPermissions = async (authToken: string) => {
    try {
      console.log('Fetching permissions from:', `${getServerUrl()}/auth/permissions`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await axios.get(`${getServerUrl()}/auth/permissions`, {
        headers: { Authorization: `Bearer ${authToken}` },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('Permissions fetched successfully:', response.data);
      setPermissions(response.data);
    } catch (error) {
      console.error('Failed to fetch user permissions:', error);
      console.log('Using default permissions for role:', user?.role);
      // Set default permissions based on user role to prevent blank page
      if (user) {
        const defaultPermissions = getDefaultPermissions(user.role);
        console.log('Default permissions set:', defaultPermissions);
        setPermissions(defaultPermissions);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Get default permissions based on user role
  const getDefaultPermissions = (role: string): UserPermissions => {
    const rolePermissions = {
      admin: {
        role: 'admin',
        permissions: {
          orders: ['view', 'create', 'edit', 'delete'],
          pricelist: ['view', 'create', 'edit', 'delete'],
          products: ['view', 'create', 'edit', 'delete'],
          inbound: ['view', 'create', 'edit', 'delete'],
          addProduct: ['view', 'create', 'edit', 'delete'],
          packing: ['view'],
          whatnot: ['view', 'create', 'edit', 'delete'],
          employeeInfo: ['view', 'create', 'edit', 'delete'],
          users: ['view', 'create', 'edit', 'delete']
        },
        menu: ['orders', 'pricelist', 'products', 'inbound', 'packing', 'whatnot', 'employeeInfo', 'users']
      },
      packing: {
        role: 'packing',
        permissions: {
          packing: ['view']
        },
        menu: ['packing']
      },
      warehouse_l1: {
        role: 'warehouse_l1',
        permissions: {
          whatnot: ['view']
        },
        menu: ['whatnot']
      },
      warehouse_l2: {
        role: 'warehouse_l2',
        permissions: {
          pricelist: ['view']
        },
        menu: ['pricelist']
      },
      listing: {
        role: 'listing',
        permissions: {},
        menu: []
      },
      accounts: {
        role: 'accounts',
        permissions: {},
        menu: []
      }
    };

    return rolePermissions[role as keyof typeof rolePermissions] || {
      role,
      permissions: {},
      menu: []
    };
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setToken(storedToken);
      setUser(parsedUser);
      setIsAuthenticated(true);
      
      // Set up axios default headers
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      
      // Fetch user permissions
      fetchUserPermissions(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (newToken: string, newUser: User) => {
    setIsLoading(true);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setIsAuthenticated(true);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    
    // Fetch user permissions after login
    await fetchUserPermissions(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setPermissions(null);
    setIsAuthenticated(false);
    setIsLoading(false);
    delete axios.defaults.headers.common['Authorization'];
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!permissions) return false;
    
    const resourcePermissions = permissions.permissions[resource];
    return resourcePermissions ? resourcePermissions.includes(action) : false;
  };

  const hasMenuAccess = (menuItem: string): boolean => {
    if (!permissions) return false;
    return permissions.menu.includes(menuItem);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      permissions,
      login, 
      logout, 
      isAuthenticated,
      isLoading,
      hasPermission,
      hasMenuAccess
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
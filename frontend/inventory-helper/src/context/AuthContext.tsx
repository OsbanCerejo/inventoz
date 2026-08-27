import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import axios from "axios";
import { getServerUrl } from "../config/api";

interface User {
  id: number;
  name?: string;
  username: string;
  email: string;
  role: "admin" | "listing" | "packing" | "warehouse_l1" | "warehouse_l2" | "accounts";
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
  login: (token: string, user: User) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (resource: string, action: string) => boolean;
  hasMenuAccess: (menuItem: string) => boolean;
  getPermissionError: (resource: string, action: string) => string | null;
  getMenuAccessError: (menuItem: string) => string | null;
  checkPermissionWithDetails: (resource: string, action: string) => { hasAccess: boolean; error: string | null };
  checkMenuAccessWithDetails: (menuItem: string) => { hasAccess: boolean; error: string | null };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "token";
const USER_KEY = "user";
const LAST_ACTIVITY_KEY = "lastActivityAt";
const IDLE_TIMEOUT_MINUTES = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || 30);
const IDLE_TIMEOUT_MS = Math.max(IDLE_TIMEOUT_MINUTES, 1) * 60 * 1000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const userRoleRef = useRef<string | null>(null);
  userRoleRef.current = user?.role ?? null;

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const scheduleIdleLogout = (lastActivityAt: number) => {
    clearIdleTimer();
    if (userRoleRef.current === "admin") return;
    const elapsed = Date.now() - lastActivityAt;
    const remaining = Math.max(IDLE_TIMEOUT_MS - elapsed, 0);
    idleTimerRef.current = window.setTimeout(() => {
      clearSession();
      window.location.assign("/login");
    }, remaining);
  };

  const getLastActivityAt = () => {
    const raw = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
    return Number.isFinite(raw) && raw > 0 ? raw : Date.now();
  };

  const touchLastActivity = () => {
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    scheduleIdleLogout(now);
  };

  const applySession = (newToken: string, newUser: User) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    setToken(newToken);
    setUser(newUser);
    setIsAuthenticated(true);
    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    setToken(null);
    setUser(null);
    setPermissions(null);
    setIsAuthenticated(false);
    clearIdleTimer();
    delete axios.defaults.headers.common["Authorization"];
  };

  const fetchUserPermissions = async (authToken: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      const response = await axios.get(`${getServerUrl()}/auth/permissions`, {
        headers: { Authorization: `Bearer ${authToken}` },
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      setPermissions(response.data);
      return true;
    } catch (error) {
      console.error("Failed to fetch user permissions:", error);
      setPermissions(null);
      return false;
    }
  };

  const refreshAccessToken = async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      try {
        const response = await axios.post(
          `${getServerUrl()}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { token: refreshedToken, user: refreshedUser } = response.data || {};
        if (!refreshedToken || !refreshedUser) {
          clearSession();
          return null;
        }
        applySession(refreshedToken, refreshedUser);
        await fetchUserPermissions(refreshedToken);
        return refreshedToken;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (!storedToken || !storedUser) {
        if (mounted) setIsLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(storedUser);
        applySession(storedToken, parsedUser);

        await axios.get(`${getServerUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        await fetchUserPermissions(storedToken);
      } catch {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          clearSession();
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error?.response?.status;
        const originalRequest = error?.config || {};
        const url = String(originalRequest?.url || "");

        if (status !== 401) {
          return Promise.reject(error);
        }
        if (originalRequest._retry) {
          clearSession();
          return Promise.reject(error);
        }
        if (url.includes("/auth/login") || url.includes("/auth/refresh")) {
          clearSession();
          return Promise.reject(error);
        }

        originalRequest._retry = true;
        const refreshedToken = await refreshAccessToken();
        if (!refreshedToken) {
          clearSession();
          return Promise.reject(error);
        }

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        return axios(originalRequest);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || user?.role === "admin") return;

    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const resetIdleTimer = () => touchLastActivity();

    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer));
    scheduleIdleLogout(getLastActivityAt());

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
      clearIdleTimer();
    };
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY && isAuthenticated && user?.role !== "admin") {
        scheduleIdleLogout(getLastActivityAt());
        return;
      }
      if (event.key === TOKEN_KEY || event.key === USER_KEY) {
        const hasToken = !!localStorage.getItem(TOKEN_KEY);
        const hasUser = !!localStorage.getItem(USER_KEY);

        // Only force clear when both keys are removed (explicit logout/clear).
        // During login, token/user are written sequentially and there is a brief
        // intermediate state where one key exists without the other.
        if (!hasToken && !hasUser) {
          clearSession();
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isAuthenticated]);

  const login = async (newToken: string, newUser: User) => {
    setIsLoading(true);
    applySession(newToken, newUser);
    await fetchUserPermissions(newToken);
    setIsLoading(false);
  };

  const logout = () => {
    axios
      .post(`${getServerUrl()}/auth/logout`, {}, { withCredentials: true })
      .catch(() => {});
    clearSession();
    setIsLoading(false);
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!permissions) {
      console.warn(`Permission check failed: permissions not loaded for resource '${resource}', action '${action}'`);
      return false;
    }

    const resourcePermissions = permissions.permissions[resource];
    if (!resourcePermissions) {
      console.warn(`No permissions found for resource '${resource}' in role '${permissions.role}'`);
      return false;
    }

    const hasAccess = resourcePermissions.includes(action);
    if (!hasAccess) {
      console.warn(`Action '${action}' not allowed for resource '${resource}' in role '${permissions.role}'`);
    }

    return hasAccess;
  };

  const hasMenuAccess = (menuItem: string): boolean => {
    if (!permissions) {
      console.warn(`Menu access check failed: permissions not loaded for menu item '${menuItem}'`);
      return false;
    }

    const hasAccess = permissions.menu.includes(menuItem);
    if (!hasAccess) {
      console.warn(`Menu item '${menuItem}' not accessible for role '${permissions.role}'`);
    }

    return hasAccess;
  };

  const getPermissionError = (resource: string, action: string): string | null => {
    if (!permissions) {
      return "Permissions not loaded";
    }

    const resourcePermissions = permissions.permissions[resource];
    if (!resourcePermissions) {
      return `No permissions found for resource '${resource}' in role '${permissions.role}'`;
    }

    const hasAccess = resourcePermissions.includes(action);
    if (!hasAccess) {
      return `Action '${action}' not allowed for resource '${resource}' in role '${permissions.role}'`;
    }

    return null;
  };

  const getMenuAccessError = (menuItem: string): string | null => {
    if (!permissions) {
      return "Permissions not loaded";
    }

    const hasAccess = permissions.menu.includes(menuItem);
    if (!hasAccess) {
      return `Menu item '${menuItem}' not accessible for role '${permissions.role}'`;
    }

    return null;
  };

  const checkPermissionWithDetails = (
    resource: string,
    action: string
  ): { hasAccess: boolean; error: string | null } => {
    if (!permissions) {
      return { hasAccess: false, error: "Permissions not loaded" };
    }

    const resourcePermissions = permissions.permissions[resource];
    if (!resourcePermissions) {
      return { hasAccess: false, error: `No permissions found for resource '${resource}' in role '${permissions.role}'` };
    }

    const hasAccess = resourcePermissions.includes(action);
    if (!hasAccess) {
      return { hasAccess: false, error: `Action '${action}' not allowed for resource '${resource}' in role '${permissions.role}'` };
    }

    return { hasAccess: true, error: null };
  };

  const checkMenuAccessWithDetails = (menuItem: string): { hasAccess: boolean; error: string | null } => {
    if (!permissions) {
      return { hasAccess: false, error: "Permissions not loaded" };
    }

    const hasAccess = permissions.menu.includes(menuItem);
    if (!hasAccess) {
      return { hasAccess: false, error: `Menu item '${menuItem}' not accessible for role '${permissions.role}'` };
    }

    return { hasAccess: true, error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        permissions,
        login,
        logout,
        isAuthenticated,
        isLoading,
        hasPermission,
        hasMenuAccess,
        getPermissionError,
        getMenuAccessError,
        checkPermissionWithDetails,
        checkMenuAccessWithDetails,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

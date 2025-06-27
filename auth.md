## Overview

This document outlines the comprehensive role-based authentication and permissions system implemented in the Inventoz inventory management application. The system provides secure access control with granular permissions based on user roles, ensuring that users can only access features and data relevant to their responsibilities.

## 🏗️ System Architecture

### Backend Components
- **Authentication Middleware** (`backend/middleware/auth.js`)
- **Permissions Middleware** (`backend/middleware/permissions.js`)
- **Role Configuration** (`backend/config/role-permissions.json`)
- **User Management** (`backend/routes/Users.js`)
- **Authentication Routes** (`backend/routes/auth.js`)

### Frontend Components
- **Authentication Context** (`frontend/inventory-helper/src/context/AuthContext.tsx`)
- **Protected Routes** (`frontend/inventory-helper/src/components/ProtectedRoute.tsx`)
- **Role-Based Navigation** (`frontend/inventory-helper/src/components/NavBar.tsx`)
- **Role-Based Home** (`frontend/inventory-helper/src/components/RoleBasedHome.tsx`)

## 👥 User Roles & Permissions

### Available Roles
1. **Admin** - Full system access
2. **Listing** - Product listing management
3. **Packing** - Order packing operations
4. **Warehouse L1** - Whatnot operations
5. **Warehouse L2** - Price list access
6. **Accounts** - Financial operations

### Permission Structure
Each role has specific permissions for different resources:
- **view** - Read access
- **create** - Create new records
- **edit** - Modify existing records
- **delete** - Remove records

### Role Permissions Matrix

| Resource | Admin | Listing | Packing | Warehouse L1 | Warehouse L2 | Accounts |
|----------|-------|---------|---------|--------------|--------------|----------|
| Orders | Full | None | None | None | None | None |
| Price List | Full | None | None | None | View | None |
| Products | Full | None | None | None | None | None |
| Inbound | Full | None | None | None | None | None |
| Add Product | Full | None | None | None | None | None |
| Packing | View | None | View | None | None | None |
| Whatnot | Full | None | None | View | None | None |
| Employee Info | Full | None | None | None | None | None |
| Users | Full | None | None | None | None | None |

## 🔐 Authentication Flow

### 1. Login Process
Users authenticate with email and password, receiving a JWT token for subsequent requests.

### 2. Permission Fetching
After successful login, the frontend automatically fetches user permissions from the backend to determine access rights.

### 3. Route Protection
All protected routes use the `ProtectedRoute` component to verify user permissions before allowing access.

## 🛡️ Security Features

### Backend Security
- **JWT Token Authentication** - Secure token-based authentication
- **Password Hashing** - Bcrypt encryption for password storage
- **Permission Middleware** - Server-side permission validation
- **Role Validation** - Ensures valid user roles
- **Request Validation** - Input sanitization and validation

### Frontend Security
- **Token Storage** - Secure localStorage for authentication tokens
- **Permission Checking** - Client-side permission validation
- **Route Protection** - Automatic redirection for unauthorized access
- **Menu Filtering** - Dynamic menu based on user permissions

## 📋 User Management

### Creating Admin Users
Use the provided script to create the first admin user:

```bash
# Navigate to backend directory
cd backend

# Run the admin creation script
npm run create-admin
```

The script will prompt for:
- Username
- Email
- Password

### User Management Features
- Admin users can create, edit, and manage all user accounts
- Role assignment and updates
- User activation/deactivation
- Password management

## 🎯 Role-Based Features

### 1. Dynamic Navigation
The navigation bar automatically shows only accessible menu items based on user permissions:

```typescript
// Menu items are filtered based on permissions
const menuItems = [
  { key: 'products', label: 'Products', path: '/' },
  { key: 'inbound', label: 'Inbound', path: '/inbound/showAll' },
  { key: 'orders', label: 'Orders', path: '/orders/showAll' },
  // ... other menu items
];

// Only show items user has access to
{menuItems.map((item) => {
  if (!hasMenuAccess(item.key)) return null;
  return <MenuItem key={item.key} {...item} />;
})}
```

### 2. Role-Based Home Pages
Users are automatically redirected to their role-specific home page:

- **Admin** → Products page
- **Packing** → Packing mode
- **Warehouse L1** → Whatnot page
- **Warehouse L2** → Price list page

### 3. Permission-Based Actions
UI elements are conditionally rendered based on permissions:

```typescript
// Show edit button only if user has edit permission
{hasPermission('products', 'edit') && (
  <button onClick={handleEdit}>Edit Product</button>
)}

// Show delete button only if user has delete permission
{hasPermission('products', 'delete') && (
  <button onClick={handleDelete}>Delete Product</button>
)}
```

## 🔧 Configuration

### Role Permissions Configuration
Permissions are defined in `backend/config/role-permissions.json`:

```json
{
  "admin": {
    "orders": ["view", "create", "edit", "delete"],
    "pricelist": ["view", "create", "edit", "delete"],
    "products": ["view", "create", "edit", "delete"],
    "inbound": ["view", "create", "edit", "delete"],
    "addProduct": ["view", "create", "edit", "delete"],
    "packing": ["view"],
    "whatnot": ["view", "create", "edit", "delete"],
    "employeeInfo": ["view", "create", "edit", "delete"],
    "users": ["view", "create", "edit", "delete"],
    "menu": ["orders", "pricelist", "products", "inbound", "packing", "whatnot", "employeeInfo", "users"]
  },
  "packing": {
    "packing": ["view"],
    "menu": ["packing"]
  },
  "warehouse_l1": {
    "whatnot": ["view"],
    "menu": ["whatnot"]
  },
  "warehouse_l2": {
    "pricelist": ["view"],
    "menu": ["pricelist"]
  }
}
```

## 🔄 Maintenance

### Adding New Roles
1. Update `role-permissions.json` with new role configuration
2. Add role to User model enum in `backend/models/User.js`
3. Update frontend role handling in `AuthContext.tsx`
4. Test permissions and menu access

### Modifying Permissions
1. Edit `backend/config/role-permissions.json`
2. Restart backend server
3. Test affected routes and features
4. Update documentation

### User Role Updates
- Admin users can change roles through the Users management interface
- Role changes take effect immediately
- Users are automatically redirected to appropriate home pages

export interface User {
  id: number;
  name?: string;
  username: string;
  email: string;
  role: 'admin' | 'listing' | 'packing' | 'warehouse_l1' | 'warehouse_l2' | 'accounts';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
} 
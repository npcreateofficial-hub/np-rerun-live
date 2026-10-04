import { api } from '@/lib/api';
import type {
  AdminNotification,
  AdminPackage,
  AdminPayment,
  AdminPaymentPayload,
  AdminSales,
  AdminSummary,
  AdminUser,
} from '@/types/admin';

export type AdminUserPayload = {
  email?: string;
  username?: string | null;
  displayName?: string | null;
  phone?: string | null;
  lineId?: string | null;
  licenseKey?: string | null;
  marketingStatus?: 'NEW' | 'FOLLOW_UP' | 'INTERESTED' | 'RENEWED' | 'PAUSED';
  lastContactedAt?: string | null;
  adminNote?: string | null;
  password?: string;
  role?: 'USER' | 'ADMIN' | 'STAFF';
  isActive?: boolean;
  credit?: number;
  packageId?: string | null;
  packageStartedAt?: string | null;
  packageExpiresAt?: string | null;
  deviceLockEnabled?: boolean;
  deviceMoveLimit?: number;
};

export type AdminPackagePayload = {
  category?: string | null;
  name: string;
  code: string;
  description?: string | null;
  priceBaht: number;
  durationDays: number;
  maxAccounts: number;
  maxLiveChannels: number;
  maxVideos: number;
  storageGb: number;
  maxDevices: number;
  maxProxies: number;
  isActive?: boolean;
  sortOrder?: number;
};

export type AdminNotificationPayload = {
  userId?: string | null;
  title: string;
  message: string;
  imageUrl?: string | null;
  styleJson?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  status: 'DRAFT' | 'SENT' | 'ARCHIVED';
};

export const adminService = {
  summary() {
    return api<AdminSummary>('/admin/summary');
  },
  users(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return api<AdminUser[]>(`/admin/users${query}`);
  },
  createUser(payload: AdminUserPayload & { password: string }) {
    return api<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateUser(userId: string, payload: AdminUserPayload) {
    return api<AdminUser>(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  resetUserDevice(userId: string) {
    return api<AdminUser>(`/admin/users/${userId}/device/reset`, { method: 'POST' });
  },
  allowUserDeviceMove(userId: string, moves = 1) {
    return api<AdminUser>(`/admin/users/${userId}/device/allow-move`, { method: 'POST', body: JSON.stringify({ moves }) });
  },
  packages() {
    return api<AdminPackage[]>('/admin/packages');
  },
  createPackage(payload: AdminPackagePayload) {
    return api<AdminPackage>('/admin/packages', { method: 'POST', body: JSON.stringify(payload) });
  },
  updatePackage(packageId: string, payload: Partial<AdminPackagePayload>) {
    return api<AdminPackage>(`/admin/packages/${packageId}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  deletePackage(packageId: string) {
    return api<{ detachedUsers: number }>(`/admin/packages/${packageId}`, { method: 'DELETE' });
  },
  notifications() {
    return api<AdminNotification[]>('/admin/notifications');
  },
  uploadNotificationImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return api<{ imageUrl: string }>('/admin/notifications/upload-image', { method: 'POST', body: formData });
  },
  createNotification(payload: AdminNotificationPayload) {
    return api<AdminNotification>('/admin/notifications', { method: 'POST', body: JSON.stringify(payload) });
  },
  deleteNotification(notificationId: string) {
    return api<{ deleted: boolean; notificationId: string }>(`/admin/notifications/${notificationId}`, { method: 'DELETE' });
  },
  sales() {
    return api<AdminSales>('/admin/sales');
  },
  payments() {
    return api<AdminPayment[]>('/admin/payments');
  },
  updatePayment(paymentId: string, payload: AdminPaymentPayload) {
    return api<AdminPayment>(`/admin/payments/${paymentId}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
};

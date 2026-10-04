import { api } from '@/lib/api';
import type { ChangePasswordPayload, UpdateProfilePayload, UserPermissions, UserProfile } from '@/types/user';

export const userService = {
  me() {
    return api<UserProfile>('/users/me');
  },

  permissions() {
    return api<UserPermissions>('/users/me/permissions');
  },

  updateProfile(payload: UpdateProfilePayload) {
    return api<UserProfile>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  changePassword(payload: ChangePasswordPayload) {
    return api<{ passwordChanged: boolean; refreshTokensRevoked: boolean }>('/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

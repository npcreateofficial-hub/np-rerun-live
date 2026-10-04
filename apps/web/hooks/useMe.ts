'use client';

import { useCallback, useEffect, useState } from 'react';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import type { UpdateProfilePayload, UserProfile } from '@/types/user';

export function useMe() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ใช้ข้อมูลจาก session ที่กำลังล็อกอินอยู่โดยตรง
      // เพื่อไม่ให้หน้าตั้งค่าส่วนตัวไปแสดงข้อมูลผู้ใช้ตัวอย่างหรือผู้ใช้อื่น
      const data = await authService.me();
      setUser(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ';
      setError(message);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateProfile = useCallback(async (payload: UpdateProfilePayload) => {
    setSaving(true);
    setError(null);

    try {
      await userService.updateProfile(payload);

      // อ่านข้อมูลซ้ำจาก auth session หลังบันทึก เพื่อให้ข้อมูลบนหน้าจอ
      // ตรงกับบัญชีที่กำลังล็อกอินจริงเสมอ
      const data = await authService.me();
      setUser(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ';
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return { user, loading, saving, error, load, updateProfile };
}

import { AdminShell } from '@/components/AdminShell';
import { SystemMapClient } from '@/components/SystemMapClient';

export default function SystemPage() {
  return (
    <AdminShell title="โครงระบบ" description="แผนผังเมนูหน้าบ้าน ข้อมูลที่ใช้ และจุดที่หลังบ้านต้องคุม">
      <SystemMapClient />
    </AdminShell>
  );
}

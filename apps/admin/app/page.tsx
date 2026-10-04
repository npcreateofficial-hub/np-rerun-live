import { AdminShell } from '@/components/AdminShell';
import { DashboardClient } from '@/components/DashboardClient';

export default function DashboardPage() {
  return (
    <AdminShell title="ภาพรวมหลังบ้าน" description="ดูจำนวนลูกค้า สิทธิ์ใช้งานถาวร ไลฟ์ออนไลน์ และวิดีโอพร้อมใช้">
      <DashboardClient />
    </AdminShell>
  );
}

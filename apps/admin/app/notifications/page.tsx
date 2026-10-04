import { AdminShell } from '@/components/AdminShell';
import { NotificationsClient } from '@/components/NotificationsClient';

export default function NotificationsPage() {
  return (
    <AdminShell title="แจ้งเตือน" description="สร้างข้อความแจ้งเตือนถึงทุกคนหรือเฉพาะผู้ใช้" hideHeader>
      <NotificationsClient />
    </AdminShell>
  );
}

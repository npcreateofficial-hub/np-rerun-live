import { AdminShell } from '@/components/AdminShell';
import { UsersClient } from '@/components/UsersClient';

export default function UsersPage() {
  return (
    <AdminShell title="ลูกค้า" description="เพิ่มลูกค้า ออกไลเซนส์ User Password และจัดการล็อกเครื่อง" hideHeader>
      <UsersClient />
    </AdminShell>
  );
}

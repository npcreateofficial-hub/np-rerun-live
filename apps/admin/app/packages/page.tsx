import { AdminShell } from '@/components/AdminShell';
import { PackagesClient } from '@/components/PackagesClient';

export default function PackagesPage() {
  return (
    <AdminShell title="จัดการแพ็กเกจ" description="สร้าง แก้ไข ราคา โควตา วันใช้งาน และสถานะเปิดขาย" hideHeader>
      <PackagesClient />
    </AdminShell>
  );
}


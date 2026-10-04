import { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PackagesPageClient } from '@/components/packages/PackagesPageClient';

export default function PackagesPage() {
  return (
    <AppShell>
      <div className="page-pad">
        <Suspense fallback={<div className="rounded-[18px] border border-[#c7962d]/30 bg-black/[0.35] p-8 text-center text-[#d8c8a1]">กำลังโหลดข้อมูลแพ็กเกจ...</div>}>
          <PackagesPageClient />
        </Suspense>
      </div>
    </AppShell>
  );
}
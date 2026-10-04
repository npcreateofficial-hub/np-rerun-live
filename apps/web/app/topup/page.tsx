import { AppShell } from '@/components/layout/AppShell';
import { TopupPageClient } from '@/components/topup/TopupPageClient';

export default function TopupPage() {
  return (
    <AppShell>
      <div className="page-pad">
        <TopupPageClient />
      </div>
    </AppShell>
  );
}

import { AppShell } from '@/components/layout/AppShell';
import { DashboardPageClient } from '@/components/dashboard/DashboardPageClient';

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="page-pad py-5 lg:py-5 2xl:py-6">
        <DashboardPageClient />
      </div>
    </AppShell>
  );
}

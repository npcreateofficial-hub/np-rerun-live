import { AppShell } from '@/components/layout/AppShell';
import { NotificationsPageClient } from '@/components/notifications/NotificationsPageClient';

export default function NotificationsPage() {
  return (
    <AppShell>
      <div className="page-pad">
        <NotificationsPageClient />
      </div>
    </AppShell>
  );
}

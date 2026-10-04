import { AppShell } from '@/components/layout/AppShell';
import { SettingsPageClient } from '@/components/settings/SettingsPageClient';

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="page-pad">
        <SettingsPageClient />
      </div>
    </AppShell>
  );
}

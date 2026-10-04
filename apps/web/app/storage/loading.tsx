import { AppShell } from '@/components/layout/AppShell';
import { Loading } from '@/components/common/Loading';

export default function LoadingPage() {
  return (
    <AppShell>
      <div className="page-pad">
        <Loading />
      </div>
    </AppShell>
  );
}

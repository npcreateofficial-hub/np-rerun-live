'use client';

import { RefreshCcw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';
import { useReruns } from '@/hooks/useReruns';
import { RerunActiveList } from './RerunActiveList';
import { RerunHistoryTable } from './RerunHistoryTable';
import { RerunStartPanel } from './RerunStartPanel';
import { RerunStats } from './RerunStats';

export function RerunPageClient() {
  const {
    usage,
    sessions,
    activeSessions,
    liveChannels,
    readyVideos,
    loading,
    busy,
    error,
    refresh,
    start,
    stop,
    remove,
  } = useReruns();

  const handleStart = async (payload: { liveChannelId: string; videoId: string; title?: string }) => {
    await start(payload);
  };


  return (
    <AppShell>
      <div className="page-pad">
        <div className="mb-5 flex justify-end">
          <Button variant="dark" onClick={refresh} disabled={busy}><RefreshCcw size={16} /> รีเฟรช</Button>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-[#0b79ff]/40 bg-[#071d3f] px-5 py-4 text-[13px] font-semibold text-[#ffd0d0]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="soft-card p-8 text-center text-[14px] font-bold text-[#9d968d]">กำลังโหลดข้อมูลรีรัน...</div>
        ) : (
          <>
            <RerunStats usage={usage} sessions={sessions} activeCount={activeSessions.length} readyVideoCount={readyVideos.length} />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
              <RerunStartPanel
                liveChannels={liveChannels}
                readyVideos={readyVideos}
                busy={busy}
                onStart={handleStart}
              />
              <RerunActiveList sessions={activeSessions} busy={busy} onStop={stop} />
            </div>

            <RerunHistoryTable sessions={sessions} busy={busy} onRemove={remove} />
          </>
        )}
      </div>
    </AppShell>
  );
}

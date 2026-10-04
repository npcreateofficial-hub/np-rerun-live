'use client';

import { Square, Tv } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { RerunStatusBadge } from './RerunStatusBadge';
import type { RerunSession } from '@/types/rerun';

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function RerunActiveList({ sessions, busy, onStop }: { sessions: RerunSession[]; busy: boolean; onStop: (id: string) => Promise<unknown> }) {
  return (
    <section className="soft-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-black text-[#f7f1e7]">กำลัง LIVE</h2>
          <p className="mt-1 text-[13px] font-semibold text-[#9d968d]">รายการที่ FFmpeg กำลังทำงานอยู่</p>
        </div>
        <span className="rounded-full bg-[#4a320d] px-3 py-1 text-[12px] font-black text-[#e3aa3a]">{sessions.length} งาน</span>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#4b3615] bg-[#0b0b0a] px-6 py-10 text-center text-[14px] font-semibold text-[#7f786f]">
          ยังไม่มีงานรีรันที่กำลัง LIVE
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div key={session.id} className="rounded-2xl border border-[#4b3615] bg-[#0b0b0a] p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <RerunStatusBadge status={session.status} />
                    <h3 className="truncate text-[16px] font-black text-[#f7f1e7]">{session.title}</h3>
                  </div>
                  <div className="mt-3 grid gap-2 text-[12px] font-semibold text-[#9d968d] md:grid-cols-2 xl:grid-cols-4">
                    <span className="flex items-center gap-2"><Tv size={14} /> ช่อง: {session.liveChannel?.name || session.liveChannelId}</span>
                    <span>วิดีโอ: {session.video?.title || session.videoId}</span>
                    <span>เริ่ม: {formatDate(session.startedAt)}</span>
                    <span>PID: {session.ffmpegPid || '-'}</span>
                  </div>
                  {session.errorMessage ? <p className="mt-3 rounded-lg bg-[#3c1427] px-3 py-2 text-[12px] font-semibold text-[#ffd0d0]">{session.errorMessage}</p> : null}
                </div>
                <Button variant="pink" onClick={() => onStop(session.id)} disabled={busy}><Square size={15} /> Stop</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

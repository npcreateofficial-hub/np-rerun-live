'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { RerunStatusBadge } from './RerunStatusBadge';
import type { RerunSession } from '@/types/rerun';

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatDuration(value?: number | null) {
  if (!value) return '-';
  const min = Math.floor(value / 60);
  const sec = value % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function RerunHistoryTable({ sessions, busy, onRemove }: { sessions: RerunSession[]; busy: boolean; onRemove: (id: string) => Promise<void> }) {
  return (
    <section className="soft-card mt-6 overflow-hidden p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-black text-[#f7f1e7]">ประวัติรีรัน</h2>
          <p className="mt-1 text-[13px] font-semibold text-[#9d968d]">ดูรอบที่เคย Start / Stop และ error ที่เกิดขึ้น</p>
        </div>
        <span className="text-[13px] font-bold text-[#9d968d]">ทั้งหมด {sessions.length} รายการ</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#4b3615] text-[12px] font-black text-[#9d968d]">
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">ชื่อรอบ</th>
              <th className="px-4 py-3">ช่อง</th>
              <th className="px-4 py-3">วิดีโอ</th>
              <th className="px-4 py-3">เริ่ม</th>
              <th className="px-4 py-3">หยุด</th>
              <th className="px-4 py-3">เวลา</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center font-semibold text-[#7f786f]">ยังไม่มีประวัติรีรัน</td></tr>
            ) : sessions.map((session) => (
              <tr key={session.id} className="border-b border-[#201b12] text-[#e7ded2] last:border-0">
                <td className="px-4 py-4"><RerunStatusBadge status={session.status} /></td>
                <td className="px-4 py-4 font-bold text-[#f7f1e7]">{session.title}</td>
                <td className="px-4 py-4">{session.liveChannel?.name || session.liveChannelId}</td>
                <td className="px-4 py-4">{session.video?.title || session.videoId}</td>
                <td className="px-4 py-4">{formatDate(session.startedAt)}</td>
                <td className="px-4 py-4">{formatDate(session.stoppedAt)}</td>
                <td className="px-4 py-4">{formatDuration(session.durationSec)}</td>
                <td className="px-4 py-4 text-right">
                  {session.status === 'LIVE' || session.status === 'STARTING' || session.status === 'STOPPING' ? null : (
                    <Button variant="ghost" onClick={() => onRemove(session.id)} disabled={busy} className="text-[#e9b94c]"><Trash2 size={15} /> ลบ</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

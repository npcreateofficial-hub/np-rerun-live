import type { ReactNode } from 'react';
import { Activity, ListVideo, Radio, RotateCw } from 'lucide-react';
import type { RerunSession, RerunUsage } from '@/types/rerun';

function StatCard({ label, value, hint, icon }: { label: string; value: string | number; hint: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#4b3615] bg-[#10100f] p-5 shadow-[0_18px_50px_rgba(0,0,0,.18)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-extrabold text-[#e3aa3a]">{label}</p>
          <div className="mt-3 text-[34px] font-black leading-none text-[#f7f1e7]">{value}</div>
          <p className="mt-2 text-[12px] font-semibold text-[#9d968d]">{hint}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0b0b0a] text-[#e3aa3a]">{icon}</div>
      </div>
    </div>
  );
}

export function RerunStats({ usage, sessions, activeCount, readyVideoCount }: { usage: RerunUsage; sessions: RerunSession[]; activeCount: number; readyVideoCount: number }) {
  const ended = sessions.filter((item) => item.status === 'ENDED').length;
  const failed = sessions.filter((item) => item.status === 'FAILED').length;

  return (
    <div className="mb-6 grid gap-4 xl:grid-cols-4 md:grid-cols-2">
      <StatCard label="กำลังรีรัน" value={`${activeCount} / ${usage.limit || '-'}`} hint={`คงเหลือ ${usage.remaining} งาน`} icon={<Activity size={22} />} />
      <StatCard label="วิดีโอ READY" value={readyVideoCount} hint="เลือกมารีรันได้ทันที" icon={<ListVideo size={22} />} />
      <StatCard label="ประวัติสำเร็จ" value={ended} hint="session ที่จบแล้ว" icon={<Radio size={22} />} />
      <StatCard label="ล้มเหลว" value={failed} hint="ตรวจ error message" icon={<RotateCw size={22} />} />
    </div>
  );
}

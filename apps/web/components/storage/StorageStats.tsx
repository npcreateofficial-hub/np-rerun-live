import type { StorageUsage } from '@/types/storage';

function formatGb(value?: number | null) {
  return Number(value ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

export function StorageStats({ usage }: { usage: StorageUsage | null }) {
  const percent = usage?.percent ?? 0;

  return (
    <section className="mt-10 rounded-[16px] bg-[#10100f]/45 px-6 py-7">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-[20px] font-bold text-[#f7f1e7]">การใช้งานพื้นที่จัดเก็บ</h2>
          <p className="mt-4 text-[13px] font-semibold text-[#c9c2b6]">การใช้งานพื้นที่</p>
        </div>
        <b className="text-[14px] font-semibold text-[#f7f1e7]">
          {formatGb(usage?.usedGb)} / {formatGb(usage?.totalGb)} GB · {percent}%
        </b>
      </div>

      <div className="h-2 rounded-full bg-[#4a320d]">
        <div className="h-2 rounded-full bg-[#e3aa3a]" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-4 grid gap-3 text-[13px] font-bold text-[#f7f1e7] md:grid-cols-3">
        <div className="rounded-xl bg-[#0d0d0c] p-4">จำนวนไฟล์ทั้งหมด <span className="float-right text-[#e3aa3a]">{usage?.fileCount ?? 0}</span></div>
        <div className="rounded-xl bg-[#0d0d0c] p-4">จำนวนโฟลเดอร์ <span className="float-right text-[#e3aa3a]">{usage?.folderCount ?? 0}</span></div>
        <div className="rounded-xl bg-[#0d0d0c] p-4">พื้นที่คงเหลือ <span className="float-right text-[#e3aa3a]">{formatGb((usage?.remainingBytes ?? 0) / 1024 / 1024 / 1024)} GB</span></div>
      </div>
    </section>
  );
}

type VideoStatsProps = {
  usedBytes: number;
  fileCount: number;
  videoUsed: number;
  videoLimit: number;
  maxFileSizeGb: number;
};

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

function formatMb(bytes: number) {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes / MB : 0;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function VideoStats({ usedBytes, fileCount, videoUsed, videoLimit, maxFileSizeGb }: VideoStatsProps) {
  const percent = videoLimit > 0 ? Math.min(100, (videoUsed / videoLimit) * 100) : 0;
  const percentLabel = percent.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  const maxBytes = Math.max(0, maxFileSizeGb) * GB;

  return (
    <section className="mt-9 border-t border-[#151412] pt-7">
      <h2 className="text-[17px] font-extrabold text-[#f7f1e7]">โควตาวิดีโอ</h2>

      <div className="mt-4 flex items-center justify-between gap-4 text-[13px] font-semibold text-[#f7f1e7]">
        <span>จำนวนวิดีโอในแพ็กเกจ</span>
        <span>
          {videoUsed.toLocaleString()} / {videoLimit.toLocaleString()} คลิป {percentLabel}%
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#5b4118]">
        <div className="h-full rounded-full bg-[#f1c34d]" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-4 flex items-center justify-between text-[13px] font-bold text-[#f7f1e7]">
        <span>ขนาดสูงสุดต่อคลิป</span>
        <span>คุมจำนวนวิดีโอตามแพ็กเกจ</span>
      </div>

      <div className="mt-3 flex items-center justify-between text-[13px] font-bold text-[#f7f1e7]">
        <span>ไฟล์ที่อัปไว้ตอนนี้</span>
        <span>{fileCount} ไฟล์ · {formatMb(usedBytes)} MB{maxBytes > 0 ? ` จากเพดาน ${formatMb(maxBytes)} MB/คลิป` : ''}</span>
      </div>
    </section>
  );
}

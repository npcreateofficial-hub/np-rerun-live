type Props = {
  label: string;
  used: number;
  total: number;
  suffix?: string;
};

export function UsageBar({ label, used, total, suffix = '' }: Props) {
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-[#e7ded2]">
        <span>{label}</span>
        <span className="text-[#9d968d]">
          {used.toLocaleString()} / {total.toLocaleString()} {suffix}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#2c2418]">
        <div className="h-full rounded-full bg-[#e3aa3a]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

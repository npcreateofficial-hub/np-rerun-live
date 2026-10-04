import { clsx } from 'clsx';

export function StatusBadge({ label, tone = 'mint' }: { label: string; tone?: 'mint' | 'gray' | 'pink' | 'yellow' }) {
  return (
    <span
      className={clsx(
        'pill',
        tone === 'mint' && 'bg-[#e3aa3a] text-[#120d05]',
        tone === 'gray' && 'bg-[#2c2418] text-[#e7ded2]',
        tone === 'pink' && 'bg-[#0647b8] text-[#f7f1e7]',
        tone === 'yellow' && 'bg-[#d4a53b] text-[#120d05]',
      )}
    >
      {label}
    </span>
  );
}

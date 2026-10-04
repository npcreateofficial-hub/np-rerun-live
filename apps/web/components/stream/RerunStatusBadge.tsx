import { clsx } from 'clsx';
import type { RerunStatus } from '@/types/rerun';

const labels: Record<RerunStatus, string> = {
  STARTING: 'STARTING',
  LIVE: 'LIVE',
  STOPPING: 'STOPPING',
  ENDED: 'ENDED',
  FAILED: 'FAILED',
};

export function RerunStatusBadge({ status }: { status: RerunStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex h-7 items-center rounded-full px-3 text-[11px] font-black tracking-wide',
        status === 'LIVE' && 'bg-[#4a320d] text-[#e3aa3a]',
        status === 'STARTING' && 'bg-[#4d3918] text-[#e9b94c]',
        status === 'STOPPING' && 'bg-[#5a3f13] text-[#f0c15a]',
        status === 'ENDED' && 'bg-[#4b3615] text-[#c9c2b6]',
        status === 'FAILED' && 'bg-[#062b68] text-[#ffaaa1]'
      )}
    >
      <span className={clsx('mr-2 h-2 w-2 rounded-full', status === 'LIVE' ? 'bg-[#e3aa3a]' : 'bg-current')} />
      {labels[status]}
    </span>
  );
}

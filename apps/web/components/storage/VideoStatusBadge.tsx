import { StatusBadge } from '@/components/common/StatusBadge';
import type { VideoStatus } from '@/types/video';

const labelMap: Record<VideoStatus, string> = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
};

export function VideoStatusBadge({ status = 'PENDING' }: { status?: VideoStatus }) {
  const tone = status === 'READY' ? 'mint' : status === 'FAILED' ? 'pink' : status === 'PROCESSING' ? 'yellow' : 'gray';
  return <StatusBadge label={labelMap[status]} tone={tone} />;
}

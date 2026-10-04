'use client';

import { useEffect, useMemo, useState } from 'react';
import { VideoCard } from '@/components/storage/VideoCard';
import type { VideoItem } from '@/types/video';

type VideoTableProps = {
  videos: VideoItem[];
  loading?: boolean;
  saving?: boolean;
  onEdit: (video: VideoItem) => void;
  onDelete: (id: string) => void;
};

const ITEMS_PER_PAGE = 8;

export function VideoTable({
  videos,
  loading = false,
  saving = false,
  onEdit,
  onDelete,
}: VideoTableProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [videos]);

  const totalPages = Math.max(1, Math.ceil(videos.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  const visibleVideos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return videos.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, videos]);

  if (loading) {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-[14px] border border-dashed border-[#5b4118] bg-[#0d0d0c]/45 text-[13px] font-semibold text-[#9d968d]">
        กำลังโหลดวิดีโอ...
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-[14px] border border-dashed border-[#5b4118] bg-[#0d0d0c]/45 text-[13px] font-semibold text-[#9d968d]">
        ยังไม่มีวิดีโอในคลัง
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,188px))] justify-start gap-4">
        {visibleVideos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            saving={saving}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center gap-6 text-[13px] font-bold text-[#f7f1e7]">
        <button
          type="button"
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          disabled={currentPage === 1}
          className="grid h-9 w-9 place-items-center rounded-lg bg-[#4b3615] text-[#c9c2b6] transition hover:bg-[#4b3615] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="หน้าก่อนหน้า"
        >
          «
        </button>
        <span>หน้า {currentPage} จาก {totalPages}</span>
        <button
          type="button"
          onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          disabled={currentPage === totalPages}
          className="grid h-9 w-9 place-items-center rounded-lg bg-[#4b3615] text-[#c9c2b6] transition hover:bg-[#4b3615] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="หน้าถัดไป"
        >
          »
        </button>
      </div>
    </>
  );
}

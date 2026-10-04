export function AccountStatusBadge({ status }: { status: 'LIVE' | 'NOTLIVE' | 'STARTING' }) {
  if (status === 'LIVE') {
    return (
      <span className="pill w-[96px] justify-center whitespace-nowrap gap-2 border border-[#c82b34] bg-[#063c9a] text-[#f7f1e7] shadow-[0_5px_14px_rgba(123,7,13,.22)]"><i className="h-2 w-2 rounded-full bg-[#ffd28a]" /> LIVE</span>
    );
  }

  if (status === 'STARTING') {
    return (
      <span className="pill w-[96px] justify-center whitespace-nowrap gap-2 border border-[#2da7ff]/50 bg-[#07325f] text-[9px] text-[#d7efff] shadow-[0_5px_14px_rgba(45,167,255,.20)]"><i className="h-2 w-2 animate-pulse rounded-full bg-[#63c7ff]" /> กำลังเริ่มไลฟ์</span>
    );
  }

  return (
    <span className="pill w-[96px] justify-center whitespace-nowrap gap-2 border border-[#5b4118] bg-[#242320] text-[#ddd5ca]"><i className="h-2 w-2 rounded-full bg-[#8b857b]" /> NOTLIVE</span>
  );
}

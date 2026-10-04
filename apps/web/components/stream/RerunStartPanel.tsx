'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDot, Play, Radio, ShieldAlert, ShieldCheck, ShoppingBag, Video } from 'lucide-react';
import { Button } from '@/components/common/Button';
import type { RerunLiveChannel, RerunVideo } from '@/types/rerun';

export function RerunStartPanel({
  liveChannels,
  readyVideos,
  busy,
  onStart,
}: {
  liveChannels: RerunLiveChannel[];
  readyVideos: RerunVideo[];
  busy: boolean;
  onStart: (payload: { liveChannelId: string; videoId: string; title?: string }) => Promise<void>;
}) {
  const [liveChannelId, setLiveChannelId] = useState('');
  const [videoId, setVideoId] = useState('');
  const [title, setTitle] = useState('');

  const selectedChannel = useMemo(() => liveChannels.find((item) => item.id === liveChannelId), [liveChannels, liveChannelId]);
  const selectedVideo = useMemo(() => readyVideos.find((item) => item.id === videoId), [readyVideos, videoId]);

  useEffect(() => {
    if (!liveChannelId && liveChannels[0]) setLiveChannelId(liveChannels[0].id);
  }, [liveChannels, liveChannelId]);

  useEffect(() => {
    if (!videoId && readyVideos[0]) setVideoId(readyVideos[0].id);
  }, [readyVideos, videoId]);

  async function handleStart() {
    if (!liveChannelId || !videoId) return;
    await onStart({
      liveChannelId,
      videoId,
      title: title.trim() || selectedVideo?.title || 'รีรันไลฟ์',
    });
  }

  const cookieBlocked = selectedChannel?.cookieValid === false;
  const alreadyLive = Boolean(selectedChannel?.isOnline);
  const canStart = Boolean(liveChannelId && videoId && !cookieBlocked && !alreadyLive);

  return (
    <section className="glass-card p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-black text-[#f7f1e7]">สร้างสตรีมและเริ่มไลฟ์</h2>
          <p className="mt-1 text-[13px] font-semibold text-[#9d968d]">เลือกบัญชีและวิดีโอ แล้ว Backend จะสร้าง Shopee Live Session พร้อมดึง push URL อัตโนมัติ</p>
        </div>
        <span className="rounded-full bg-[#11100e] px-3 py-1 text-[11px] font-black text-[#e3aa3a]">COOKIE FLOW</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-[12px] font-black text-[#c9c2b6]">บัญชี Shopee</span>
          <select value={liveChannelId} onChange={(event) => setLiveChannelId(event.target.value)} className="h-11 w-full rounded-xl border border-[#4b3615] bg-[#0b0b0a] px-4 text-[13px] font-semibold text-[#f7f1e7] outline-none focus:border-[#e3aa3a]">
            <option value="">เลือกบัญชี</option>
            {liveChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.accountName || channel.name}{channel.isOnline ? ' • LIVE' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-[12px] font-black text-[#c9c2b6]">วิดีโอ READY</span>
          <select value={videoId} onChange={(event) => setVideoId(event.target.value)} className="h-11 w-full rounded-xl border border-[#4b3615] bg-[#0b0b0a] px-4 text-[13px] font-semibold text-[#f7f1e7] outline-none focus:border-[#e3aa3a]">
            <option value="">เลือกวิดีโอ</option>
            {readyVideos.map((video) => <option key={video.id} value={video.id}>{video.title}</option>)}
          </select>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-2 block text-[12px] font-black text-[#c9c2b6]">ชื่อรอบรีรัน</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="เช่น ไลฟ์รีรันสินค้า 1" className="h-11 w-full rounded-xl border border-[#4b3615] bg-[#0b0b0a] px-4 text-[13px] font-semibold text-[#f7f1e7] outline-none placeholder:text-[#7f786f] focus:border-[#e3aa3a]" />
      </label>

      <div className="mt-5 rounded-2xl border border-[#4b3615] bg-[#0b0b0a]/70 p-4">
        <div className="mb-4 flex items-center gap-2 text-[14px] font-black text-[#f7f1e7]"><Radio size={18} className="text-[#e3aa3a]" /> ระบบจะทำงานอัตโนมัติ</div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { icon: ShieldCheck, text: 'ตรวจ Cookie' },
            { icon: CircleDot, text: 'สร้าง Session' },
            { icon: ShoppingBag, text: 'ปักตะกร้า' },
            { icon: Radio, text: 'ดึง Push URL' },
            { icon: Video, text: 'เปิด FFmpeg' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 rounded-xl border border-[#3f3018] bg-[#15130f] px-3 py-3 text-[11px] font-black text-[#c9c2b6]">
              <Icon size={15} className="shrink-0 text-[#e3aa3a]" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        {selectedChannel ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 ${cookieBlocked ? 'border-[#0b79ff]/45 bg-[#2a1015]' : 'border-[#e3aa3a]/25 bg-[#1a160f]'}`}>
            <div className="flex items-start gap-3">
              {cookieBlocked ? <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[#ff766f]" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#e3aa3a]" />}
              <div className="min-w-0 text-[12px] font-semibold text-[#9d968d]">
                <p className={`font-black ${cookieBlocked ? 'text-[#ffaaa1]' : 'text-[#f0c15a]'}`}>
                  {cookieBlocked ? 'คุกกี้ใช้ไม่ได้ กรุณาเชื่อมบัญชีใหม่' : 'บัญชีพร้อมให้ Backend สร้างสตรีม'}
                </p>
                <p className="mt-1 truncate text-[#e7ded2]">{selectedChannel.accountName || selectedChannel.name}</p>
                <p className="mt-1">Shop ID: {selectedChannel.shopId || '-'} · Platform: {selectedChannel.platform || 'SHOPEE'}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={handleStart} disabled={busy || !canStart}><Play size={16} /> {busy ? 'กำลังสร้างสตรีม...' : 'สร้างสตรีมและขึ้นไลฟ์'}</Button>
          <span className="text-[11px] font-semibold text-[#7f786f]">ไม่ต้องกรอก RTMP URL, Stream Key หรือ Partner Key</span>
        </div>

        {!liveChannelId ? <p className="mt-3 text-[12px] font-semibold text-[#f0c15a]">กรุณาเลือกบัญชี Shopee</p> : null}
        {liveChannelId && !videoId ? <p className="mt-3 text-[12px] font-semibold text-[#f0c15a]">กรุณาเลือกวิดีโอ READY</p> : null}
        {cookieBlocked ? <p className="mt-3 text-[12px] font-semibold text-[#ffaaa1]">คุกกี้ของบัญชีนี้หมดอายุหรือไม่ผ่านการตรวจสอบ</p> : null}
        {alreadyLive ? <p className="mt-3 text-[12px] font-semibold text-[#f0c15a]">บัญชีนี้กำลังไลฟ์อยู่ ต้องหยุดรอบเดิมก่อน</p> : null}
      </div>
    </section>
  );
}

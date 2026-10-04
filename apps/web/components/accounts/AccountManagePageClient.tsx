'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, PlayCircle, RefreshCcw, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';
import { accountService } from '@/services/account.service';
import { rerunService } from '@/services/rerun.service';
import { RerunStartPanel } from '@/components/stream/RerunStartPanel';
import { RerunActiveList } from '@/components/stream/RerunActiveList';
import { RerunHistoryTable } from '@/components/stream/RerunHistoryTable';
import type { LiveChannel } from '@/types/account';
import type { RerunLiveChannel, RerunSession, RerunVideo } from '@/types/rerun';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

function toRerunChannel(channel: LiveChannel): RerunLiveChannel {
  return {
    id: channel.id,
    name: channel.name,
    isOnline: channel.isOnline,
    platform: channel.platform,
    accountName: channel.accountName,
    shopId: channel.shopId,
    platformUid: channel.platformUid,
    avatar: channel.avatar,
    cookieValid: channel.cookieValid,
    liveSessionId: channel.liveSessionId,
  };
}

export function AccountManagePageClient({ id }: { id: string }) {
  const [channel, setChannel] = useState<LiveChannel | null>(null);
  const [videos, setVideos] = useState<RerunVideo[]>([]);
  const [sessions, setSessions] = useState<RerunSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyVideos = useMemo(() => videos.filter((video) => video.status === 'READY'), [videos]);
  const channelSessions = useMemo(() => sessions.filter((session) => session.liveChannelId === id), [sessions, id]);
  const activeSessions = useMemo(
    () => channelSessions.filter((session) => ['STARTING', 'LIVE', 'STOPPING'].includes(session.status)),
    [channelSessions],
  );

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [nextChannel, nextVideos, nextSessions] = await Promise.all([
        accountService.getOne(id),
        rerunService.videos(),
        rerunService.list(),
      ]);
      setChannel(nextChannel);
      setVideos(nextVideos);
      setSessions(nextSessions);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'โหลดข้อมูลบัญชีไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function handleStart(payload: { liveChannelId: string; videoId: string; title?: string }) {
    setBusy(true);
    setError(null);
    try {
      await rerunService.start(payload);
      await refresh();
    } catch (event) {
      setError(event instanceof Error ? event.message : 'เริ่มรีรันไม่สำเร็จ');
      throw event;
    } finally {
      setBusy(false);
    }
  }

  async function handleStop(sessionId: string) {
    setBusy(true);
    setError(null);
    try {
      await rerunService.stop(sessionId);
      await refresh();
    } catch (event) {
      setError(event instanceof Error ? event.message : 'หยุดรีรันไม่สำเร็จ');
      throw event;
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(sessionId: string) {
    setBusy(true);
    setError(null);
    try {
      await rerunService.remove(sessionId);
      await refresh();
    } catch (event) {
      setError(event instanceof Error ? event.message : 'ลบประวัติรีรันไม่สำเร็จ');
      throw event;
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="page-pad">
        <div className="mb-5 flex flex-wrap justify-end gap-3">
          <Link href="/accounts" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-transparent bg-transparent px-4 text-[13px] font-bold text-[#f7f1e7] transition hover:bg-[#151411]/5"><ArrowLeft size={16} /> กลับบัญชี</Link>
          <Button variant="dark" onClick={() => void refresh()} disabled={busy || loading}><RefreshCcw size={16} /> รีเฟรช</Button>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-[#0b79ff]/40 bg-[#071d3f] px-5 py-4 text-[13px] font-semibold text-[#ffd0d0]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="soft-card p-8 text-center text-[14px] font-bold text-[#9d968d]">กำลังโหลดข้อมูลบัญชี...</div>
        ) : !channel ? (
          <div className="soft-card p-8 text-center text-[14px] font-bold text-[#9d968d]">ไม่พบบัญชีนี้</div>
        ) : (
          <>
            <section className="mb-6 grid gap-4 xl:grid-cols-4 md:grid-cols-2">
              <div className="soft-card p-5">
                <p className="text-[12px] font-black text-[#e3aa3a]">ชื่อบัญชี / ช่อง</p>
                <h2 className="mt-2 truncate text-[24px] font-black text-[#f7f1e7]">{channel.name}</h2>
                <p className="mt-2 text-[12px] font-semibold text-[#9d968d]">Account: {channel.accountName || '-'}</p>
              </div>
              <div className="soft-card p-5">
                <p className="text-[12px] font-black text-[#e3aa3a]">Shop ID</p>
                <h2 className="mt-2 truncate text-[24px] font-black text-[#f7f1e7]">{channel.shopId || '-'}</h2>
                <p className="mt-2 text-[12px] font-semibold text-[#9d968d]">UID: {channel.platformUid || '-'}</p>
              </div>
              <div className="soft-card p-5">
                <p className="text-[12px] font-black text-[#e3aa3a]">Cookie</p>
                <h2 className={`mt-2 flex items-center gap-2 text-[20px] font-black ${channel.cookieValid ? 'text-[#e3aa3a]' : 'text-[#0b79ff]'}`}>
                  <ShieldCheck size={20} /> {channel.cookieValid ? 'VALID' : 'UNKNOWN'}
                </h2>
                <p className="mt-2 text-[12px] font-semibold text-[#9d968d]">เช็คล่าสุด: {formatDate(channel.lastCheckedAt)}</p>
              </div>
              <div className="soft-card p-5">
                <p className="text-[12px] font-black text-[#e3aa3a]">สถานะรีรัน</p>
                <h2 className="mt-2 flex items-center gap-2 text-[24px] font-black text-[#f7f1e7]"><PlayCircle size={22} /> {activeSessions.length}</h2>
                <p className="mt-2 text-[12px] font-semibold text-[#9d968d]">วิดีโอ READY: {readyVideos.length} ไฟล์</p>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
              <RerunStartPanel
                liveChannels={[toRerunChannel(channel)]}
                readyVideos={readyVideos}
                busy={busy}
                onStart={handleStart}
              />
              <RerunActiveList sessions={activeSessions} busy={busy} onStop={handleStop} />
            </div>

            <RerunHistoryTable sessions={channelSessions} busy={busy} onRemove={handleRemove} />
          </>
        )}
      </div>
    </AppShell>
  );
}

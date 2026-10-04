'use client';

import CenterPopupNotice, {
  type CenterPopupNoticePayload,
} from '@/components/common/CenterPopupNotice';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AccountTable } from '@/components/accounts/AccountTable';
import { AddAccountDialog } from '@/components/accounts/AddAccountDialog';
import { EditAccountDialog } from '@/components/accounts/EditAccountDialog';
import { useAccounts } from '@/hooks/useAccounts';
import { accountService } from '@/services/account.service';
import { rerunService } from '@/services/rerun.service';
import { videoService } from '@/services/video.service';
import type { LiveChannel } from '@/types/account';
import type { VideoItem } from '@/types/video';

function usagePercent(used: number, limit: number) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function userErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (/<!doctype html|<html|<body|<head|<script|Bad Gateway|API error 502/i.test(message)) {
    return 'เซิร์ฟเวอร์เชื่อมต่อ Backend ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  }
  if (/err_code 90309999|load session Shopee|cookie|session/i.test(message)) {
    return 'Shopee ไม่รับ session ของบัญชีนี้ กรุณาอัปเดตคุกกี้ Shopee ใหม่แล้วลองขึ้นไลฟ์อีกครั้ง';
  }
  if (/libx264|ffmpeg|Error opening output|Operation not permitted|\[libx264/i.test(message)) {
    return 'ดันวิดีโอไป Shopee ไม่สำเร็จ กรุณาลองขึ้นไลฟ์ใหม่ หรือตรวจวิดีโอ/อินเทอร์เน็ต/คุกกี้';
  }
  return message.length > 180 ? message.slice(0, 180) + '...' : message;
}

function PackageOverview({ used, limit, online, remaining, onAddAccount, addDisabled }: { used: number; limit: number; online: number; remaining: number; onAddAccount: () => void; addDisabled?: boolean }) {
  const percent = usagePercent(used, limit);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
      <section className="relative overflow-hidden rounded-[20px] border border-[#c7962d]/55 bg-[radial-gradient(circle_at_15%_0%,rgba(0,121,255,.32),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(240,181,55,.24),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_50%,#171004_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,.48),inset_0_1px_0_rgba(255,255,255,.08)]">
        <div className="mb-5 flex items-center gap-2 text-[15px] font-black text-white">
          <span>แพ็กเกจปัจจุบัน</span>
          <span className="rounded-full border border-[#f2bd4b]/55 bg-[#f2bd4b]/12 px-3 py-1 text-[11px] font-black uppercase tracking-[.08em] text-[#ffd46c]">หลัก</span>
        </div>
        <div className="grid gap-4 md:grid-cols-[repeat(6,minmax(0,1fr))]">
          <div className="text-center md:text-left"><p className="text-[12px] font-bold text-[#9fb1c9]">ช่องทั้งหมด</p><b className="mt-1 block text-[24px] text-white">{limit}</b></div>
          <div className="border-[#c7962d]/25 text-center md:border-l md:pl-4 md:text-left"><p className="text-[12px] font-bold text-[#9fb1c9]">ใช้งานแล้ว</p><b className="mt-1 block text-[24px] text-white">{used}</b></div>
          <div className="border-[#c7962d]/25 text-center md:border-l md:pl-4 md:text-left"><p className="text-[12px] font-bold text-[#9fb1c9]">กำลังไลฟ์</p><b className="mt-1 block text-[24px] text-white">{online}</b></div>
          <div className="border-[#c7962d]/25 text-center md:border-l md:pl-4 md:text-left"><p className="text-[12px] font-bold text-[#9fb1c9]">คงเหลือ</p><b className="mt-1 block text-[24px] text-white">{remaining}</b></div>
          <div className="border-[#c7962d]/25 md:col-span-2 md:border-l md:pl-5">
            <div className="mb-2 flex justify-between text-[12px] font-bold text-[#9fb1c9]"><span>ใช้งาน {percent}%</span><span>เพิ่มได้ {remaining}</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/[0.35]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#f4bd45,#3aa7ff,#0b6cff)] shadow-[0_0_18px_rgba(58,167,255,.28)]" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={onAddAccount}
        disabled={addDisabled}
        className="group grid min-h-[118px] place-items-center rounded-[16px] border border-sky-400/35 bg-[linear-gradient(135deg,rgba(7,58,140,.74),rgba(5,16,34,.92))] text-center text-white shadow-[0_18px_42px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.08)] transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-300/60 hover:bg-[linear-gradient(135deg,rgba(14,96,196,.78),rgba(6,28,58,.94))] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-sky-400/35"
      >
        <div className="flex items-center justify-center gap-5 font-black">
          <Plus size={34} strokeWidth={1.7} className="text-[#ffd46c] drop-shadow-[0_0_14px_rgba(242,189,75,.42)]" />
          <span>เพิ่มบัญชี</span>
        </div>
      </button>
    </div>
  );
}

export default function AccountsPage() {
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<LiveChannel | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [quotaNotice, setQuotaNotice] = useState<CenterPopupNoticePayload | null>(null);
  const {
    filteredItems,
    usage,
    proxies,
    query,
    setQuery,
    loading,
    saving,
    error,
    load,
    checkCookie,
    createAccount,
    updateAccount,
    updateStatus,
    removeAccount,
  } = useAccounts();

  const loadVideos = async () => {
    setVideosLoading(true);
    try {
      const nextVideos = await videoService.list();
      setVideos(nextVideos);
      return nextVideos;
    } catch (error) {
      console.warn(userErrorMessage(error, 'โหลดวิดีโอไม่สำเร็จ'));
      setVideos([]);
      return [] as VideoItem[];
    } finally {
      setVideosLoading(false);
    }
  };

  const openEditAccount = async (account: LiveChannel) => {
    setVideosLoading(true);
    try {
      const [freshAccount, nextVideos] = await Promise.all([
        accountService.getOne(account.id).catch(() => account),
        videoService.list(),
      ]);
      setEditingAccount(freshAccount);
      setVideos(nextVideos);
    } catch (error) {
      console.warn(userErrorMessage(error, 'โหลดข้อมูลบัญชีหรือวิดีโอไม่สำเร็จ'));
      setEditingAccount(account);
      setVideos([]);
    } finally {
      setVideosLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, isOnline: boolean) => {
    setStartError(null);
    try {
      if (!isOnline) {
        const activeSessions = await rerunService.active().catch(() => []);
        const session = activeSessions.find((item) => item.liveChannelId === id);
        if (session) await rerunService.stop(session.id);
        else await updateStatus(id, false);
        await load();
        return;
      }

      const channel = filteredItems.find((item) => item.id === id);
      if (!channel) {
        setStartError('ไม่พบบัญชีนี้ กรุณารีเฟรชหน้าแล้วลองอีกครั้ง');
        console.warn('ไม่พบบัญชีนี้ กรุณารีเฟรชหน้าแล้วลองอีกครั้ง');
        return;
      }

      if (!channel.cookie) {
        setStartError('บัญชีนี้ยังไม่มีคุกกี้ กรุณากดจัดการ > แก้ไขข้อมูล แล้ววางคุกกี้ Shopee ก่อนขึ้นไลฟ์');
        console.warn('บัญชีนี้ยังไม่มีคุกกี้ กรุณากดจัดการ > แก้ไขข้อมูล แล้ววางคุกกี้ Shopee ก่อนขึ้นไลฟ์');
        return;
      }

      if (channel.cookieValid === false) {
        setStartError('คุกกี้ของบัญชีนี้หมดอายุหรือไม่ผ่านการตรวจสอบ กรุณาลบบัญชีแล้วเชื่อมด้วยคุกกี้ใหม่ก่อนขึ้นไลฟ์');
        console.warn('คุกกี้ของบัญชีนี้หมดอายุหรือไม่ผ่านการตรวจสอบ กรุณาลบบัญชีแล้วเชื่อมด้วยคุกกี้ใหม่ก่อนขึ้นไลฟ์');
        return;
      }

      const nextVideos = await loadVideos();
      const selectedVideo = nextVideos.find((item) => item.liveChannelId === id && item.status === 'READY');
      if (!selectedVideo) {
        setStartError('บัญชีนี้ยังไม่มีวิดีโอ READY ที่ผูกไว้ กรุณาไปที่จัดการ > แก้ไขข้อมูล แล้วเลือกวิดีโอของบัญชีนี้ก่อนขึ้นไลฟ์');
        console.warn('บัญชีนี้ยังไม่มีวิดีโอ READY ที่ผูกไว้ กรุณาไปที่จัดการ > แก้ไขข้อมูล แล้วเลือกวิดีโอของบัญชีนี้ก่อนขึ้นไลฟ์');
        return;
      }

      if (!channel.coverImageUrl) {
        setStartError('บัญชีนี้ยังไม่มีภาพปก กรุณาไปที่จัดการ > แก้ไขข้อมูล แล้วเลือกรูปภาพหน้าปกก่อนขึ้นไลฟ์');
        console.warn('บัญชีนี้ยังไม่มีภาพปก กรุณาไปที่จัดการ > แก้ไขข้อมูล แล้วเลือกรูปภาพหน้าปกก่อนขึ้นไลฟ์');
        return;
      }

      await rerunService.start({
        liveChannelId: id,
        videoId: selectedVideo.id,
        title: selectedVideo.title,
        liveChannel: channel,
        video: selectedVideo,
      });
      await load();
      setStartError(null);
    } catch (error) {
      const message = userErrorMessage(error, 'ขึ้นไลฟ์ไม่สำเร็จ');
      setStartError(message);
      console.warn(message);
      await load();
    }
  };

  const onlineCount = useMemo(() => filteredItems.filter((item) => item.isOnline).length, [filteredItems]);
  const used = usage?.used ?? filteredItems.length;
  const limit = usage?.limit ?? 0;
  const remaining = usage?.remaining ?? Math.max(0, limit - used);
  const isAccountQuotaFull = Boolean(usage && !usage.canCreate);

  const handleAddAccountClick = () => {
    if (isAccountQuotaFull) {
      setQuotaNotice({
        id: Date.now(),
        message: 'ใช้งานครบตามแพ็กเกจแล้ว กรุณาติดต่อแอดมิน',
      });
      return;
    }
    setQuotaNotice(null);
    setAddAccountOpen(true);
  };

  useEffect(() => {
    void loadVideos();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!successNotice) return;
    const timer = window.setTimeout(() => setSuccessNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [successNotice]);

  return (
    <AppShell>
      <div className="page-pad min-h-screen py-6 bg-[radial-gradient(circle_at_82%_8%,rgba(13,71,161,.18),transparent_34%),radial-gradient(circle_at_16%_0%,rgba(242,189,75,.11),transparent_28%),linear-gradient(180deg,#05070b_0%,#020305_100%)]">

        <CenterPopupNotice notice={quotaNotice} onClose={() => setQuotaNotice(null)} />

        {successNotice ? <div className="mb-5 rounded-[14px] border border-[#159a58]/70 bg-[#04391f]/90 px-5 py-4 text-[14px] font-black text-[#9cf2b8]">{successNotice}</div> : null}
{error ? <div className="mb-5 rounded-[14px] border border-[#9f2027]/70 bg-[#3b0d11]/75 px-5 py-4 text-[14px] font-bold text-[#ffb0a8]">{error}</div> : null}
        {startError ? <div className="mb-5 rounded-[14px] border border-[#d6a93f]/50 bg-[#2d1e0e]/90 px-5 py-4 text-[14px] font-bold text-[#ffe0a3]">{startError}</div> : null}

        <div className="space-y-4">
          <PackageOverview used={used} limit={limit} online={onlineCount} remaining={remaining} onAddAccount={handleAddAccountClick} addDisabled={saving} />

          <AccountTable
            rows={filteredItems}
            proxies={proxies}
            query={query}
            loading={loading}
            saving={saving}
            videos={videos}
            onQueryChange={setQuery}
            onUpdate={updateAccount}
            onEdit={openEditAccount}
            onToggleStatus={handleToggleStatus}
            onRemove={removeAccount}
          />
        </div>

        <AddAccountDialog
          open={addAccountOpen}
          proxies={proxies}
          saving={saving}
          onClose={() => setAddAccountOpen(false)}
          onCheckCookie={checkCookie}
          onSubmit={async (payload) => {
            await createAccount(payload);
            setAddAccountOpen(false);
          }}
        />
        <EditAccountDialog
          open={Boolean(editingAccount)}
          account={editingAccount}
          proxies={proxies}
          videos={videos}
          loadingVideos={videosLoading}
          saving={saving}
          onClose={() => setEditingAccount(null)}
          onSubmit={async ({ accountId, account, selectedVideoId }) => {
            await updateAccount(accountId, account);
            setEditingAccount(null);
            setSuccessNotice('บันทึกการแก้ไขเรียบร้อย');
            if (selectedVideoId) {
              const video = videos.find((item) => item.id === selectedVideoId);
              videoService
                .update(selectedVideoId, { ...(video?.title ? { title: video.title } : {}), liveChannelId: accountId })
                .catch((error) => {
                  const message = userErrorMessage(error, 'ผูกวิดีโอกับบัญชีไม่สำเร็จ');
                  setStartError(message);
                  console.warn(message);
                });
            }
            void loadVideos();
          }}
        />
      </div>
    </AppShell>
  );
}










'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  BellRing,
  ChevronDown,
  Database,
  Globe2,
  Grid2X2,
  MousePointerClick,
  Power,
  Radio,
  Server,
  Settings,
  Wrench,
} from 'lucide-react';
import { clearAuthTokens } from '@/lib/auth';

const menus = [
  { href: '/dashboard', label: 'แดชบอร์ด', icon: Grid2X2 },
  { href: '/accounts', label: 'ช่องไลฟ์', icon: Radio },
  { href: '/storage', label: 'คลังวิดีโอ', icon: Database },
  { href: '/proxy', label: 'พร็อกซี่', icon: Server },
  { href: '/notifications', label: 'ข่าวสาร', icon: BellRing },
];

const toolMenus = [
  { href: '/tools/control-ads/live', label: 'สร้างโฆษณา Live Ads', icon: MousePointerClick, view: 'live' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [adsView, setAdsView] = useState('overview');

  useEffect(() => {
    function syncAdsView() {
      setAdsView(new URLSearchParams(window.location.search).get('view') || 'overview');
    }
    syncAdsView();
    window.addEventListener('popstate', syncAdsView);
    window.addEventListener('np-live-ads-view-change', syncAdsView);
    return () => {
      window.removeEventListener('popstate', syncAdsView);
      window.removeEventListener('np-live-ads-view-change', syncAdsView);
    };
  }, []);

  function handleLogout() {
    clearAuthTokens();
    router.replace('/login');
  }

  const toolsActive = pathname === '/tools' || pathname.startsWith('/tools/');

  const menuClass = (active: boolean) => clsx(
    'group relative flex h-[54px] items-center gap-3 overflow-hidden rounded-xl border pr-3 transition-all duration-300 ease-out will-change-transform hover:-translate-y-0.5 hover:pl-1 active:translate-y-0 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e3aa3a]/55',
    active
      ? 'border-[#1787ff] bg-gradient-to-r from-[#0b74ff] via-[#0647b8] to-[#071a31] text-white shadow-[0_12px_30px_rgba(11,116,255,.24)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[#f0b728]'
      : 'border-transparent text-[#b8c7da] hover:border-[#25527f] hover:bg-[#071320] hover:text-white hover:shadow-[0_12px_28px_rgba(0,0,0,.26)]',
  );

  const iconClass = (active: boolean) => clsx(
    'grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[11px] border transition-all duration-300 ease-out group-hover:scale-110 group-hover:rotate-3 group-active:scale-95',
    active
      ? 'border-[#79c7ff] bg-[#0b79ff] text-white shadow-[0_10px_24px_rgba(18,76,190,.36)]'
      : 'border-[#274262] bg-[#071320] text-[#f0b728] shadow-[0_8px_18px_rgba(0,0,0,.26)] group-hover:border-[#0b79ff] group-hover:bg-[#071a31] group-hover:text-[#f0b728]',
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[248px] overflow-hidden border-r border-[#203a5a] bg-gradient-to-b from-[#08182b] via-[#050b13] to-[#030508] shadow-[20px_0_70px_rgba(0,0,0,.34)]">
      <div className="flex h-[86px] items-center border-b border-[#203a5a] px-8">
        <Link href="/dashboard" className="flex items-center gap-3 transition duration-300 ease-out hover:scale-[1.02] active:scale-[0.99]">
          <img src="/np-live-logo.png" alt="NP LIVE" className="h-12 w-12 rounded-xl object-cover" />
          <div className="leading-none">
            <div className="text-[27px] font-black tracking-tight text-[#f7f1e7]">NP LIVE</div>
            <div className="mt-1 text-[8px] font-semibold tracking-wide text-[#f0b728]">SOCIAL LIVE STREAMING TOOLS</div>
          </div>
        </Link>
      </div>

      <nav className="px-5 py-5">
        <div className="space-y-2">
          {menus.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={`${item.href}-${item.label}`} href={item.href} className={menuClass(active)}>
                <span className="pointer-events-none absolute inset-0 translate-x-[-115%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[115%]" />
                <span className={iconClass(active)}><item.icon size={23} strokeWidth={2.1} /></span>
                <span className="relative flex-1 text-[15px] font-semibold leading-none transition-transform duration-300 ease-out group-hover:translate-x-0.5">{item.label}</span>
                {active ? <span className="relative h-2 w-2 animate-pulse rounded-full bg-[#f0b728] shadow-[0_0_9px_rgba(240,183,40,.55)]" /> : null}
              </Link>
            );
          })}

          <div>
            <Link href="/tools/control-ads" className={menuClass(toolsActive)}>
              <span className="pointer-events-none absolute inset-0 translate-x-[-115%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[115%]" />
              <span className={iconClass(toolsActive)}><Wrench size={23} strokeWidth={2.1} /></span>
              <span className="relative flex-1 text-[15px] font-semibold leading-none transition-transform duration-300 ease-out group-hover:translate-x-0.5">ยิงแอด</span>
              <ChevronDown size={15} className={clsx('relative text-[#5e7da2] transition-all duration-300 ease-out group-hover:scale-110', toolsActive && 'rotate-180 text-[#f0b728]')} />
            </Link>
            {toolsActive ? (
              <div className="ml-6 mt-2 border-l border-[#203a5a] pl-4">
                <div className="space-y-2">
                  {toolMenus.map((item) => {
                    const active = pathname === item.href || (pathname === '/tools/control-ads' && adsView === item.view);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setAdsView(item.view)}
                        className={clsx(
                          'group/sub relative flex min-h-[46px] items-center gap-3 overflow-hidden rounded-xl border px-2 text-[14px] font-semibold transition-all duration-300 ease-out hover:translate-x-1 active:scale-[0.98]',
                          active
                            ? 'border-[#f0b728] bg-[#101521] text-white shadow-[0_0_0_1px_rgba(240,183,40,.35),0_12px_24px_rgba(0,0,0,.25)] before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-[#f0b728]'
                            : 'border-transparent text-[#95a9c4] hover:border-[#25527f] hover:bg-[#071320] hover:text-white',
                        )}
                      >
                        <span className={clsx('relative grid h-[34px] w-[34px] shrink-0 place-items-center rounded-xl border bg-[#071320] transition-all duration-300 ease-out group-hover/sub:scale-110 group-hover/sub:rotate-3', active ? 'border-[#f0b728] bg-[#122648] text-[#f0b728]' : 'border-[#274262] text-[#f0b728] group-hover/sub:border-[#0b79ff]')}>
                          <item.icon size={17} strokeWidth={2.1} />
                        </span>
                        <span className="relative transition-transform duration-300 ease-out group-hover/sub:translate-x-0.5">{item.label}</span>
                        {active ? <span className="relative ml-auto h-2 w-2 shrink-0 rounded-full bg-[#2fd67a] shadow-[0_0_12px_rgba(47,214,122,.75)]" /> : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <Link href="/contact" className={menuClass(pathname === '/contact')}>
            <span className="pointer-events-none absolute inset-0 translate-x-[-115%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[115%]" />
            <span className={iconClass(pathname === '/contact')}><Globe2 size={23} strokeWidth={2.1} /></span>
            <span className="relative flex-1 text-[15px] font-semibold leading-none transition-transform duration-300 ease-out group-hover:translate-x-0.5">ติดต่อแอดมิน</span>
          </Link>

          <Link href="/settings" className={menuClass(pathname === '/settings')}>
            <span className="pointer-events-none absolute inset-0 translate-x-[-115%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[115%]" />
            <span className={iconClass(pathname === '/settings')}><Settings size={23} strokeWidth={2.1} /></span>
            <span className="relative flex-1 text-[15px] font-semibold leading-none transition-transform duration-300 ease-out group-hover:translate-x-0.5">เปลี่ยนรหัสผ่าน</span>
          </Link>
        </div>
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="group absolute bottom-7 left-5 right-5 flex h-[54px] items-center gap-3 overflow-hidden rounded-xl border border-[#274262] bg-[#071320] pr-3 text-left text-[#f7f1e7] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[#1ba7ff] hover:bg-[#06172f] hover:text-[#bcdcff] hover:shadow-[0_14px_30px_rgba(0,0,0,.28)] active:translate-y-0 active:scale-[0.985]"
      >
        <span className="pointer-events-none absolute inset-0 translate-x-[-115%] bg-gradient-to-r from-transparent via-blue-300/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[115%]" />
        <span className="relative grid h-[46px] w-[46px] place-items-center rounded-xl border border-[#274262] bg-[#06101d] text-[#f0b728] shadow-[0_8px_18px_rgba(0,0,0,.26)] transition-all duration-300 ease-out group-hover:scale-110 group-hover:rotate-6 group-hover:border-[#1ba7ff] group-hover:bg-[#062b68] group-hover:text-white group-active:scale-95">
          <Power size={24} />
        </span>
        <span className="relative flex-1 text-[15px] font-semibold transition-transform duration-300 ease-out group-hover:translate-x-0.5">ออกจากระบบ</span>
        <span className="relative h-2 w-2 rounded-full bg-[#19a7ff] opacity-0 transition-all duration-300 group-hover:scale-125 group-hover:opacity-100" />
      </button>
    </aside>
  );
}

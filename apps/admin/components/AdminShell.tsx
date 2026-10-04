'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Bell, Boxes, LayoutDashboard, LogOut, MonitorPlay, Users } from 'lucide-react';
import { clearAuthTokens } from '@/lib/auth';
import { FRONTEND_URL } from '@/lib/constants';

const links = [
  { href: '/', label: 'ภาพรวม', icon: LayoutDashboard },
  { href: '/users', label: 'ลูกค้า', icon: Users },
  { href: '/packages', label: 'แพ็กเกจ', icon: Boxes },
  { href: '/notifications', label: 'แจ้งเตือน', icon: Bell },
];

export function AdminShell({ title, description, children, hideHeader = false }: { title: string; description: string; children: React.ReactNode; hideHeader?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearAuthTokens();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-[#03070d] text-[#f7f1e7]">
      <aside className="fixed left-0 top-0 z-30 h-screen w-[260px] border-r border-[#203a5a] bg-gradient-to-b from-[#08182b] via-[#050b13] to-[#030508] shadow-[20px_0_70px_rgba(0,0,0,.34)]">
        <div className="border-b border-[#203a5a] px-7 py-6">
          <div className="text-[25px] font-black leading-none">NP LIVE</div>
          <div className="mt-1 text-[11px] font-black tracking-[0.22em] text-[#f0b728]">ADMIN CONTROL</div>
        </div>
        <nav className="space-y-2 px-4 py-5">
          {links.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'group relative flex h-12 items-center gap-3 overflow-hidden rounded-[11px] border px-3 text-[14px] font-black shadow-[0_10px_24px_rgba(0,0,0,.14)]',
                  active
                    ? 'border-[#1787ff] bg-gradient-to-r from-[#0b74ff] via-[#0647b8] to-[#071a31] text-white before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[#f0b728] shadow-[0_12px_30px_rgba(11,116,255,.24)]'
                    : 'border-transparent text-[#b8c7da] hover:border-[#25527f] hover:bg-[#071320] hover:text-white',
                )}
              >
                <span className={clsx('relative grid h-8 w-8 place-items-center rounded-[9px] border', active ? 'border-[#79c7ff] bg-[#0b79ff] text-white' : 'border-[#274262] bg-[#071320] text-[#f0b728]')}>
                  <item.icon size={17} />
                </span>
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
          <div className="pt-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#5e7da2]">Live Site</div>
          <a href={FRONTEND_URL} className="group flex h-12 items-center gap-3 rounded-[11px] border border-[#274262] bg-[#071320] px-3 text-[14px] font-black text-[#f0b728] hover:border-[#0b79ff] hover:bg-[#071a31]">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] border border-[#274262] bg-[#06101d]"><MonitorPlay size={17} /></span>
            <span>เปิดหน้าบ้าน</span>
          </a>
        </nav>
        <button onClick={logout} className="absolute bottom-6 left-4 right-4 flex h-12 items-center gap-3 rounded-[11px] border border-[#274262] bg-[#071320] px-3 text-[14px] font-black text-[#f7f1e7] hover:border-[#1ba7ff] hover:bg-[#06172f]">
          <LogOut size={18} />
          ออกจากหลังบ้าน
        </button>
      </aside>
      <main className="min-h-screen pl-[260px]">
        {!hideHeader ? (
          <header className="sticky top-0 z-20 border-b border-[#203a5a] bg-[#03070d]/88 px-8 py-6 backdrop-blur">
            <div className="rounded-[10px] border border-[#274262] bg-gradient-to-r from-[#071a31] via-[#07111f] to-[#1f1708] px-6 py-5 shadow-[0_22px_55px_rgba(0,0,0,.28)]">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f0b728]">NP LIVE ADMIN</div>
              <h1 className="mt-2 text-[28px] font-black">{title}</h1>
              <p className="mt-1 text-[13px] font-semibold text-[#bcdcff]">{description}</p>
            </div>
          </header>
        ) : null}
        <div className="px-8 py-7">{children}</div>
      </main>
    </div>
  );
}

'use client';

import Link from 'next/link';
import {
  BellRing,
  Boxes,
  CheckCircle2,
  Contact,
  Database,
  Gauge,
  KeyRound,
  Link2,
  Lock,
  MonitorPlay,
  Radio,
  Settings,
  Wrench,
} from 'lucide-react';
import { FRONTEND_URL } from '@/lib/constants';

const flows = [
  {
    front: 'แดชบอร์ด',
    href: '/dashboard',
    icon: Gauge,
    job: 'สรุปสิทธิ์ใช้งานถาวร จำนวนบัญชี ช่องกำลังไลฟ์ วิดีโอ READY และสถานะระบบ',
    admin: 'ภาพรวม + ลูกค้า + สิทธิ์',
    adminHref: '/',
    data: 'User, licenseKey, device lock, Package quota, LiveChannel, Video, Rerun',
  },
  {
    front: 'สตรีมแอคเคาท์',
    href: '/accounts',
    icon: Radio,
    job: 'เพิ่มบัญชี Shopee/TikTok, คุกกี้, วิดีโอ, ลิงก์ดูไลฟ์, สถานะไลฟ์ และตะกร้า',
    admin: 'ลูกค้า + สิทธิ์',
    adminHref: '/users',
    data: 'Package.maxAccounts, maxLiveChannels, User license/device, LiveChannel',
  },
  {
    front: 'พื้นที่จัดเก็บ',
    href: '/storage',
    icon: Database,
    job: 'อัปโหลดวิดีโอจริง เลือกคลิป READY และคุมจำนวนวิดีโอ/ขนาดต่อคลิป',
    admin: 'สิทธิ์ใช้งาน',
    adminHref: '/packages',
    data: 'Package.maxVideos, storageGb = GB/คลิป, Video',
  },
  {
    front: 'พร็อกซี่',
    href: '/proxy',
    icon: KeyRound,
    job: 'เพิ่ม/ตรวจพร็อกซี่และผูกกับบัญชีไลฟ์เพื่อแยกสภาพแวดล้อม',
    admin: 'สิทธิ์ใช้งาน + ลูกค้า',
    adminHref: '/packages',
    data: 'Package.maxProxies, Proxy, LiveChannel.proxyId',
  },
  {
    front: 'เครื่องมือ',
    href: '/tools/control-ads',
    icon: Wrench,
    job: 'ฟีเจอร์เสริม เช่น ควบคุม ads และแจกคอยน์ ต้องเปิดตามสิทธิ์ลูกค้า',
    admin: 'สิทธิ์ใช้งาน + ลูกค้า',
    adminHref: '/packages',
    data: 'Package, User.isActive, User.packageExpiresAt',
  },
  {
    front: 'ติดต่อเจ้าหน้าที่',
    href: '/contact',
    icon: Contact,
    job: 'ช่องทาง support และข้อมูลติดต่อทีมขาย/ทีมช่วยแก้ปัญหา',
    admin: 'แจ้งเตือน',
    adminHref: '/notifications',
    data: 'Notification CTA, ข้อมูล contact static ของเว็บ',
  },
  {
    front: 'ตั้งค่าส่วนตัว',
    href: '/settings',
    icon: Settings,
    job: 'ลูกค้าแก้ข้อมูลส่วนตัว รหัสผ่าน เอกสาร/บัญชีธนาคารฝั่งตนเอง',
    admin: 'ลูกค้า',
    adminHref: '/users',
    data: 'User profile, phone, lineId, marketing note',
  },
  {
    front: 'ออกจากระบบ',
    href: '/login',
    icon: Lock,
    job: 'ล้าง token ฝั่ง browser และกลับหน้า login',
    admin: 'สิทธิ์ผู้ใช้',
    adminHref: '/users',
    data: 'RefreshToken, User.isActive, role guard',
  },
];

const adminControls = [
  { title: 'ลูกค้า', href: '/users', detail: 'สร้างบัญชี กำหนดไลเซนส์ User Password สิทธิ์ใช้งาน สถานะ และล็อกเครื่อง', icon: Boxes },
  { title: 'สิทธิ์ใช้งาน', href: '/packages', detail: 'กำหนดจำนวนบัญชี จำนวนวิดีโอ GB/คลิป พร็อกซี่ และโควตาของรหัสถาวร', icon: CheckCircle2 },
  { title: 'แจ้งเตือน', href: '/notifications', detail: 'ส่งทุกคน/รายลูกค้า มีพรีวิวการ์ด รูปจากไฟล์ สี ฟอนต์ ปุ่ม และสถานะ draft/sent', icon: BellRing },
];

export function SystemMapClient() {
  return (
    <div className="space-y-6">
      <section className="rounded-[10px] border border-[#274262] bg-[#071320] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-black">แผนผังหน้าบ้าน ↔ หลังบ้าน</h2>
            <p className="mt-1 text-[13px] font-bold text-[#95a9c4]">เช็กว่าทุกเมนูมีคนคุม มีข้อมูลรองรับ และลิงก์กลับไปตั้งค่าได้</p>
          </div>
          <a href={FRONTEND_URL} className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#274262] px-4 text-[13px] font-black text-[#f0b728] hover:bg-[#081421]">
            <MonitorPlay size={15} /> เปิดหน้าบ้าน
          </a>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {adminControls.map((item) => (
          <Link key={item.title} href={item.href} className="group rounded-[10px] border border-[#274262] bg-[#071320] p-5 hover:border-[#0b79ff]">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#071a31] text-[#f0b728] group-hover:bg-[#e3aa3a] group-hover:text-[#0b0b0a]">
                <item.icon size={18} />
              </span>
              <span>
                <b className="block text-[16px] text-white">{item.title}</b>
                <span className="mt-1 block text-[12px] font-bold leading-5 text-[#95a9c4]">{item.detail}</span>
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-3">
        {flows.map((flow) => (
          <article key={flow.front} className="rounded-[10px] border border-[#2f271b] bg-[#071320] p-5">
            <div className="grid gap-4 xl:grid-cols-[260px_1fr_240px]">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-[9px] border border-[#274262] bg-[#081421] text-[#f0b728]">
                  <flow.icon size={20} />
                </span>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80642d]">หน้าบ้าน</div>
                  <a href={`${FRONTEND_URL}${flow.href}`} className="mt-1 block text-[18px] font-black text-white hover:text-[#f0b728]">{flow.front}</a>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80642d]">ทำหน้าที่</div>
                <p className="mt-2 text-[13px] font-bold leading-6 text-[#d9d1c5]">{flow.job}</p>
                <p className="mt-3 rounded-[8px] border border-[#203a5a] bg-[#081421] px-3 py-2 text-[12px] font-bold text-[#95a9c4]">ข้อมูลที่ใช้: {flow.data}</p>
              </div>

              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#80642d]">หลังบ้านคุมจาก</div>
                <Link href={flow.adminHref} className="mt-2 inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#e3aa3a] px-4 text-[13px] font-black text-[#0b0b0a]">
                  <Link2 size={14} /> {flow.admin}
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

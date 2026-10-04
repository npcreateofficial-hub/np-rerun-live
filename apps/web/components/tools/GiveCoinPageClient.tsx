import { Search } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PackageSelector } from '@/components/accounts/PackageSelector';

const accounts = [{ id: 1, name: 'cakefubakery' }, { id: 2, name: 'mukmixzl' }, { id: 3, name: 'npcreatemarketing' }];

export function GiveCoinPageClient() {
  return (
    <AppShell><div className="page-pad">
      <section className="soft-card mb-7 p-6"><div className="mb-6 flex items-center justify-between"><h2 className="flex items-center gap-3 text-[17px] font-bold text-[#f7f1e7]">▣ เลือกแพ็คเกจที่ต้องการจัดการ</h2><span className="text-[#7f786f]">⌃</span></div><PackageSelector /></section>
      <section className="content-card p-6"><div className="mb-7 flex justify-end"><label className="relative w-[280px] max-w-full"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7f786f]" /><input className="h-10 w-full rounded-lg border border-[#4b3615] bg-[#12110f] pl-9 pr-3 text-[13px] font-medium text-[#f7f1e7] outline-none placeholder:text-[#7f786f] focus:border-[#e3aa3a]" placeholder="ค้นหาตามชื่อบัญชี..." /></label></div>
        <div className="overflow-hidden rounded-[12px] border border-[#151412] bg-[#10100f]/70"><table className="w-full min-w-[900px] border-collapse text-left text-[13px]"><thead className="text-[#9d968d]"><tr className="border-b border-[#4b3615]"><th className="px-6 py-4 text-center font-black">ลำดับ</th><th className="px-6 py-4 font-black">ชื่อบัญชี ↑</th><th className="px-6 py-4 text-center font-black">สถานะบัญชี</th><th className="px-6 py-4 text-center font-black">สถานะไลฟ์</th><th className="px-6 py-4 text-center font-black">ยอดคอยน์</th><th className="px-6 py-4 text-center font-black">การดำเนินการ</th></tr></thead><tbody>{accounts.map((item) => <tr key={item.id} className="border-b border-[#3d2c12] text-[#e7ded2] last:border-b-0"><td className="px-6 py-4 text-center font-semibold">{item.id}</td><td className="px-6 py-4 font-black text-[#f7f1e7]">{item.name}</td><td className="px-6 py-4 text-center font-semibold">ไม่มีข้อมูล</td><td className="px-6 py-4 text-center font-semibold">ไม่มีข้อมูล</td><td className="px-6 py-4 text-center text-[#9d968d]">-</td><td className="px-6 py-4 text-center"><button className="rounded-lg border border-[#1ba7ff] bg-gradient-to-b from-[#0b79ff] to-[#063c9a] px-4 py-2 text-[12px] font-black text-white transition hover:brightness-110">เชื่อมต่อบัญชี</button></td></tr>)}</tbody></table></div>
        <div className="mt-7 grid grid-cols-3 items-center text-[13px] font-semibold text-[#f7f1e7]"><div className="flex items-center gap-2"><span>แสดง</span><button className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#5b4118] bg-[#151412] px-3 font-bold text-[#f7f1e7]">10⌄</button><span>รายการ</span></div><div className="flex items-center justify-center gap-3"><button className="grid h-9 w-11 place-items-center rounded-lg bg-[#201b12] text-[#7f786f]">«</button><span>Page 1 of 1</span><button className="grid h-9 w-11 place-items-center rounded-lg bg-[#201b12] text-[#7f786f]">»</button></div><div className="text-right">รวมทั้งหมด 3 รายการ</div></div>
      </section>
    </div></AppShell>
  );
}

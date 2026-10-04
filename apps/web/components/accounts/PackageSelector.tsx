'use client';

import { useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import type { LiveChannelUsage } from '@/types/account';

type BuyPackage = {
  name: string;
  channels: number;
  price: number;
};

type PackageSelectorProps = {
  usage?: LiveChannelUsage | null;
  onlineCount?: number;
};

const buyPackages: BuyPackage[] = [
  { name: '5 CH', channels: 5, price: 5000 },
  { name: '20 CH', channels: 20, price: 20000 },
  { name: '10 CH', channels: 10, price: 10000 },
  { name: '50 CH', channels: 50, price: 50000 },
  { name: '50 CH INDO', channels: 50, price: 50000 },
];

export function PackageSelector({ usage, onlineCount = 0 }: PackageSelectorProps) {
  const [isBuyOpen, setIsBuyOpen] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<BuyPackage | null>(null);

  const used = usage?.used ?? 0;
  const limit = usage?.limit ?? 0;
  const remaining = usage?.remaining ?? 0;
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const closeDialog = () => {
    setIsBuyOpen(false);
    setIsSelectOpen(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-[#d09a30] bg-gradient-to-br from-[#171613] to-[#0c0c0b] px-5 py-4 shadow-[0_0_0_2px_rgba(224,167,51,.08),0_12px_28px_rgba(0,0,0,.20)]">
        <div className="flex w-full items-center gap-2 sm:min-w-[210px] sm:w-auto text-[12px] font-black text-[#f7f1e7]">
          <span className="grid h-5 w-5 place-items-center overflow-hidden rounded-[5px] bg-[#ff5722]">
            <img src="/icons/shopee.png" alt="Shopee" className="h-4 w-4 object-contain" />
          </span>
          <span>แพ็คเกจปัจจุบัน</span>
          <span className="rounded-full bg-[#e0a737] px-2 py-0.5 text-[10px] font-black leading-none text-[#1b1104]">หลัก</span>
        </div>

        <div className="grid w-full flex-1 grid-cols-2 sm:min-w-[520px] gap-x-5 gap-y-2 text-[12px] font-medium text-[#c0b7aa] md:grid-cols-4">
          <div className="border-l border-[#5b4118]/70 pl-4"><span>ช่องทั้งหมด</span><b className="mt-1 block text-[14px] text-[#f7f1e7]">{limit}</b></div>
          <div className="border-l border-[#5b4118]/70 pl-4"><span>ใช้งานแล้ว</span><b className="mt-1 block text-[14px] text-[#f7f1e7]">{used}</b></div>
          <div className="border-l border-[#5b4118]/70 pl-4"><span>กำลังไลฟ์</span><b className="mt-1 block text-[14px] text-[#f0c45c]">{onlineCount}</b></div>
          <div className="border-l border-[#5b4118]/70 pl-4"><span>คงเหลือ</span><b className="mt-1 block text-[14px] text-[#e0a737]">{remaining}</b></div>
        </div>

        <div className="w-full flex-1 sm:min-w-[260px]">
          <div className="mb-2 flex justify-between text-[11px] font-semibold text-[#91887d]"><span>ใช้งาน {percent}%</span><span>{usage?.canCreate ? 'เพิ่มได้' : 'เต็มแล้ว'}</span></div>
          <div className="h-2 rounded-full bg-[#3d2c12]"><div className="h-2 rounded-full bg-gradient-to-r from-[#0b79ff] to-[#e0a737]" style={{ width: `${percent}%` }} /></div>
        </div>

        <button
          type="button"
          onClick={() => setIsBuyOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-[#76551f] bg-[#0c0c0b]/60 px-4 text-[12px] font-black text-[#c39131] transition hover:border-[#e0a737] hover:bg-[#17130d] hover:text-[#efbf52]"
          aria-label="ซื้อแพ็คเกจใหม่"
        >
          <Plus size={16} strokeWidth={2.4} /> เพิ่มแพ็คเกจ
        </button>
      </div>

      {isBuyOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 px-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-[520px] rounded-[14px] border border-[#5b4118] bg-gradient-to-br from-[#171613] to-[#0c0c0b] px-7 py-7 text-[#f7f1e7] shadow-[0_24px_70px_rgba(0,0,0,.55)]">
            <button
              type="button"
              onClick={closeDialog}
              className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-[#695432] text-[#c7b99f] transition hover:border-[#e0a737] hover:text-[#e0a737]"
              aria-label="ปิด"
            >
              <X size={20} />
            </button>

            <h3 className="text-[22px] font-black tracking-tight text-[#f6efe5]">ซื้อแพ็คเกจใหม่</h3>

            <div className="mt-7">
              <label className="mb-2 block text-[15px] font-bold text-[#f6efe5]">แพ็คเกจที่ต้องการเลือกซื้อ</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSelectOpen((value) => !value)}
                  className={`flex h-[42px] w-full items-center justify-between rounded-[7px] border bg-[#0d0d0c] px-3.5 text-left text-[14px] font-medium outline-none transition ${isSelectOpen ? 'border-[#e0a737] shadow-[0_0_0_3px_rgba(224,167,55,.14)]' : 'border-[#4d3918] hover:border-[#8d6726]'}`}
                >
                  <span className={selectedPackage ? 'text-[#f3eadf]' : 'text-[#8f877c]'}>
                    {selectedPackage ? selectedPackage.name : 'กรุณาเลือกแพ็คเกจที่ต้องการ...'}
                  </span>
                  <ChevronDown size={15} className="text-[#d6a23b]" />
                </button>

                {isSelectOpen ? (
                  <div className="absolute left-0 right-0 top-[50px] z-20 overflow-hidden rounded-[8px] border border-[#5b4118] bg-[#10100f] p-2 shadow-[0_22px_45px_rgba(0,0,0,.48)]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPackage(null);
                        setIsSelectOpen(false);
                      }}
                      className="mb-1 flex w-full items-center gap-2 rounded-[7px] bg-[#321014] px-3 py-2.5 text-left text-[14px] font-medium text-[#e9ded0]"
                    >
                      <Check size={16} className="text-[#e0a737]" /> กรุณาเลือกแพ็คเกจที่ต้องการ...
                    </button>
                    {buyPackages.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => {
                          setSelectedPackage(item);
                          setIsSelectOpen(false);
                        }}
                        className="block w-full rounded-[7px] px-8 py-2.5 text-left text-[15px] font-medium text-[#ded5c9] transition hover:bg-[#271013] hover:text-[#f7f1e7]"
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-7 space-y-5 text-[15px] font-medium text-[#d9d0c4]">
              <div className="grid grid-cols-[1fr_90px_50px] items-center gap-3">
                <span>จำนวนช่อง</span>
                <b className="text-right text-[18px] font-medium text-[#f7f1e7]">{selectedPackage?.channels ?? 0}</b>
                <span className="text-right">ช่อง</span>
              </div>
              <div className="grid grid-cols-[1fr_90px_50px] items-center gap-3">
                <span>ราคาที่ต้องชำระเงินทั้งหมด</span>
                <b className="text-right text-[18px] font-medium text-[#e9b94c]">{selectedPackage?.price ?? 0}</b>
                <span className="text-right">บาท</span>
              </div>
            </div>

            <div className="mt-9 flex justify-end gap-5">
              <button type="button" onClick={closeDialog} className="rounded-[8px] px-4 py-2 text-[14px] font-bold text-[#c6bcaf] transition hover:text-[#f7f1e7]">
                ยกเลิก
              </button>
              <button type="button" className="rounded-[8px] border border-[#c42a32] bg-gradient-to-b from-[#b71a22] to-[#063c9a] px-7 py-2.5 text-[14px] font-black text-[#f7f1e7] shadow-[0_10px_24px_rgba(112,7,13,.25)] transition hover:brightness-110">
                สั่งซื้อ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}



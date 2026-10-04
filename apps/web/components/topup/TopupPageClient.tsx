'use client';

import { ChangeEvent, useState } from 'react';
import clsx from 'clsx';
import { Banknote, Copy, CreditCard, Gift, Info, QrCode, WalletCards, X } from 'lucide-react';
import { paymentService } from '@/services/payment.service';
import type { PaymentItem } from '@/types/payment';

const bankAccount = {
  bank: 'โอนเงิน',
  number: '158-3-652430',
  name: 'บจก.เอ็นพี ครีเอ็ท',
};

const paymentMethods = [
  {
    key: 'promptpay',
    title: 'PromptPay QR Code',
    subtitle: 'ปิดใช้งาน',
    icon: QrCode,
    active: false,
  },
  {
    key: 'bank',
    title: 'โอนเงิน',
    subtitle: 'โอนเงินธนาคาร',
    icon: null,
    logo: '/kasikornbank-logo.png',
    active: true,
  },
  {
    key: 'credit',
    title: 'บัตรเครดิต',
    subtitle: 'เร็วๆ นี้',
    icon: CreditCard,
    active: false,
  },
  {
    key: 'ewallet',
    title: 'E-Wallet',
    subtitle: 'เร็วๆ นี้',
    icon: Banknote,
    active: false,
  },
  {
    key: 'truewallet',
    title: 'True Wallet',
    subtitle: 'เร็วๆ นี้',
    icon: WalletCards,
    active: false,
  },
  {
    key: 'giftcard',
    title: 'Gift Card',
    subtitle: 'เร็วๆ นี้',
    icon: Gift,
    active: false,
  },
];

export function TopupPageClient() {
  const [openBank, setOpenBank] = useState(false);
  const [bankAmount, setBankAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [bankPayment, setBankPayment] = useState<PaymentItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [slipName, setSlipName] = useState('');
  const [slipFile, setSlipFile] = useState<File | null>(null);

  const canSubmitSlip = bankAmount.trim().length > 0 && Boolean(slipFile);

  function closeModal() {
    setOpenBank(false);
    setLoading(false);
    setBankAmount('');
    setBankPayment(null);
    setError(null);
    setCopied(false);
    setSlipName('');
    setSlipFile(null);
  }

  function openMethod(key: string) {
    if (key === 'bank') setOpenBank(true);
  }

  async function copyBankAccount() {
    await navigator.clipboard.writeText(bankAccount.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function selectSlip(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSlipFile(file);
    setSlipName(file?.name || '');
  }

  async function submitBankSlip() {
    if (!canSubmitSlip || !slipFile) return;
    setError(null);
    setLoading(true);
    try {
      const payment = await paymentService.uploadSlip({
        amountBaht: Number(bankAmount),
        slip: slipFile,
      });
      setBankPayment(payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งสลิปตรวจสอบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }


  return (
    <>
      <section className="mx-auto mt-8 w-full max-w-[1460px] px-4 sm:mt-10 sm:px-6 lg:mt-14">
        <h2 className="mb-5 text-center text-[17px] font-extrabold text-[#f7f1e7] sm:mb-7">เลือกวิธีเติมเงิน</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {paymentMethods.map((method) => {
            const Icon = method.icon;
            return (
              <button
                key={method.key}
                type="button"
                onClick={() => method.active && openMethod(method.key)}
                className={clsx(
                  'group flex h-[122px] flex-col items-center justify-center rounded-[14px] border text-center transition sm:h-[146px]',
                  method.active
                    ? method.key === 'bank'
                      ? 'border-[#1ba7ff]/85 bg-[linear-gradient(135deg,#071a31_0%,#06111e_52%,#062218_100%)] text-white shadow-[0_0_0_1px_rgba(27,167,255,.18),0_18px_58px_rgba(11,121,255,.24),inset_0_1px_0_rgba(255,255,255,.08)] ring-1 ring-[#1ba7ff]/28 hover:border-[#38bdf8] hover:shadow-[0_0_0_1px_rgba(56,189,248,.22),0_22px_70px_rgba(11,121,255,.34),inset_0_1px_0_rgba(255,255,255,.10)]'
                      : 'border-[#0647b8]/45 bg-gradient-to-r from-[#0b79ff] via-[#0647b8] to-[#0647b8] text-[#f7f1e7] shadow-[0_20px_70px_rgba(18,76,190,.24)] hover:brightness-110'
                    : 'cursor-not-allowed border-[#4b3615] bg-[#242320] text-[#7f786f] opacity-80'
                )}
              >
                {method.logo ? (
                  <img
                    src={method.logo}
                    alt=""
                    className="mb-3 h-10 w-10 object-contain drop-shadow-[0_0_16px_rgba(255,255,255,.20)] sm:mb-4 sm:h-11 sm:w-11"
                  />
                ) : Icon ? (
                  <Icon
                    size={34}
                    className={clsx('mb-3 sm:mb-4', method.active ? 'text-white drop-shadow-[0_0_14px_rgba(255,255,255,.55)]' : 'text-[#7f786f]')}
                    strokeWidth={2.5}
                  />
                ) : null}
                <div className={clsx('text-[16px] font-extrabold sm:text-[18px]', method.active ? 'text-white' : 'text-[#7f786f]')}>
                  {method.title}
                </div>
                <div className={clsx('mt-1.5 text-[13px] font-semibold sm:mt-2 sm:text-[14px]', method.active ? 'text-[#e8f7ff]' : 'text-[#7f786f]')}>
                  {method.subtitle}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex min-h-[50px] items-start gap-3 rounded-[12px] bg-[#d6a23b] px-4 py-3 text-[13px] font-bold leading-6 text-[#11100e] shadow-[0_18px_50px_rgba(227,170,58,.18)] sm:mt-9 sm:items-center sm:gap-4 sm:px-5 sm:text-[14px]">
          <Info size={20} />
          <span>โอนเงินแล้วแนบสลิป จากนั้นรอแอดมินตรวจสอบและเพิ่มเครดิตภายใน 24 ชม.</span>
        </div>
      </section>

      {openBank ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#0b0b0a]/62 px-4 py-6 backdrop-blur-[9px] sm:grid sm:place-items-center">
          <div className="relative mx-auto w-full max-w-[480px] rounded-[18px] bg-[#151411] px-5 pb-6 pt-7 text-[#f7f1e7] shadow-[0_30px_90px_rgba(0,0,0,.55)] ring-1 ring-[#5b4118] sm:px-8 sm:pb-8 sm:pt-9">
            <button type="button" onClick={closeModal} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#1d1a16] text-[#7f786f] transition hover:bg-[#2a241b] hover:text-[#e7ded2]"><X size={20} /></button>
            <img src="/kasikornbank-logo.png" alt="" className="mx-auto h-16 w-16 object-contain drop-shadow-[0_16px_34px_rgba(0,0,0,.35)] sm:h-[72px] sm:w-[72px]" />
            <div className="mt-7 text-center">
              <h3 className="text-[24px] font-extrabold tracking-tight text-[#f7f1e7]">โอนเงิน</h3>
              <p className="mt-3 text-[15px] font-medium text-[#9d968d]">โอนเงินเข้าบัญชีนี้ แล้วแนบสลิปเพื่อให้แอดมินตรวจสอบ</p>
            </div>
            <div className="mt-7 space-y-3 rounded-[14px] border border-[#5b4118] bg-[#1d1a16] p-5">
              <div className="flex items-center justify-between gap-4 border-b border-[#5b4118] pb-3"><span className="text-[13px] font-bold text-[#9d968d]">ช่องทาง</span><b className="text-[15px] text-[#f7f1e7]">{bankAccount.bank}</b></div>
              <div className="flex items-center justify-between gap-4 border-b border-[#5b4118] pb-3"><span className="text-[13px] font-bold text-[#9d968d]">เลขบัญชี</span><b className="text-[22px] text-[#e3aa3a]">{bankAccount.number}</b></div>
              <div className="flex items-center justify-between gap-4"><span className="text-[13px] font-bold text-[#9d968d]">ชื่อบัญชี</span><b className="text-[15px] text-[#f7f1e7]">{bankAccount.name}</b></div>
            </div>
            <button type="button" onClick={() => void copyBankAccount()} className="mt-6 inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#e3aa3a] text-[15px] font-extrabold text-[#160d04] shadow-[0_12px_26px_rgba(227,170,58,.22)] transition hover:bg-[#f0c15a]"><Copy size={17} /> {copied ? 'คัดลอกแล้ว' : 'คัดลอกเลขบัญชี'}</button>

            {bankPayment ? (
              <div className="mt-5 rounded-xl border border-[#2d8b55] bg-[#062b18] px-4 py-4 text-center text-[13px] font-black leading-6 text-[#a7f5c5] shadow-[0_0_26px_rgba(45,139,85,.18)]">
                ส่งสลิปตรวจสอบแล้ว<br />ยอด {Number(bankPayment.amountBaht).toLocaleString('th-TH')} บาท<br />แอดมินจะตรวจสอบและเพิ่มเครดิตให้ภายใน 24 ชม.
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1.08fr_1fr_.78fr] sm:gap-2">
                  <label className="min-w-0">
                    <span className="mb-2 block text-[12px] font-black text-[#f7f1e7]">จำนวนเงิน</span>
                    <div className="flex h-[50px] overflow-hidden rounded-xl border border-[#5b4118] bg-[#0d0d0c] focus-within:border-[#e3aa3a] focus-within:ring-2 focus-within:ring-[#e3aa3a]/15">
                      <input
                        value={bankAmount}
                        onChange={(event) => setBankAmount(event.target.value.replace(/[^0-9]/g, ''))}
                        inputMode="numeric"
                        placeholder="200"
                        className="min-w-0 flex-1 bg-transparent px-3 text-[18px] font-black text-[#f7f1e7] outline-none placeholder:text-[#6f685f]"
                      />
                      <span className="flex items-center pr-3 text-[12px] font-black text-[#e3aa3a]">บาท</span>
                    </div>
                  </label>

                  <label className="min-w-0 cursor-pointer">
                    <span className="mb-2 block text-[12px] font-black text-[#f7f1e7]">สลิป</span>
                    <div className="flex h-[50px] items-center justify-center rounded-xl border border-dashed border-[#0b79ff]/45 bg-[#071d3f]/60 px-3 text-center transition hover:border-[#e3aa3a]">
                      <input type="file" accept="image/*" onChange={selectSlip} className="sr-only" />
                      <span className="truncate text-[12px] font-black text-[#b9e6ff]">{slipName || 'แนบสลิป'}</span>
                    </div>
                  </label>

                  <label className="min-w-0">
                    <span className="mb-2 block text-[12px] font-black text-transparent">ส่ง</span>
                    <button
                      type="button"
                      onClick={() => void submitBankSlip()}
                      disabled={!canSubmitSlip || loading}
                      className="inline-flex h-[50px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#0647b8] to-[#0b79ff] px-2 text-[13px] font-extrabold text-white shadow-[0_12px_26px_rgba(11,121,255,.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {loading ? 'กำลังส่ง' : 'ส่งตรวจสอบ'}
                    </button>
                  </label>
                </div>

                {error ? <div className="mt-4 rounded-lg border border-[#a6262d] bg-[#2d0d10] px-4 py-3 text-[13px] font-semibold text-[#ffb6ba]">{error}</div> : null}
              </>
            )}

            <div className="mt-4 rounded-xl border border-[#ff4d5a]/55 bg-[#3a0b10] px-4 py-3 text-[12px] font-black leading-5 text-[#ffccd1] shadow-[0_0_22px_rgba(255,77,90,.14)]">
              หลังโอนเงิน กรุณากรอกจำนวนเงินและแนบสลิปไว้ในระบบ แอดมินจะตรวจสอบและเพิ่มเครดิตให้ภายใน 24 ชม.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}















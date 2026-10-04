import { AppShell } from '@/components/layout/AppShell';

function LineIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-16 w-16">
      <rect width="64" height="64" rx="18" fill="#06C755" />
      <path
        fill="#fff"
        d="M49.6 29.4c0-8-8-14.5-17.9-14.5S13.8 21.4 13.8 29.4c0 7.1 6.3 13.1 14.8 14.3.6.1 1.4.4 1.6.9.2.4.1 1.1.1 1.6l-.3 2c-.1.6-.5 2.3 1.6 1.3 2.1-1 11.2-6.6 15.3-11.3 1.8-2 2.7-4.9 2.7-8.8Z"
      />
      <path
        fill="#06C755"
        d="M24.1 26.2h-1.3a.4.4 0 0 0-.4.4v7.7c0 .2.2.4.4.4h1.3c.2 0 .4-.2.4-.4v-7.7a.4.4 0 0 0-.4-.4Zm8.5 0h-1.3a.4.4 0 0 0-.4.4v4.6l-3.5-4.8-.1-.1h-1.5a.4.4 0 0 0-.4.4v7.7c0 .2.2.4.4.4h1.3c.2 0 .4-.2.4-.4v-4.6l3.5 4.8.1.1h1.5c.2 0 .4-.2.4-.4v-7.7a.4.4 0 0 0-.4-.4Zm-11 6.5h-3.4v-6.1a.4.4 0 0 0-.4-.4h-1.3a.4.4 0 0 0-.4.4v7.7c0 .2.2.4.4.4h5.1c.2 0 .4-.2.4-.4v-1.2a.4.4 0 0 0-.4-.4Zm16.9-4.5c.2 0 .4-.2.4-.4v-1.2a.4.4 0 0 0-.4-.4h-5.1a.4.4 0 0 0-.4.4v7.7c0 .2.2.4.4.4h5.1c.2 0 .4-.2.4-.4v-1.2a.4.4 0 0 0-.4-.4h-3.4v-1.1h3.4c.2 0 .4-.2.4-.4V30a.4.4 0 0 0-.4-.4h-3.4v-1.4h3.4Z"
      />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <AppShell>
      <div className="page-pad min-h-screen py-9">
        <section className="min-h-[calc(100vh-132px)] overflow-hidden rounded-[18px] border border-[#2b7fc7]/35 bg-[radial-gradient(circle_at_50%_0%,rgba(6,199,85,.20),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(45,167,255,.16),transparent_30%),linear-gradient(145deg,rgba(6,19,35,.97),rgba(3,7,13,.99)_58%,rgba(5,16,31,.96))] p-7 shadow-[0_20px_56px_rgba(0,0,0,.36),inset_0_0_0_1px_rgba(74,163,232,.07)]">
          <div className="mb-8 flex items-center justify-between gap-4 border-b border-[#c7962d]/35 pb-5">
            <div>
              <h2 className="text-[20px] font-black text-white">ติดต่อเจ้าหน้าที่</h2>
              <p className="mt-1 text-[13px] font-semibold text-[#9fb1c9]">แอดไลน์ได้เลย</p>
            </div>
            <span className="rounded-full border border-[#06c755]/40 bg-[#06c755]/12 px-4 py-2 text-[12px] font-black text-[#7dffad]">LINE</span>
          </div>

          <div className="flex min-h-[560px] items-center justify-center">
            <article className="relative w-full max-w-[520px] overflow-hidden rounded-[28px] border border-[#06c755]/40 bg-[linear-gradient(145deg,rgba(3,21,14,.96),rgba(4,9,15,.98)_62%,rgba(8,31,18,.95))] p-8 text-center shadow-[0_28px_80px_rgba(0,0,0,.45),0_0_34px_rgba(6,199,85,.16),inset_0_1px_0_rgba(255,255,255,.08)]">
              <div className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,#7dffad,transparent)]" />
              <div className="mx-auto grid h-24 w-24 place-items-center rounded-[28px] bg-[#06c755]/14 ring-1 ring-[#06c755]/28 shadow-[0_0_42px_rgba(6,199,85,.24)]">
                <LineIcon />
              </div>
              <div className="mt-6 text-[34px] font-black leading-tight text-white">ติดต่อแอดมิน</div>
              <div className="mt-2 text-[18px] font-black text-[#7dffad]">แอดไลน์ได้เลย</div>
              <div className="mx-auto mt-7 w-full max-w-[292px] rounded-[24px] border border-[#06c755]/35 bg-white p-4 shadow-[0_18px_48px_rgba(0,0,0,.35)]">
                <img src="/line-contact.jpg" alt="LINE QR Code" className="h-auto w-full rounded-[16px]" />
              </div>
              <div className="mx-auto mt-6 h-12 w-full max-w-[292px] rounded-full bg-[#06c755] px-6 text-center text-[15px] font-black leading-[48px] text-white shadow-[0_14px_32px_rgba(6,199,85,.28)]">
                LINE SUPPORT
              </div>
            </article>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

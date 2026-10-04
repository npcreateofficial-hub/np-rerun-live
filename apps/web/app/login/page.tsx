'use client';

import { FormEvent, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/hooks/useAuth';
import { getClientDevice } from '@/lib/device';

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const [licenseKey, setLicenseKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const device = getClientDevice();
    await login({
      licenseKey: licenseKey.trim(),
      username: username.trim(),
      password,
      ...device,
    });
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080808] p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(18,140,255,.20),transparent_30%),radial-gradient(circle_at_82%_80%,rgba(227,170,58,.10),transparent_34%)]" />
      <div className="pointer-events-none absolute left-[-110px] top-[-120px] h-[360px] w-[360px] rounded-full border border-[#6c4e1c]/30" />
      <div className="pointer-events-none absolute bottom-[-170px] right-[-100px] h-[420px] w-[420px] rounded-full border border-[#8f1016]/30" />

      <section className="relative w-full max-w-[460px] overflow-hidden rounded-[20px] border border-[#5b4118] bg-[#10100f]/95 p-8 shadow-[0_28px_90px_rgba(0,0,0,.55)] backdrop-blur">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#063c9a] via-[#e3aa3a] to-[#063c9a]" />

        <div className="flex items-center gap-4">
          <img src="/np-live-logo.png" alt="NP LIVE" className="h-14 w-14 rounded-2xl border border-[#1ba7ff] object-cover shadow-[0_12px_30px_rgba(18,76,190,.28)]" />
          <div>
            <h1 className="text-[32px] font-black leading-none tracking-tight text-white">NP LIVE</h1>
            <p className="mt-2 text-[11px] font-bold tracking-[0.18em] text-[#d8a334]">SOCIAL LIVE STREAMING TOOLS</p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-[24px] font-black text-[#f7f1e7]">Login</h2>
          <p className="mt-2 text-[14px] font-medium text-[#9d968d]">Sign in with your license, user, and password.</p>
        </div>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <div>
            <label className="mb-2 block text-[13px] font-bold text-[#c9c2b6]">License</label>
            <Input
              placeholder="NP-SP-XXXXYYYY-ZZZZ"
              type="text"
              value={licenseKey}
              onChange={(event) => setLicenseKey(event.target.value)}
              autoComplete="off"
              required
              className="h-12 rounded-xl border-[#5b4118] bg-[#0b0b0a] uppercase focus:border-[#e3aa3a]"
            />
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-bold text-[#c9c2b6]">User</label>
            <Input
              placeholder="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              className="h-12 rounded-xl border-[#5b4118] bg-[#0b0b0a] focus:border-[#e3aa3a]"
            />
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-bold text-[#c9c2b6]">Password</label>
            <Input
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="h-12 rounded-xl border-[#5b4118] bg-[#0b0b0a] focus:border-[#e3aa3a]"
            />
          </div>

          {error ? <div className="rounded-xl border border-[#0b79ff]/40 bg-[#071d3f] px-4 py-3 text-sm font-semibold text-[#ffd0d0]">{error}</div> : null}

          <Button type="submit" className="mt-2 h-12 w-full rounded-xl text-[15px]" disabled={loading || !licenseKey.trim() || !username.trim() || !password}>
            <LockKeyhole size={17} /> {loading ? 'Signing in...' : 'Login'}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 border-t border-[#4b3615] pt-5 text-[12px] font-semibold text-[#8f877c]">
          <ShieldCheck size={15} className="text-[#e3aa3a]" /> Secure account access
        </div>
      </section>
    </main>
  );
}


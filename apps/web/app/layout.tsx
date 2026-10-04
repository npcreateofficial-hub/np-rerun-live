import type { Metadata } from 'next';
import { BrowserErrorGuard } from '@/components/common/BrowserErrorGuard';
import '@/styles/globals.css';

export const metadata: Metadata = { title: 'NP LIVE', description: 'Social Live Streaming Tools' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body><BrowserErrorGuard />{children}</body></html>;
}

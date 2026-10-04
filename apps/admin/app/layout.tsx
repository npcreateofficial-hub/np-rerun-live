import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = { title: 'NP LIVE Admin', description: 'Admin control panel' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}

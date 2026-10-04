import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#03070d] text-[#f7f1e7]">
      <Sidebar />
      <main className="min-h-screen min-w-0 overflow-x-hidden pl-[248px]">
        {children}
      </main>
    </div>
  );
}

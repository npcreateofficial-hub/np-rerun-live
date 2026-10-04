import { ReactNode } from 'react';
export function Dialog({ title, children }: { title: string; children: ReactNode }) {
  return <div className="glass-card p-6"><h3 className="mb-4 text-lg font-bold">{title}</h3>{children}</div>;
}

import { ReactNode } from 'react';
export function DataTable({ children }: { children: ReactNode }) { return <div className="overflow-hidden rounded-2xl border border-line bg-[#0d0d0c]/50"><table className="w-full text-left text-sm">{children}</table></div>; }

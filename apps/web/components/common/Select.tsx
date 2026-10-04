import { SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx('rounded-xl border border-line bg-[#0d0d0c] px-4 py-3 text-sm text-[#f7f1e7] outline-none focus:border-[#e3aa3a]', className)} {...props}>{children}</select>;
}

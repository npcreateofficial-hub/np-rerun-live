import { InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('w-full rounded-xl border border-line bg-[#0d0d0c] px-4 py-3 text-sm text-[#f7f1e7] outline-none placeholder:text-[#7f786f] focus:border-[#e3aa3a]', className)} {...props} />;
}

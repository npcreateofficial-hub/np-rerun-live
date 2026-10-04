import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'gold' | 'ghost' };

export function AdminButton({ className, variant = 'primary', ...props }: Props) {
  return (
    <button
      className={clsx(
        'inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-4 text-[13px] font-black shadow-[0_10px_22px_rgba(0,0,0,.24)] disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'border border-[#1ba7ff] bg-gradient-to-r from-[#0647b8] to-[#0b79ff] text-white hover:border-[#8fd3ff] hover:brightness-110',
        variant === 'gold' && 'border border-[#f0b728] bg-gradient-to-r from-[#ffd766] to-[#f0a913] text-[#100b02] hover:brightness-110',
        variant === 'ghost' && 'border border-[#274262] bg-[#071320] text-[#f7f1e7] hover:border-[#0b79ff] hover:bg-[#071a31]',
        className,
      )}
      {...props}
    />
  );
}

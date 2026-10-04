import { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'pink' | 'ghost' | 'dark' };

export function Button({ className, variant = 'primary', ...props }: Props) {
  return (
    <button
      className={clsx(
        'group/btn relative inline-flex h-10 items-center justify-center gap-2 overflow-hidden rounded-lg px-4 text-[13px] font-bold transition-all duration-300 ease-out will-change-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100',
        'before:pointer-events-none before:absolute before:inset-0 before:translate-x-[-115%] before:bg-gradient-to-r before:from-transparent before:via-white/16 before:to-transparent before:transition-transform before:duration-700 before:ease-out hover:before:translate-x-[115%]',
        variant === 'primary' && 'border border-[#1ba7ff] bg-gradient-to-b from-[#0b79ff] to-[#063c9a] text-[#f7f1e7] shadow-[0_10px_24px_rgba(18,76,190,.25)] hover:brightness-110 hover:shadow-[0_14px_30px_rgba(18,76,190,.32)]',
        variant === 'pink' && 'border border-[#d4a53b] bg-gradient-to-b from-[#e9b84c] to-[#b47b1f] text-[#160d04] shadow-[0_10px_24px_rgba(188,126,30,.18)] hover:brightness-110 hover:shadow-[0_14px_30px_rgba(188,126,30,.28)]',
        variant === 'ghost' && 'border border-transparent bg-transparent text-[#e3aa3a] hover:border-[#5c4218] hover:bg-[#17130d] hover:shadow-[0_10px_22px_rgba(0,0,0,.22)]',
        variant === 'dark' && 'border border-[#4e3a19] bg-[#151411] text-[#e8e1d6] hover:border-[#7c5a21] hover:bg-[#201b12] hover:shadow-[0_10px_22px_rgba(0,0,0,.24)]',
        className,
      )}
      {...props}
    />
  );
}

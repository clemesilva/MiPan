import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  disabled,
  ...rest
}: Props) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-3 text-base font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none min-h-12 active:scale-[0.98]'

  const styles = {
    primary:
      'bg-accent text-white shadow-md shadow-amber-900/15 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
    secondary:
      'border border-[var(--color-border)] bg-white text-ink shadow-sm hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2',
    ghost: 'bg-transparent text-accent hover:bg-accent-soft',
  }

  return (
    <button
      type="button"
      className={`${base} ${styles[variant]} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
}

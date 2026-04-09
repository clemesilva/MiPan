import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export function Input({ label, id, className = '', ...rest }: Props) {
  const lid = id ?? label.replace(/\s+/g, '-').toLowerCase()
  return (
    <label className={`block text-left ${className}`} htmlFor={lid}>
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      <input
        id={lid}
        className="w-full min-h-12 rounded-xl border border-[var(--color-border)] bg-white px-3.5 text-ink shadow-sm outline-none transition-shadow placeholder:text-stone-400 focus:border-accent focus:ring-2 focus:ring-accent/25"
        {...rest}
      />
    </label>
  )
}

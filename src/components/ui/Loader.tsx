type Props = { label?: string; className?: string }

export function Loader({ label, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <span
        className="h-9 w-9 animate-spin rounded-full border-2 border-stone-200 border-t-accent"
        aria-hidden
      />
      {label && <p className="text-sm text-muted">{label}</p>}
    </div>
  )
}

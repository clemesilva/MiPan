import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

function navClass(active: boolean) {
  return [
    'shrink-0 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
    active
      ? 'bg-accent-soft text-accent shadow-sm ring-1 ring-amber-200/60'
      : 'text-muted hover:bg-stone-100 hover:text-ink',
  ].join(' ')
}

function userInitials(profile: {
  given_name?: string | null
  family_name?: string | null
  full_name?: string | null
  email?: string | null
}) {
  const g = profile.given_name?.trim()?.[0]
  const f = profile.family_name?.trim()?.[0]
  if (g && f) return (g + f).toUpperCase()
  const full = profile.full_name?.trim()
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return full.slice(0, 2).toUpperCase()
  }
  return profile.email?.[0]?.toUpperCase() ?? '?'
}

function displayName(profile: {
  given_name?: string | null
  family_name?: string | null
  full_name?: string | null
  email?: string | null
}) {
  const g = profile.given_name?.trim()
  const f = profile.family_name?.trim()
  if (g || f) return [g, f].filter(Boolean).join(' ')
  if (profile.full_name?.trim()) return profile.full_name.trim()
  return profile.email ?? 'Tu cuenta'
}

export function AppNavbar() {
  const { profile, signOut } = useAuth()

  if (!profile) return null

  const showPedido = profile.role === 'customer' || profile.role === 'bakery_admin'
  const showBakery = profile.role === 'bakery_admin'

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-card)_88%,transparent)] backdrop-blur-lg shadow-[0_1px_0_rgba(28,25,23,0.04)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
        <Link
          to="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-xl outline-none ring-accent focus-visible:ring-2"
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 text-lg shadow-md shadow-amber-900/25 transition-transform group-hover:scale-[1.02]"
            aria-hidden
          >
            🥖
          </span>
          <div className="hidden leading-tight sm:block">
            <span className="font-display text-lg font-semibold tracking-tight text-ink">MiPan</span>
            <span className="block text-[11px] font-medium text-muted">Pan en casa</span>
          </div>
        </Link>

        <nav className="min-w-0 flex-1">
          <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:gap-1.5 sm:pl-4">
          {showPedido && (
            <>
              <NavLink to="/app/pedido" className={({ isActive }) => navClass(isActive)}>
                Pedido
              </NavLink>
              <NavLink to="/app/pedidos" className={({ isActive }) => navClass(isActive)}>
                Mis pedidos
              </NavLink>
              <NavLink to="/app/perfil" className={({ isActive }) => navClass(isActive)}>
                Mi perfil
              </NavLink>
            </>
          )}
          {showBakery && (
            <NavLink to="/bakery" className={({ isActive }) => navClass(isActive)}>
              Panadería
            </NavLink>
          )}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden min-w-0 text-right md:block">
            <p className="truncate text-sm font-medium text-ink">{displayName(profile)}</p>
            <p className="truncate text-xs text-muted capitalize">
              {profile.role === 'bakery_admin' ? 'Administración' : 'Cliente'}
            </p>
          </div>
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
            />
          ) : (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-ink ring-2 ring-white"
              aria-hidden
            >
              {userInitials(profile)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-stone-50 sm:text-sm"
          >
            <span className="hidden sm:inline">Salir</span>
            <span className="sm:hidden" aria-label="Salir" title="Salir">
              ⎋
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}

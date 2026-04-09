import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import type { UserRole } from './types/database'
import { Button } from './components/ui/Button'
import { Loader } from './components/ui/Loader'
import { AuthCallbackPage } from './features/auth/AuthCallbackPage'
import { LoginPage } from './features/auth/LoginPage'
import { CustomerWeeklyOrderPage } from './features/customer/CustomerWeeklyOrderPage'
import { CustomerOrdersHistoryPage } from './features/customer/CustomerOrdersHistoryPage'
import { CustomerProfilePage } from './features/customer/CustomerProfilePage'
import { BakeryDashboardPage } from './features/bakery/BakeryDashboardPage'

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-surface/90 px-6 font-sans backdrop-blur-sm">
      <Loader />
      <p className="max-w-xs text-center text-sm font-medium text-muted">{children}</p>
    </div>
  )
}

function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <FullScreenMessage>Cargando sesión…</FullScreenMessage>
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

function ProfileBlocked({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface px-4 py-10 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-card p-8 text-center shadow-xl shadow-stone-900/5">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
          ⚠️
        </div>
        <h1 className="font-display text-xl font-semibold text-ink">Perfil no disponible</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{message}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" className="w-full sm:w-auto sm:min-w-[9rem]" onClick={() => void onRetry()}>
            Reintentar
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto sm:min-w-[9rem]"
            onClick={() => void signOut()}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  )
}

function RequireRole({ role }: { role: UserRole }) {
  const { session, profile, loading, profileLoading, profileError, refreshProfile } = useAuth()
  const location = useLocation()

  if (loading) {
    return <FullScreenMessage>Cargando sesión…</FullScreenMessage>
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (profileLoading) {
    return <FullScreenMessage>Cargando perfil…</FullScreenMessage>
  }
  if (!profile) {
    return (
      <ProfileBlocked message={profileError ?? 'No se pudo cargar el perfil.'} onRetry={refreshProfile} />
    )
  }
  if (profile.role !== role) {
    if (profile.role === 'bakery_admin') {
      return <Navigate to="/bakery" replace />
    }
    return <Navigate to="/app/pedido" replace />
  }
  return <Outlet />
}

/** Área cliente: `customer` y también `bakery_admin` (pueden pedir como cualquier usuario). */
function RequireCustomerApp() {
  const { session, profile, loading, profileLoading, profileError, refreshProfile } = useAuth()
  const location = useLocation()

  if (loading) {
    return <FullScreenMessage>Cargando sesión…</FullScreenMessage>
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (profileLoading) {
    return <FullScreenMessage>Cargando perfil…</FullScreenMessage>
  }
  if (!profile) {
    return (
      <ProfileBlocked message={profileError ?? 'No se pudo cargar el perfil.'} onRetry={refreshProfile} />
    )
  }
  if (profile.role !== 'customer' && profile.role !== 'bakery_admin') {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

function HomeRedirect() {
  const { session, profile, loading, profileLoading, profileError, refreshProfile } = useAuth()

  if (loading) {
    return <FullScreenMessage>Cargando…</FullScreenMessage>
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  if (profileLoading) {
    return <FullScreenMessage>Cargando perfil…</FullScreenMessage>
  }
  if (!profile) {
    return (
      <ProfileBlocked message={profileError ?? 'No se pudo cargar el perfil.'} onRetry={refreshProfile} />
    )
  }
  if (profile.role === 'bakery_admin') {
    return <Navigate to="/bakery" replace />
  }
  const hasName =
    Boolean(profile.given_name?.trim()) ||
    Boolean(profile.family_name?.trim()) ||
    Boolean(profile.full_name?.trim())
  const hasDeliveryBasics = Boolean(profile.phone?.trim()) && Boolean(profile.address?.trim())
  if (profile.role === 'customer' && (!hasName || !hasDeliveryBasics)) {
    return <Navigate to="/app/perfil" replace />
  }
  return <Navigate to="/app/pedido" replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomeRedirect />} />

        <Route element={<RequireCustomerApp />}>
          <Route path="/app/pedido" element={<CustomerWeeklyOrderPage />} />
          <Route path="/app/pedidos" element={<CustomerOrdersHistoryPage />} />
          <Route path="/app/perfil" element={<CustomerProfilePage />} />
        </Route>

        <Route element={<RequireRole role="bakery_admin" />}>
          <Route path="/bakery" element={<BakeryDashboardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session, profile, loading, profileLoading } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const err = searchParams.get('error')
    if (err) {
      setMessage(decodeURIComponent(err))
    }
  }, [searchParams])

  useEffect(() => {
    if (!loading && !profileLoading && session && profile) {
      navigate('/', { replace: true })
    }
  }, [loading, profileLoading, session, profile, navigate])

  async function signInWithGoogle() {
    setMessage(null)
    setBusy(true)
    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) throw error
      if (!data?.url) {
        throw new Error('No se recibió la URL de Google. Revisa la configuración del proveedor.')
      }
      window.location.assign(data.url)
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'No se pudo usar Google')
      setBusy(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage(
          'Cuenta creada. Revisa tu correo si hay confirmación; luego inicia sesión.',
        )
        setMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/', { replace: true })
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error de autenticación')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-svh font-sans md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,24rem)]">
      <aside className="relative hidden flex-col justify-end overflow-hidden bg-gradient-to-br from-amber-900 via-amber-800 to-stone-900 p-10 text-white md:flex lg:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />
        <div className="relative z-[1] max-w-md">
          <p className="font-display text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
            Pan fresco,
            <br />
            pedido claro.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-amber-100/90">
            Arma tu semana en un minuto. La panadería ve qué hornear y a dónde llevarlo.
          </p>
        </div>
      </aside>

      <div className="flex flex-col justify-center px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 text-center md:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-2xl bg-accent-soft px-3 py-1.5 md:hidden">
              <span className="text-lg" aria-hidden>
                🥖
              </span>
              <span className="font-display text-lg font-semibold text-ink">MiPan</span>
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Entrar</h1>
            <p className="mt-2 text-sm text-muted">Pan semanal a domicilio</p>
          </div>

          <div className="rounded-3xl border border-[var(--color-border)] bg-card p-6 shadow-xl shadow-stone-900/[0.06] sm:p-8">
            <Button
              type="button"
              variant="secondary"
              className="!flex w-full items-center justify-center gap-3 !shadow-sm"
              disabled={busy}
              onClick={signInWithGoogle}
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar con Google
            </Button>
            <p className="mt-2 text-center text-[11px] leading-snug text-muted">
              Activa Google en Supabase (Authentication → Providers) y la URI de callback en Google
              Cloud.
            </p>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-[var(--color-border)]" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted">o correo</span>
              <span className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            <div className="mb-5 flex rounded-xl border border-[var(--color-border)] bg-stone-100/80 p-1">
              <button
                type="button"
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                  mode === 'login'
                    ? 'bg-white text-ink shadow-sm ring-1 ring-stone-200/80'
                    : 'text-muted hover:text-ink'
                }`}
                onClick={() => setMode('login')}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                  mode === 'signup'
                    ? 'bg-white text-ink shadow-sm ring-1 ring-stone-200/80'
                    : 'text-muted hover:text-ink'
                }`}
                onClick={() => setMode('signup')}
              >
                Registrarse
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Correo"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Contraseña"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />

              {message && (
                <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                  {message}
                </p>
              )}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

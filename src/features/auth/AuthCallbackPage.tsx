import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader } from '../../components/ui/Loader'
import { supabase } from '../../lib/supabaseClient'

/**
 * Tras Google, Supabase abre esta URL con ?code=... (PKCE).
 * El propio cliente ya intercambia el código al arrancar (detectSessionInUrl + _initialize).
 * No llamar otra vez a exchangeCodeForSession: borra el code_verifier y falla el segundo intento.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [msg] = useState('Conectando con tu cuenta…')

  useEffect(() => {
    let cancelled = false

    const search = new URLSearchParams(window.location.search)
    const oauthError = search.get('error')
    const oauthDesc = search.get('error_description')
    if (oauthError) {
      const text = oauthDesc
        ? `${oauthError}: ${oauthDesc.replace(/\+/g, ' ')}`
        : oauthError
      navigate(`/login?error=${encodeURIComponent(text)}`, { replace: true })
      return
    }

    async function run() {
      const { data, error } = await supabase.auth.getSession()
      if (cancelled) return
      if (error) {
        navigate(`/login?error=${encodeURIComponent(error.message)}`, { replace: true })
        return
      }
      if (data.session) {
        navigate('/', { replace: true })
        return
      }
      navigate(
        '/login?error=' +
          encodeURIComponent(
            'No se pudo completar el inicio de sesión. Cierra esta pestaña e intenta de nuevo con «Continuar con Google».',
          ),
        { replace: true },
      )
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-surface px-6 font-sans">
      <div className="rounded-3xl border border-[var(--color-border)] bg-card px-10 py-12 shadow-xl shadow-stone-900/[0.06]">
        <Loader label={msg} />
      </div>
    </div>
  )
}

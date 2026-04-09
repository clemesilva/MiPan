import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { ensureMyProfileRow, fetchMyProfile } from '../services/profiles'
import type { Profile } from '../types/database'

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** true hasta saber si hay sesión o no */
  loading: boolean
  /** true mientras se pide el perfil a Supabase */
  profileLoading: boolean
  /** hubo error al leer perfil (RLS, red, etc.) */
  profileError: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function loadProfileForUser(userId: string): Promise<Profile | null> {
  const first = await fetchMyProfile()
  if (first) return first
  await ensureMyProfileRow(userId)
  return fetchMyProfile()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const refreshProfile = useCallback(async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id
    if (!uid) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    setProfileError(null)
    try {
      const p = await loadProfileForUser(uid)
      setProfile(p)
      if (!p) setProfileError('No hay fila en profiles para tu usuario.')
    } catch (e: unknown) {
      setProfile(null)
      setProfileError(e instanceof Error ? e.message : 'Error al cargar el perfil')
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function runSession(s: Session | null) {
      setSession(s)
      setUser(s?.user ?? null)
      if (!s?.user) {
        setProfile(null)
        setProfileError(null)
        setProfileLoading(false)
        setLoading(false)
        return
      }
      setProfileLoading(true)
      setProfileError(null)
      try {
        const p = await loadProfileForUser(s.user.id)
        if (!cancelled) {
          setProfile(p)
          if (!p) setProfileError('No hay fila en profiles para tu usuario.')
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setProfile(null)
          setProfileError(e instanceof Error ? e.message : 'Error al cargar el perfil')
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false)
          setLoading(false)
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      void runSession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return
      void runSession(nextSession)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setProfileError(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      profileLoading,
      profileError,
      refreshProfile,
      signOut,
    }),
    [session, user, profile, loading, profileLoading, profileError, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

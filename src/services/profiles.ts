import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../types/database'

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  if (!uid) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle()

  if (error) throw error
  return data as Profile | null
}

/**
 * Crea la fila en `profiles` si no existe (p. ej. borraste perfiles y el usuario sigue en auth).
 * 1) RPC `ensure_my_profile` en Supabase (recomendado; ver supabase/sql/ensure_my_profile.sql).
 * 2) Si la RPC no existe o falla, intenta INSERT directo (requiere política RLS de INSERT).
 */
export async function ensureMyProfileRow(userId: string): Promise<void> {
  const { error: rpcError } = await supabase.rpc('ensure_my_profile')
  if (!rpcError) return

  const { error: insertError } = await supabase.from('profiles').insert({
    id: userId,
    role: 'customer',
  })
  if (!insertError) return

  const msg = insertError.message?.toLowerCase() ?? ''
  if (msg.includes('duplicate') || msg.includes('unique')) return

  throw new Error(
    [rpcError.message, insertError.message].filter(Boolean).join(' · '),
  )
}

export async function updateMyProfile(updates: {
  given_name?: string | null
  family_name?: string | null
  full_name?: string | null
  phone?: string | null
  address?: string | null
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  if (!uid) throw new Error('No hay sesión')

  const { error } = await supabase.from('profiles').update(updates).eq('id', uid)
  if (error) throw error
}

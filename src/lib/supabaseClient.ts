import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

const missingEnv =
  !url ||
  !anonKey ||
  url.includes('tu-proyecto') ||
  anonKey === 'tu_anon_key'

if (missingEnv) {
  throw new Error(
    'Configura Supabase en un archivo .env en la raíz del proyecto con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (Dashboard → Settings → API). Luego detén y vuelve a ejecutar npm run dev.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
  },
})

import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { updateMyProfile } from '../services/profiles'
import { AppNavbar } from '../components/layout/AppNavbar'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function CustomerProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const g = profile?.given_name?.trim() ?? ''
    const f = profile?.family_name?.trim() ?? ''
    if (g || f) {
      setGivenName(g)
      setFamilyName(f)
    } else if (profile?.full_name?.trim()) {
      const parts = profile.full_name.trim().split(/\s+/)
      setGivenName(parts[0] ?? '')
      setFamilyName(parts.slice(1).join(' '))
    } else {
      setGivenName('')
      setFamilyName('')
    }
    setPhone(profile?.phone ?? '')
    setAddress(profile?.address ?? '')
  }, [
    profile?.given_name,
    profile?.family_name,
    profile?.full_name,
    profile?.phone,
    profile?.address,
  ])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setNotice(null)
    setError(null)
    setSaving(true)
    try {
      const g = givenName.trim()
      const f = familyName.trim()
      const combined = [g, f].filter(Boolean).join(' ') || null
      await updateMyProfile({
        given_name: g || null,
        family_name: f || null,
        full_name: combined,
        phone: phone || null,
        address: address || null,
      })
      await refreshProfile()
      setNotice('Perfil actualizado.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar los datos')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-svh pb-12 font-sans text-ink">
      <AppNavbar />

      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Mi perfil</h1>
        <p className="mt-2 text-sm text-muted">
          Nombre y datos de contacto que verá la panadería para el reparto.
        </p>

        {error && (
          <p className="mt-6 rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-900 shadow-sm">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900 shadow-sm">
            {notice}
          </p>
        )}

        <form
          onSubmit={handleSave}
          className="mt-8 space-y-6 rounded-2xl border border-[var(--color-border)] bg-card p-5 shadow-md shadow-stone-900/[0.04] sm:p-6"
        >
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Cuenta</h2>
            <p className="mt-3 text-sm text-muted">
              <span className="font-medium text-ink">Correo</span>
              <span className="mt-1 block rounded-xl border border-[var(--color-border)] bg-stone-50 px-3.5 py-3 text-ink">
                {profile?.email ?? '—'}
              </span>
              <span className="mt-1 block text-xs">El correo viene de tu cuenta de acceso y no se puede cambiar aquí.</span>
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Datos personales y reparto</h2>
            <div className="mt-4 flex flex-col gap-4">
              <Input
                label="Nombre"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                autoComplete="given-name"
              />
              <Input
                label="Apellido"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                autoComplete="family-name"
              />
              <Input
                label="Teléfono"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
              <Input
                label="Dirección de reparto"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="street-address"
              />
            </div>
          </div>

          <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </form>
      </main>
    </div>
  )
}

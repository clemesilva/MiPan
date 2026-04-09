/**
 * Fecha YYYY-MM-DD del lunes de la semana que contiene `reference`.
 * Usa el calendario local del navegador (usualmente correcto para clientes en Chile).
 */
export function mondayWeekStart(reference: Date = new Date()): string {
  const d = new Date(reference)
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + mondayOffset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dayNum = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dayNum}`
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Normaliza una fecha YYYY-MM-DD al lunes de esa semana (calendario local). */
export function mondayFromAnyYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const local = new Date(y, m - 1, d, 12, 0, 0)
  return mondayWeekStart(local)
}

/** Etiqueta legible: lun 7 abr – sáb 12 abr 2025 (calendario local). */
export function formatWeekRangeEs(mondayYmd: string): string {
  const [y, m, d] = mondayYmd.split('-').map(Number)
  const start = new Date(y, m - 1, d, 12, 0, 0)
  const end = new Date(y, m - 1, d + 5, 12, 0, 0)
  const fmt = new Intl.DateTimeFormat('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return `${fmt.format(start)} – ${fmt.format(end)} ${y}`
}

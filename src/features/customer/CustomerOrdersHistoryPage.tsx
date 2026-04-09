import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { fetchWeeklyOrdersSummaryForUser, type OrderSummaryRow } from '../../services/orders'
import { formatWeekRangeEs } from '../../lib/week'
import { AppNavbar } from '../../components/layout/AppNavbar'
import { Loader } from '../../components/ui/Loader'

export function CustomerOrdersHistoryPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<OrderSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchWeeklyOrdersSummaryForUser(user.id, { limit: 80 })
      setOrders(rows)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los pedidos')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-svh pb-12 font-sans text-ink">
      <AppNavbar />

      <main className="mx-auto max-w-xl px-4 py-6 sm:max-w-2xl sm:px-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Mis pedidos</h1>
        <p className="mt-2 text-sm text-muted">
          Semanas en las que ya tienes un pedido (pendiente o confirmado). Abre una para ver o editar
          según el estado.
        </p>

        {error && (
          <p className="mt-6 rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-900 shadow-sm">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader label="Cargando historial…" />
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 px-6 py-12 text-center">
            <p className="text-sm text-muted">
              Aún no hay pedidos guardados. Ve a{' '}
              <Link to="/app/pedido" className="font-semibold text-accent underline-offset-2 hover:underline">
                Pedido semanal
              </Link>{' '}
              para armar tu primera semana.
            </p>
          </div>
        ) : (
          <ul className="mt-8 flex flex-col gap-3">
            {orders.map((o) => (
              <li key={o.order_id}>
                <Link
                  to={`/app/pedido?semana=${encodeURIComponent(o.week_start)}`}
                  className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-card p-4 shadow-sm transition hover:border-amber-200/90 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-ink">{formatWeekRangeEs(o.week_start)}</p>
                    <p className="text-xs text-muted">Lunes {o.week_start}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      {o.total_per_day > 0 ? (
                        <>
                          <span className="rounded-full bg-stone-100 px-2 py-1 ring-1 ring-stone-200">
                            Total/día: <span className="font-semibold text-ink">{o.total_per_day}</span>
                          </span>
                          <span className="rounded-full bg-stone-100 px-2 py-1 ring-1 ring-stone-200">
                            Semana: <span className="font-semibold text-ink">{o.total_per_day * 6}</span>
                          </span>
                          {o.top_products.map((p) => (
                            <span
                              key={p.name}
                              className="rounded-full bg-amber-50 px-2 py-1 text-amber-950 ring-1 ring-amber-200/70"
                            >
                              {p.name}: <span className="font-semibold">{p.qty_per_day}</span>/día
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="rounded-full bg-stone-100 px-2 py-1 ring-1 ring-stone-200">
                          Sin unidades aún
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                        o.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80'
                          : 'bg-amber-100 text-amber-900 ring-1 ring-amber-200/80'
                      }`}
                    >
                      {o.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                    </span>
                    <span className="text-sm font-semibold text-accent">Ver →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

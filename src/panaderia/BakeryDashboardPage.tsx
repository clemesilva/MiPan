import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDaysYmd,
  formatWeekRangeEs,
  mondayFromAnyYmd,
  mondayWeekStart,
} from '../lib/week';

/** Diferencia en semanas: positivo = `selected` está después de `referenceMonday`. */
function weeksOffsetFromMonday(
  selectedMondayYmd: string,
  referenceMondayYmd: string,
): number {
  const [y1, m1, d1] = selectedMondayYmd.split('-').map(Number);
  const [y2, m2, d2] = referenceMondayYmd.split('-').map(Number);
  const t1 = new Date(y1, m1 - 1, d1, 12, 0, 0).getTime();
  const t2 = new Date(y2, m2 - 1, d2, 12, 0, 0).getTime();
  return Math.round((t1 - t2) / (7 * 24 * 60 * 60 * 1000));
}

function relativeWeekBadgeText(
  weekStartMonday: string,
  calendarMonday: string,
): { text: string; tone: 'current' | 'past' | 'future' } {
  if (weekStartMonday === calendarMonday) {
    return { text: 'Semana actual', tone: 'current' };
  }
  const offset = weeksOffsetFromMonday(weekStartMonday, calendarMonday);
  if (offset < 0) {
    const n = -offset;
    return {
      text: n === 1 ? '1 semana atrás' : `${n} semanas atrás`,
      tone: 'past',
    };
  }
  return {
    text: offset === 1 ? '1 semana adelante' : `${offset} semanas adelante`,
    tone: 'future',
  };
}
import { fetchBakeryProduction, type BakeryRow } from '../services/orders';
import { useAuth } from '../contexts/AuthContext';
import { AppNavbar } from '../components/layout/AppNavbar';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';

function displayNombreApellido(c: {
  full_name: string | null;
  given_name: string | null;
  family_name: string | null;
}) {
  const parts = (c.full_name?.trim() ?? '').split(/\s+/).filter(Boolean);
  const nombre =
    c.given_name ?? (parts[0] !== undefined ? parts[0] : null) ?? '—';
  const apellido =
    c.family_name ??
    (parts.length > 1 ? parts.slice(1).join(' ') : null) ??
    '—';
  return { nombre, apellido };
}

function aggregateByProduct(rows: BakeryRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.product_name, (map.get(r.product_name) ?? 0) + r.quantity);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function groupByCustomer(rows: BakeryRow[]) {
  const map = new Map<
    string,
    {
      user_id: string;
      full_name: string | null;
      given_name: string | null;
      family_name: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      lines: { product_name: string; quantity: number }[];
    }
  >();
  for (const r of rows) {
    const key = r.user_id;
    if (!map.has(key)) {
      map.set(key, {
        user_id: r.user_id,
        full_name: r.full_name,
        given_name: r.given_name,
        family_name: r.family_name,
        email: r.email,
        phone: r.phone,
        address: r.address,
        lines: [],
      });
    }
    map
      .get(key)!
      .lines.push({ product_name: r.product_name, quantity: r.quantity });
  }
  return [...map.values()].sort((a, b) =>
    (a.full_name ?? a.user_id).localeCompare(b.full_name ?? b.user_id),
  );
}

export function BakeryDashboardPage() {
  const { profile } = useAuth();
  /** Siempre lunes en formato YYYY-MM-DD (por defecto: semana calendario actual). */
  const [weekStart, setWeekStart] = useState(() => mondayWeekStart());
  const [rows, setRows] = useState<BakeryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyMissingDelivery, setOnlyMissingDelivery] = useState(false);

  const bakeryId = profile?.bakery_id ?? null;
  const canLoad = bakeryId != null;

  const load = useCallback(async () => {
    if (bakeryId == null) {
      setRows([]);
      setLoading(false);
      setError('Tu usuario no tiene bakery_id asignado (profiles.bakery_id).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBakeryProduction(weekStart, bakeryId);
      setRows(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [weekStart, bakeryId]);

  useEffect(() => {
    load();
  }, [load]);

  const customersAll = useMemo(() => groupByCustomer(rows), [rows]);
  const customers = useMemo(() => {
    if (!onlyMissingDelivery) return customersAll;
    return customersAll.filter(
      (c) => !(c.phone ?? '').trim() || !(c.address ?? '').trim(),
    );
  }, [customersAll, onlyMissingDelivery]);
  const totals = useMemo(() => {
    if (!onlyMissingDelivery) return aggregateByProduct(rows);
    const allowed = new Set(customers.map((c) => c.user_id));
    return aggregateByProduct(rows.filter((r) => allowed.has(r.user_id)));
  }, [rows, customers, onlyMissingDelivery]);

  function downloadCsv(filename: string, csv: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCustomersCsv() {
    const lines: string[] = [];
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    lines.push(
      [
        'cliente',
        'email',
        'telefono',
        'direccion',
        'producto',
        'unidades_por_dia',
        'unidades_semana',
      ].join(','),
    );
    for (const c of customers) {
      const { nombre, apellido } = displayNombreApellido(c);
      const cliente =
        [nombre, apellido].filter(Boolean).join(' ').trim() || c.user_id;
      for (const l of c.lines) {
        const perDay = l.quantity;
        const perWeek = perDay * 6;
        lines.push(
          [
            esc(cliente),
            esc(c.email ?? ''),
            esc(c.phone ?? ''),
            esc(c.address ?? ''),
            esc(l.product_name),
            String(perDay),
            String(perWeek),
          ].join(','),
        );
      }
    }
    downloadCsv(`mipan_${weekStart}_clientes.csv`, lines.join('\n'));
  }

  function exportTotalsCsv() {
    const lines: string[] = [];
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    lines.push(['producto', 'unidades_por_dia', 'unidades_semana'].join(','));
    for (const [name, perDay] of totals) {
      lines.push([esc(name), String(perDay), String(perDay * 6)].join(','));
    }
    downloadCsv(`mipan_${weekStart}_totales.csv`, lines.join('\n'));
  }

  function shiftWeek(d: number) {
    setWeekStart((w) => addDaysYmd(w, d * 7));
  }

  const calendarMonday = mondayWeekStart();
  const weekRelation = useMemo(
    () => relativeWeekBadgeText(weekStart, calendarMonday),
    [weekStart, calendarMonday],
  );

  const badgeClass =
    weekRelation.tone === 'current'
      ? 'bg-emerald-50 text-emerald-900 ring-emerald-200/80'
      : weekRelation.tone === 'past'
        ? 'bg-amber-50 text-amber-950 ring-amber-200/70'
        : 'bg-sky-50 text-sky-950 ring-sky-200/80';

  return (
    <div className='min-h-svh font-sans text-ink'>
      <AppNavbar />

      <div className='mx-auto max-w-6xl px-4 py-6 sm:px-6'>
        <header className='mb-8'>
          <h1 className='font-display text-2xl font-semibold tracking-tight sm:text-3xl'>
            Producción semanal
          </h1>
          <p className='mt-2 max-w-2xl text-sm text-muted'>
            Totales por producto y detalle por cliente para la semana completa
            (lun–sáb).
          </p>
          {bakeryId != null && (
            <p className='mt-2 text-xs font-semibold uppercase tracking-wide text-muted'>
              Panadería #{bakeryId}
            </p>
          )}
        </header>

        <div className='mb-8 flex flex-col gap-5 rounded-2xl border border-[var(--color-border)] bg-card p-5 shadow-md shadow-stone-900/[0.04] sm:flex-row sm:flex-wrap sm:items-end'>
          <div className='min-w-0 flex-1 space-y-3'>
            <p className='text-xs font-bold uppercase tracking-wider text-muted'>
              Semana a producir
            </p>
            <div className='flex flex-nowrap items-center gap-2'>
              <Button
                type='button'
                variant='secondary'
                className='!min-h-10 shrink-0 !px-3'
                onClick={() => shiftWeek(-1)}
                aria-label='Semana anterior'
              >
                ←
              </Button>
              <input
                type='date'
                aria-label='Lunes de la semana'
                className='min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-white px-2 py-2 text-sm shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:max-w-[11rem]'
                value={weekStart}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setWeekStart(mondayFromAnyYmd(v));
                }}
              />
              <Button
                type='button'
                variant='secondary'
                className='!min-h-10 shrink-0 !px-3'
                onClick={() => shiftWeek(1)}
                aria-label='Semana siguiente'
              >
                →
              </Button>
            </div>
            <div className='flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3'>
              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ring-1 ${badgeClass}`}
              >
                {weekRelation.text}
              </span>
              <p className='text-sm text-muted'>
                <span className='font-medium text-ink'>
                  {formatWeekRangeEs(weekStart)}
                </span>
                <span className='mx-1.5 text-muted'>·</span>
                Lun–sáb
              </p>
            </div>
            {weekStart !== calendarMonday && (
              <Button
                type='button'
                variant='ghost'
                className='!h-auto !min-h-0 !px-0 !py-0 !text-sm font-semibold text-accent underline-offset-2 hover:underline'
                onClick={() => setWeekStart(mondayWeekStart())}
              >
                Volver a la semana actual
              </Button>
            )}
          </div>
          <Button
            type='button'
            variant='secondary'
            className='!min-h-10 w-full sm:w-auto'
            onClick={load}
            disabled={!canLoad}
          >
            Actualizar datos
          </Button>
          <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center'>
            <label className='inline-flex items-center gap-2 text-sm font-medium text-muted'>
              <input
                type='checkbox'
                className='h-4 w-4 accent-[var(--color-accent)]'
                checked={onlyMissingDelivery}
                onChange={(e) => setOnlyMissingDelivery(e.target.checked)}
                disabled={!canLoad}
              />
              Solo faltan datos
            </label>
            <Button
              type='button'
              variant='secondary'
              className='!min-h-10 w-full sm:w-auto'
              onClick={exportTotalsCsv}
              disabled={!canLoad || loading}
            >
              Exportar totales CSV
            </Button>
            <Button
              type='button'
              variant='secondary'
              className='!min-h-10 w-full sm:w-auto'
              onClick={exportCustomersCsv}
              disabled={!canLoad || loading}
            >
              Exportar clientes CSV
            </Button>
          </div>
        </div>

        {error && (
          <p className='mb-6 rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-900 shadow-sm'>
            {error}
          </p>
        )}

        {loading ? (
          <div className='flex justify-center py-16'>
            <Loader label='Cargando producción…' />
          </div>
        ) : (
          <div className='grid gap-6 lg:grid-cols-2'>
            <section className='rounded-2xl border border-[var(--color-border)] bg-card p-5 shadow-md shadow-stone-900/[0.04] sm:p-6'>
              <h2 className='font-display text-lg font-semibold text-ink'>
                Totales · semana
              </h2>
              <p className='mt-1 text-xs text-muted'>
                Semana del {weekStart} · Por día y total semana (×6)
              </p>
              {totals.length === 0 ? (
                <p className='mt-6 text-sm text-muted'>
                  No hay unidades para este día.
                </p>
              ) : (
                <div className='mt-5 overflow-hidden rounded-xl border border-[var(--color-border)]'>
                  <table className='w-full text-sm'>
                    <thead className='bg-stone-50/90'>
                      <tr className='text-left text-xs font-bold uppercase tracking-wide text-muted'>
                        <th className='px-4 py-3'>Producto</th>
                        <th className='px-4 py-3 text-right'>Por día</th>
                        <th className='px-4 py-3 text-right'>Semana</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-[var(--color-border)] bg-white'>
                      {totals.map(([name, qty]) => (
                        <tr
                          key={name}
                          className='transition-colors hover:bg-amber-50/30'
                        >
                          <td className='px-4 py-3 font-medium text-ink'>
                            {name}
                          </td>
                          <td className='px-4 py-3 text-right text-base font-semibold tabular-nums text-accent'>
                            {qty}
                          </td>
                          <td className='px-4 py-3 text-right text-base font-semibold tabular-nums text-ink'>
                            {qty * 6}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className='rounded-2xl border border-[var(--color-border)] bg-card p-5 shadow-md shadow-stone-900/[0.04] sm:p-6 lg:col-span-2'>
              <h2 className='font-display text-lg font-semibold text-ink'>
                Detalle por cliente
              </h2>
              <p className='mt-1 text-xs text-muted'>
                {customers.length}{' '}
                {customers.length === 1 ? 'cliente' : 'clientes'}
                {onlyMissingDelivery ? ' · faltan datos' : ''}
              </p>
              {customers.length === 0 ? (
                <p className='mt-6 text-sm text-muted'>
                  Sin clientes con pedido este día.
                </p>
              ) : (
                <div className='mt-5 overflow-x-auto rounded-xl border border-[var(--color-border)] shadow-inner'>
                  <table className='min-w-full text-sm'>
                    <thead className='sticky top-0 z-[1] bg-stone-100/95 backdrop-blur'>
                      <tr className='text-left text-xs font-bold uppercase tracking-wide text-muted'>
                        <th className='whitespace-nowrap px-4 py-3'>Nombre</th>
                        <th className='whitespace-nowrap px-4 py-3'>
                          Apellido
                        </th>
                        <th className='whitespace-nowrap px-4 py-3'>Correo</th>
                        <th className='whitespace-nowrap px-4 py-3'>
                          Teléfono
                        </th>
                        <th className='min-w-[8rem] px-4 py-3'>Dirección</th>
                        <th className='min-w-[10rem] px-4 py-3'>
                          Pedido (por día)
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-[var(--color-border)] bg-white'>
                      {customers.map((c) => {
                        const { nombre, apellido } = displayNombreApellido(c);
                        return (
                          <tr
                            key={c.user_id}
                            className='align-top transition-colors hover:bg-stone-50/80'
                          >
                            <td className='px-4 py-3 font-medium text-ink'>
                              {nombre}
                              <div className='mt-1 max-w-[10rem] truncate font-mono text-[10px] font-normal text-muted'>
                                {c.user_id}
                              </div>
                            </td>
                            <td className='px-4 py-3'>{apellido}</td>
                            <td className='max-w-[12rem] break-all px-4 py-3 text-muted'>
                              {c.email ?? '—'}
                            </td>
                            <td className='whitespace-nowrap px-4 py-3'>
                              {c.phone ?? '—'}
                            </td>
                            <td className='max-w-[14rem] px-4 py-3 text-muted'>
                              {c.address ?? '—'}
                            </td>
                            <td className='px-4 py-3'>
                              <ul className='space-y-1.5 text-ink'>
                                {c.lines.map((l) => (
                                  <li
                                    key={l.product_name}
                                    className='flex items-baseline justify-between gap-2 rounded-lg bg-stone-50 px-2 py-1 text-xs'
                                  >
                                    <span className='truncate'>
                                      {l.product_name}
                                    </span>
                                    <span className='shrink-0 font-bold tabular-nums text-accent'>
                                      {l.quantity}/día
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

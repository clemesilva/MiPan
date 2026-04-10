import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  addDaysYmd,
  formatWeekRangeEs,
  mondayFromAnyYmd,
  mondayWeekStart,
} from '../lib/week';
import { fetchActiveProducts } from '../services/products';
import {
  confirmWeeklyOrder,
  fetchMyWeeklyOrderItemsByWeek,
  fetchWeeklyOrderWithItems,
  getOrCreateWeeklyOrder,
  upsertOrderItems,
  type ItemCell,
} from '../services/orders';
import type { Product, WeeklyOrderItem } from '../types/database';
import { AppNavbar } from '../components/layout/AppNavbar';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';

/** Cantidad por día (lun–sáb, la misma) a partir de filas guardadas. */
function qtyPerDayFromItems(
  items: WeeklyOrderItem[] | undefined,
  productId: string,
): number {
  if (!items?.length) return 0;
  const row = items.find((r) => r.product_uuid_id === productId);
  return row?.quantity ?? 0;
}

function orderCutoffLocal(weekStartYmd: string): Date {
  const [y, m, d] = weekStartYmd.split('-').map(Number);
  // Cutoff: domingo anterior a la semana (23:59:59 local)
  const cutoff = new Date(y, m - 1, d, 23, 59, 59);
  cutoff.setDate(cutoff.getDate() - 1);
  return cutoff;
}

export function CustomerWeeklyOrderPage() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const semanaRaw = searchParams.get('semana');

  const [weekStart, setWeekStart] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get('semana');
    return raw ? mondayFromAnyYmd(raw) : mondayWeekStart();
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderUuidId, setOrderUuidId] = useState<string | null>(null);
  const [status, setStatus] = useState<'pending' | 'confirmed'>('pending');
  const [qtyPerDay, setQtyPerDay] = useState<Record<string, number>>({});
  const [baselineQty, setBaselineQty] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const cutoff = orderCutoffLocal(weekStart);
  const canEdit = new Date() <= cutoff;
  const isViewingCurrentWeek = weekStart === mondayWeekStart();
  const cutoffLabel = cutoff.toLocaleString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  useEffect(() => {
    if (!searchParams.get('semana')) {
      setSearchParams({ semana: mondayWeekStart() }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (semanaRaw) {
      const m = mondayFromAnyYmd(semanaRaw);
      setWeekStart((prev) => (prev === m ? prev : m));
    }
  }, [semanaRaw]);

  const setWeekAndUrl = useCallback(
    (ymd: string) => {
      const m = mondayFromAnyYmd(ymd);
      setWeekStart(m);
      setSearchParams({ semana: m }, { replace: true });
    },
    [setSearchParams],
  );

  const loadWeek = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [prods, order] = await Promise.all([
        fetchActiveProducts(),
        getOrCreateWeeklyOrder(user.id, weekStart),
      ]);
      setProducts(prods);
      setOrderId(order.id);
      setOrderUuidId(order.uuid_id ?? null);
      setStatus(order.status === 'confirmed' ? 'confirmed' : 'pending');

      const full = await fetchWeeklyOrderWithItems(order.id);
      const items = full?.weekly_order_items;
      const next: Record<string, number> = {};
      for (const p of prods) {
        next[String(p.uuid_id)] = qtyPerDayFromItems(items, p.uuid_id);
      }
      setQtyPerDay(next);
      setBaselineQty(next);
      setIsEditing(order.status === 'pending');
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'string'
            ? e
            : (e as { message?: unknown } | null)?.message;
      setError(
        typeof msg === 'string' && msg.trim()
          ? msg
          : 'No se pudo cargar el pedido',
      );
    } finally {
      setLoading(false);
    }
  }, [user, weekStart]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  function setProductQty(productId: string, value: string) {
    const n = Math.max(0, Number.parseInt(value, 10) || 0);
    setQtyPerDay((prev) => ({ ...prev, [productId]: n }));
  }

  const itemsPayload: ItemCell[] = useMemo(() => {
    const out: ItemCell[] = [];
    for (const p of products) {
      const q = qtyPerDay[String(p.uuid_id)] ?? 0;
      if (q <= 0) continue;
      out.push({
        product_id: p.id,
        product_uuid_id: p.uuid_id,
        quantity: q,
      });
    }
    return out;
  }, [products, qtyPerDay]);

  const isDirty = useMemo(() => {
    for (const p of products) {
      const key = String(p.uuid_id);
      const a = qtyPerDay[key] ?? 0;
      const b = baselineQty[key] ?? 0;
      if (a !== b) return true;
    }
    return false;
  }, [products, qtyPerDay, baselineQty]);

  function cancelEditing() {
    setQtyPerDay(baselineQty);
    setIsEditing(false);
    setNotice(null);
    setError(null);
  }

  async function copyPreviousWeek() {
    if (!user || !orderId || !canEdit) return;
    setCopying(true);
    setNotice(null);
    setError(null);
    try {
      const prevWeek = addDaysYmd(weekStart, -7);
      const prevItems = await fetchMyWeeklyOrderItemsByWeek(user.id, prevWeek);
      if (prevItems.length === 0) {
        setError('No encontramos un pedido la semana anterior para copiar.');
        return;
      }
      const next: Record<string, number> = {};
      for (const p of products) next[p.uuid_id] = 0;
      for (const it of prevItems) {
        next[String(it.product_uuid_id)] = it.quantity;
      }
      setQtyPerDay(next);
      setIsEditing(true);
      setNotice('Copiado desde la semana anterior. Revisa y guarda cambios.');
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'No se pudo copiar la semana anterior',
      );
    } finally {
      setCopying(false);
    }
  }

  const totalPerDay = useMemo(
    () => products.reduce((sum, p) => sum + (qtyPerDay[String(p.uuid_id)] ?? 0), 0),
    [products, qtyPerDay],
  );

  async function confirmOrder() {
    if (!orderId || !canEdit) return;
    if (needsProfile) {
      setError(
        'Completa tu perfil (nombre, teléfono y dirección) antes de confirmar o guardar.',
      );
      return;
    }
    if (totalPerDay <= 0) {
      setError(
        'Agrega al menos 1 unidad (por día) antes de confirmar o guardar.',
      );
      return;
    }
    if (!orderUuidId?.trim()) {
      setError(
        'Falta el ID interno del pedido (uuid_id). Recarga la página; si sigue fallando, revisa la tabla weekly_orders en Supabase.',
      );
      return;
    }
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await upsertOrderItems(orderId, itemsPayload, orderUuidId);
      if (status !== 'confirmed') {
        await confirmWeeklyOrder(orderId);
        setStatus('confirmed');
        setNotice(
          'Pedido confirmado. Puedes seguir editándolo hasta el domingo.',
        );
      } else {
        setNotice('Cambios guardados.');
      }
      setBaselineQty(qtyPerDay);
      setIsEditing(false);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'string'
            ? e
            : (e as { message?: unknown } | null)?.message;
      setError(
        typeof msg === 'string' && msg.trim() ? msg : 'No se pudo confirmar',
      );
    } finally {
      setSaving(false);
    }
  }

  function shiftWeek(deltaWeeks: number) {
    setWeekAndUrl(addDaysYmd(weekStart, deltaWeeks * 7));
  }

  const hasName =
    Boolean(profile?.given_name?.trim()) ||
    Boolean(profile?.family_name?.trim()) ||
    Boolean(profile?.full_name?.trim());
  const hasDeliveryBasics =
    Boolean(profile?.phone?.trim()) && Boolean(profile?.address?.trim());
  const needsProfile = !hasName || !hasDeliveryBasics;

  const deliverySummary = [profile?.phone, profile?.address]
    .filter(Boolean)
    .join(' · ');

  if (loading && !orderId) {
    return (
      <div className='min-h-svh font-sans text-ink'>
        <AppNavbar />
        <div className='flex justify-center py-24'>
          <Loader label='Cargando tu semana…' />
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-svh pb-32 font-sans text-ink'>
      <AppNavbar />

      <main className='mx-auto max-w-xl px-4 py-6 sm:px-6'>
        <div className='mb-2 flex flex-wrap items-center gap-2 text-sm'>
          <Link
            to='/app/pedidos'
            className='font-medium text-accent underline-offset-2 hover:underline'
          >
            ← Mis pedidos
          </Link>
        </div>

        <header className='mb-6 space-y-3'>
          <h1 className='font-display text-2xl font-semibold tracking-tight sm:text-3xl'>
            Pedido semanal
          </h1>
          <div className='flex flex-wrap items-center gap-2'>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase ${
                status === 'confirmed'
                  ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80'
                  : 'bg-amber-100 text-amber-900 ring-1 ring-amber-200/80'
              }`}
            >
              {status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
            </span>
            {isViewingCurrentWeek ? (
              <span className='rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200/80'>
                Semana actual
              </span>
            ) : (
              <span className='rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-950 ring-1 ring-amber-200/70'>
                Otra semana
              </span>
            )}
          </div>
          <p
            className={`text-sm leading-snug ${
              canEdit ? 'text-muted' : 'font-medium text-amber-950'
            }`}
          >
            {canEdit ? (
              <>
                Podés editar hasta el{' '}
                <time dateTime={cutoff.toISOString()} className='font-semibold text-ink'>
                  {cutoffLabel}
                </time>
                .
              </>
            ) : (
              <>Plazo cerrado para editar este pedido.</>
            )}
          </p>
        </header>

        <section
          className='mb-6 rounded-2xl border border-[var(--color-border)] bg-card p-4 shadow-sm'
          aria-label='Cambiar semana'
        >
          <p className='mb-3 text-center text-sm font-semibold leading-snug text-ink'>
            <time dateTime={weekStart}>{formatWeekRangeEs(weekStart)}</time>
          </p>
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='secondary'
              className='!min-h-10 min-w-0 flex-1 !px-2 !py-2 !text-sm'
              onClick={() => shiftWeek(-1)}
            >
              ←
            </Button>
            <Button
              type='button'
              variant={isViewingCurrentWeek ? 'primary' : 'secondary'}
              className='!min-h-10 min-w-0 flex-[1.35] !px-2 !py-2 !text-sm'
              onClick={() => setWeekAndUrl(mondayWeekStart())}
            >
              Esta semana
            </Button>
            <Button
              type='button'
              variant='secondary'
              className='!min-h-10 min-w-0 flex-1 !px-2 !py-2 !text-sm'
              onClick={() => shiftWeek(1)}
            >
              →
            </Button>
          </div>
          {canEdit && (
            <Button
              type='button'
              variant='ghost'
              className='mt-3 w-full !min-h-10 !py-2 !text-sm'
              disabled={copying || saving}
              onClick={copyPreviousWeek}
            >
              {copying ? 'Copiando…' : 'Copiar desde la semana anterior'}
            </Button>
          )}
        </section>

        {error && (
          <p className='mb-4 rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-900 shadow-sm'>
            {error}
          </p>
        )}
        {notice && (
          <p className='mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900 shadow-sm'>
            {notice}
          </p>
        )}

        {needsProfile && (
          <section className='mb-8 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5 shadow-sm sm:p-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <h2 className='font-display text-lg font-semibold text-ink'>
                  Completa tus datos para el reparto
                </h2>
                <p className='mt-2 text-sm leading-relaxed text-muted'>
                  Antes de pedir, necesitamos tu{' '}
                  <strong className='text-ink'>nombre</strong>,{' '}
                  <strong className='text-ink'>teléfono</strong> y{' '}
                  <strong className='text-ink'>dirección</strong>.
                </p>
                {deliverySummary && (
                  <p className='mt-3 text-sm text-ink'>
                    <span className='font-semibold'>Actual</span>:{' '}
                    {deliverySummary}
                  </p>
                )}
              </div>
              <Link
                to='/app/perfil'
                className='inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-accent shadow-sm transition hover:bg-accent-soft'
              >
                Ir a mi perfil
              </Link>
            </div>
          </section>
        )}

        <section
          className={[
            'rounded-2xl border bg-card p-5 shadow-md shadow-stone-900/[0.04] sm:p-6',
            isEditing
              ? 'border-amber-300 ring-2 ring-amber-200/60'
              : 'border-[var(--color-border)]',
            !canEdit ? 'bg-stone-50/60 opacity-80 grayscale' : '',
          ].join(' ')}
        >
          <header className='flex flex-wrap items-center justify-between gap-2'>
            <h2 className='font-display text-lg font-semibold text-ink'>
              Tu pedido
            </h2>
            {canEdit && !isEditing && status === 'confirmed' && (
              <span className='rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-muted ring-1 ring-stone-200'>
                Solo lectura
              </span>
            )}
            {canEdit && isEditing && (
              <span className='rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 ring-1 ring-amber-200/80'>
                Editando
              </span>
            )}
            {!canEdit && (
              <span className='rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-700 ring-1 ring-stone-200'>
                Cerrado
              </span>
            )}
          </header>
          <p className='mt-3 text-sm text-muted'>
            Cantidades por día (lun–sáb). Deja en 0 lo que no pedirás.
          </p>
          {canEdit && !isEditing && status === 'confirmed' && (
            <p className='mt-3 text-sm text-muted'>
              Este pedido está confirmado. Pulsa{' '}
              <span className='font-semibold text-ink'>Editar cantidades</span>{' '}
              para modificarlo.
            </p>
          )}

          <ul className='mt-6 flex flex-col gap-3'>
            {products.map((p) => (
              <li
                key={p.uuid_id}
                className={[
                  'flex flex-col gap-3 rounded-2xl border bg-gradient-to-b p-4 transition-all sm:flex-row sm:items-center sm:justify-between',
                  isEditing
                    ? 'border-amber-200/80 from-amber-50/70 to-white shadow-sm'
                    : 'border-[var(--color-border)] from-stone-50/90 to-white',
                  !canEdit
                    ? 'border-stone-200 from-stone-50 to-stone-50 shadow-none'
                    : !isEditing
                      ? 'opacity-90'
                      : '',
                ].join(' ')}
              >
                <span className='text-base font-semibold text-ink'>
                  {p.name}
                </span>
                <label className='flex shrink-0 items-center justify-between gap-3 sm:justify-end'>
                  <span className='text-sm font-medium text-muted'>
                    Unidades / día
                  </span>
                  <input
                    type='number'
                    min={0}
                    inputMode='numeric'
                    className={[
                      'h-12 w-[5.5rem] rounded-xl border px-3 text-center text-lg font-semibold tabular-nums shadow-sm outline-none transition-all',
                      isEditing
                        ? 'border-amber-200 bg-white focus:border-accent focus:ring-2 focus:ring-accent/25'
                        : 'border-stone-200 bg-stone-100 text-stone-500',
                      !canEdit ? 'cursor-not-allowed' : '',
                    ].join(' ')}
                    value={qtyPerDay[String(p.uuid_id)] ?? ''}
                    onChange={(e) =>
                      setProductQty(String(p.uuid_id), e.target.value)
                    }
                    disabled={!canEdit || !isEditing}
                    aria-label={`${p.name}: unidades por día`}
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>

        {canEdit ? (
          <div className='fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--color-border)] bg-card/95 px-4 py-4 shadow-[0_-12px_40px_rgba(28,25,23,0.08)] backdrop-blur-md supports-[padding:max(0px)]:pb-[max(1rem,env(safe-area-inset-bottom))]'>
            <div className='mx-auto flex w-full max-w-xl gap-3'>
              {!isEditing ? (
                <Button
                  type='button'
                  className='flex-1'
                  disabled={saving}
                  onClick={() => setIsEditing(true)}
                >
                  Editar cantidades
                </Button>
              ) : (
                <>
                  <Button
                    type='button'
                    variant='secondary'
                    className='flex-1'
                    disabled={saving}
                    onClick={cancelEditing}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type='button'
                    className='flex-1'
                    disabled={saving || !isDirty}
                    onClick={confirmOrder}
                  >
                    {status === 'confirmed'
                      ? 'Guardar cambios'
                      : 'Confirmar pedido'}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className='mt-8 rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 px-4 py-4 text-center text-sm text-muted'>
            El plazo de edición terminó. Para cambios, contacta a la panadería.
          </p>
        )}
      </main>
    </div>
  );
}

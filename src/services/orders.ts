import { supabase } from '../lib/supabaseClient'
import type { WeeklyOrder, WeeklyOrderItem } from '../types/database'

export type OrderWithItems = WeeklyOrder & {
  weekly_order_items: WeeklyOrderItem[]
}

export async function getOrCreateWeeklyOrder(
  userId: string,
  weekStart: string,
): Promise<WeeklyOrder> {
  const { data: existing, error: findErr } = await supabase
    .from('weekly_orders')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (findErr) throw findErr
  if (existing) return existing as WeeklyOrder

  const { data, error } = await supabase
    .from('weekly_orders')
    .insert({ user_id: userId, week_start: weekStart, status: 'pending' as const })
    .select()
    .single()

  if (!error) return data as WeeklyOrder

  // Condición de carrera: otro request creó la misma semana (constraint unique)
  const errMsg = (error.message ?? '').toLowerCase()
  if (errMsg.includes('weekly_orders_week_unique') || errMsg.includes('duplicate key')) {
    const { data: again, error: againErr } = await supabase
      .from('weekly_orders')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle()
    if (againErr) throw againErr
    if (again) return again as WeeklyOrder
  }

  throw error
}

/** Todas las semanas del usuario con fila en `weekly_orders` (más recientes primero). */
export async function fetchWeeklyOrdersForUser(userId: string): Promise<WeeklyOrder[]> {
  const { data, error } = await supabase
    .from('weekly_orders')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })

  if (error) throw error
  return (data ?? []) as WeeklyOrder[]
}

export type OrderSummaryRow = {
  order_id: string
  week_start: string
  status: 'pending' | 'confirmed'
  top_products: { name: string; qty_per_day: number }[]
  total_per_day: number
}

export async function fetchWeeklyOrdersSummaryForUser(
  userId: string,
  opts?: { limit?: number },
): Promise<OrderSummaryRow[]> {
  const limit = opts?.limit ?? 50

  const { data: orders, error: ordErr } = await supabase
    .from('weekly_orders')
    .select('id, week_start, status')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(limit)

  if (ordErr) throw ordErr
  if (!orders?.length) return []

  const orderIds = orders.map((o) => o.id)
  const { data: items, error: itemsErr } = await supabase
    .from('weekly_order_items')
    .select(
      `
      weekly_order_id,
      quantity,
      products ( name )
    `,
    )
    .in('weekly_order_id', orderIds)

  if (itemsErr) throw itemsErr

  type ItemRow = {
    weekly_order_id: string
    quantity: number
    products: { name: string } | { name: string }[] | null
  }
  const normalized = (items ?? []) as ItemRow[]

  const byOrder = new Map<
    string,
    { productTotals: Map<string, number>; totalPerDay: number }
  >()
  for (const row of normalized) {
    const prod = Array.isArray(row.products) ? row.products[0] : row.products
    const name = prod?.name ?? 'Producto'
    const acc = byOrder.get(row.weekly_order_id) ?? {
      productTotals: new Map<string, number>(),
      totalPerDay: 0,
    }
    acc.productTotals.set(name, (acc.productTotals.get(name) ?? 0) + row.quantity)
    acc.totalPerDay += row.quantity
    byOrder.set(row.weekly_order_id, acc)
  }

  return (orders as { id: string; week_start: string; status: 'pending' | 'confirmed' }[]).map(
    (o) => {
      const acc = byOrder.get(o.id)
      const top =
        acc?.productTotals
          ? [...acc.productTotals.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([name, qty]) => ({ name, qty_per_day: qty }))
          : []
      return {
        order_id: o.id,
        week_start: o.week_start,
        status: o.status,
        top_products: top,
        total_per_day: acc?.totalPerDay ?? 0,
      }
    },
  )
}

export async function fetchWeeklyOrderWithItems(
  orderId: string,
): Promise<OrderWithItems | null> {
  const { data, error } = await supabase
    .from('weekly_orders')
    .select('*, weekly_order_items(*)')
    .eq('id', orderId)
    .maybeSingle()

  if (error) throw error
  return data as OrderWithItems | null
}

export async function fetchMyWeeklyOrderItemsByWeek(
  userId: string,
  weekStart: string,
): Promise<WeeklyOrderItem[]> {
  const { data: ord, error: ordErr } = await supabase
    .from('weekly_orders')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (ordErr) throw ordErr
  if (!ord?.id) return []

  const { data: items, error: itemsErr } = await supabase
    .from('weekly_order_items')
    .select('id, weekly_order_id, product_id, product_uuid_id, quantity')
    .eq('weekly_order_id', ord.id)

  if (itemsErr) throw itemsErr
  return (items ?? []) as WeeklyOrderItem[]
}

export type ItemCell = {
  product_id: number
  product_uuid_id: string
  quantity: number
}

export async function upsertOrderItems(
  weeklyOrderId: string,
  items: ItemCell[],
  weeklyOrderUuidId?: string | null,
): Promise<void> {
  const uuidPart =
    weeklyOrderUuidId != null && String(weeklyOrderUuidId).trim() !== ''
      ? { weekly_order_uuid_id: weeklyOrderUuidId }
      : {}
  const rows = items
    .filter((i) => i.quantity > 0)
    .map((i) => ({
      weekly_order_id: weeklyOrderId,
      ...uuidPart,
      product_id: i.product_id,
      product_uuid_id: i.product_uuid_id,
      quantity: i.quantity,
    }))

  const { error: delErr } = await supabase
    .from('weekly_order_items')
    .delete()
    .eq('weekly_order_id', weeklyOrderId)

  if (delErr) throw delErr

  if (rows.length === 0) return

  const { error: insErr } = await supabase.from('weekly_order_items').insert(rows)
  if (insErr) throw insErr
}

export async function confirmWeeklyOrder(orderId: string): Promise<void> {
  const { error } = await supabase
    .from('weekly_orders')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'pending')

  if (error) throw error
}

export type BakeryRow = {
  order_id: string
  user_id: string
  full_name: string | null
  given_name: string | null
  family_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  product_id: string
  product_name: string
  quantity: number
}

export async function fetchBakeryProduction(
  weekStart: string,
): Promise<BakeryRow[]> {
  const { data: orders, error: ordErr } = await supabase
    .from('weekly_orders')
    .select('id, user_id')
    .eq('week_start', weekStart)
    .eq('status', 'confirmed')

  if (ordErr) throw ordErr
  if (!orders?.length) return []

  const orderIds = orders.map((o) => o.id)
  const userIds = [...new Set(orders.map((o) => o.user_id))]

  const [{ data: profiles, error: profErr }, { data: items, error: itemsErr }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, given_name, family_name, email, phone, address')
        .in('id', userIds),
      supabase
        .from('weekly_order_items')
        .select(
          `
          quantity,
          product_uuid_id,
          weekly_order_id,
          products ( id, name )
        `,
        )
        .in('weekly_order_id', orderIds),
    ])

  if (profErr) throw profErr
  if (itemsErr) throw itemsErr

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p as {
        full_name: string | null
        given_name: string | null
        family_name: string | null
        email: string | null
        phone: string | null
        address: string | null
      },
    ]),
  )
  const orderMeta = new Map(orders.map((o) => [o.id, o.user_id]))

  type ItemRow = {
    quantity: number
    product_uuid_id: string
    weekly_order_id: string
    products: { id: string; name: string } | { id: string; name: string }[] | null
  }

  const normalized = (items ?? []) as ItemRow[]

  return normalized.map((row) => {
    const prod = Array.isArray(row.products) ? row.products[0] : row.products
    const uid = orderMeta.get(row.weekly_order_id) ?? ''
    const prof = profileById.get(uid)
    return {
      order_id: row.weekly_order_id,
      user_id: uid,
      full_name: prof?.full_name ?? null,
      given_name: prof?.given_name ?? null,
      family_name: prof?.family_name ?? null,
      email: prof?.email ?? null,
      phone: prof?.phone ?? null,
      address: prof?.address ?? null,
      product_id: prod?.id ?? row.product_uuid_id,
      product_name: prod?.name ?? '',
      quantity: row.quantity,
    }
  })
}

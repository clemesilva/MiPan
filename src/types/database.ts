export type UserRole = 'customer' | 'bakery_admin'
export type OrderStatus = 'pending' | 'confirmed'

export type Profile = {
  id: string
  role: UserRole
  /** Panadería asociada (solo para bakery_admin). */
  bakery_id?: number | null
  /** Nombre para mostrar (OAuth o manual) */
  full_name: string | null
  given_name: string | null
  family_name: string | null
  email: string | null
  avatar_url: string | null
  phone: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export type Product = {
  /** PK numérica en BD (orden, legado). */
  id: number
  /** UUID del producto; debe coincidir con `weekly_order_items.product_uuid_id`. */
  uuid_id: string
  name: string
  sort_order: number
  active: boolean
}

export type WeeklyOrder = {
  id: string
  /** Si existe en BD (pedido con columna uuid_id); requerido para ítems con weekly_order_uuid_id NOT NULL. */
  uuid_id?: string | null
  user_id: string
  week_start: string
  status: OrderStatus
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

export type WeeklyOrderItem = {
  id: string
  weekly_order_id: string
  weekly_order_uuid_id?: string | null
  /** FK entero a `products.id` (NOT NULL en BD). */
  product_id: number
  product_uuid_id: string
  /** Unidades por día (lun–sáb). En el MVP es constante para toda la semana. */
  quantity: number
}

/** 1 = lunes … 6 = sábado */
export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
}

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6] as const

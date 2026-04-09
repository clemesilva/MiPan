import { supabase } from '../lib/supabaseClient'
import type { Product } from '../types/database'

export async function fetchActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id,uuid_id,name,sort_order,active')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as Product[]
}

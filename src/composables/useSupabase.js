import { supabase } from '../lib/supabase.js'

export function useSupabase() {
  async function fetchOne(table, filters = {}) {
    let query = supabase.from(table).select('*')
    for (const [col, val] of Object.entries(filters)) {
      query = query.eq(col, val)
    }
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    return data
  }

  async function fetchMany(table, filters = {}, options = {}) {
    let query = supabase.from(table).select('*')
    for (const [col, val] of Object.entries(filters)) {
      query = query.eq(col, val)
    }
    if (options.order) {
      const { column, ascending = true } = options.order
      query = query.order(column, { ascending })
    }
    if (options.limit) {
      query = query.limit(options.limit)
    }
    const { data, error } = await query
    if (error) throw error
    return data
  }

  async function insert(table, row) {
    const { data, error } = await supabase.from(table).insert(row).select().single()
    if (error) throw error
    return data
  }

  async function update(table, id, updates) {
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function remove(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  }

  return { supabase, fetchOne, fetchMany, insert, update, remove }
}

/* Supabase Auth & Cloud Persistence Client */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export async function fetchCloudState(userId) {
  if (!supabase || !userId) return { data: null, error: null };
  const { data, error } = await supabase
    .from('user_srs_state')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data || !data.data) return { data: null, error: null };
  return { data: data.data, updatedAt: data.updated_at, error: null };
}

export async function saveCloudState(userId, state) {
  if (!supabase || !userId) return { error: null };
  const { error } = await supabase
    .from('user_srs_state')
    .upsert(
      {
        user_id: userId,
        data: state,
        updated_at: new Date(state.updatedAt || Date.now()).toISOString()
      },
      { onConflict: 'user_id' }
    );
  return { error };
}

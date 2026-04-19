import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function authenticateUser(username, password) {
  const { data, error } = await supabase.rpc('authenticate_user', {
    p_username: username,
    p_password: password,
  });
  if (error) throw error;
  return data;
}

export async function fetchScores() {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .order('played_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function submitScore(username, game, score) {
  const { error } = await supabase
    .from('scores')
    .insert({ username, game, score });
  if (error) throw error;
}

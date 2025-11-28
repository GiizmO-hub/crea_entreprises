import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [];
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  
  console.error('❌ Variables d\'environnement Supabase manquantes:', missing.join(', '));
  console.error('💡 Vérifiez votre fichier .env dans le dossier du projet');
  
  throw new Error(`Missing Supabase environment variables: ${missing.join(', ')}`);
}

console.log('✅ Configuration Supabase chargée');
console.log('📍 URL:', supabaseUrl.substring(0, 30) + '...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});






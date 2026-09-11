const SUPABASE_URL = 'https://gdkhcderhfnbbuolwnsc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdka2hjZGVyaGZuYmJ1b2x3bnNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MjY4NjQsImV4cCI6MjEwMzIwMjg2NH0.b5mpyVgJnad6gqwXixocsRPJHCg2NvaO9iO-LsaSOhU';

// 1. Garantizar compatibilidad con la librería cargada por CDN
const { createClient } = window.supabase || {};

if (!createClient) {
  console.error('La librería de Supabase no cargó correctamente.');
}

// 2. Inicializar cliente con persistencia de sesión segura para iOS Safari
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: window.localStorage, // Forzar uso de localStorage nativo para iOS
  },
  global: {
    headers: {
      'x-application-name': 'mercado-vivo-mobile',
    },
  },
});

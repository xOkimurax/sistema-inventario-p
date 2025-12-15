import { createClient } from '@supabase/supabase-js';

// Variables de entorno para credenciales de Supabase
// IMPORTANTE: Configura estas variables en tu archivo .env
// Copia .env.example a .env y completa con tus credenciales de Supabase

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ Faltan variables de entorno de Supabase.\n' +
    'Por favor configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env\n' +
    'Puedes copiar .env.example a .env y completar tus credenciales.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'sistema-inventario@1.0.0'
    }
  },
  db: {
    schema: 'public'
  }
});

// Log de configuración de Supabase (solo en desarrollo)
if (import.meta.env.DEV) {
  console.log('[SUPABASE] 📡 Cliente inicializado correctamente');
}

// Verificar conexión inicial
supabase
  .from('roles')
  .select('count')
  .limit(1)
  .then(({ error }) => {
    if (error) {
      console.error('[SUPABASE] ❌ Error de conexión:', error.message);
      console.error('Verifica que tus credenciales en .env sean correctas');
    } else if (import.meta.env.DEV) {
      console.log('[SUPABASE] ✅ Conexión verificada correctamente');
    }
  });

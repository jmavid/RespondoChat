import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function validateSupabaseConfig() {
  const errors = [];

  if (!supabaseUrl) {
    errors.push('VITE_SUPABASE_URL no está configurada');
  } else if (!supabaseUrl.startsWith('https://')) {
    errors.push('VITE_SUPABASE_URL debe comenzar con https://');
  } else {
    try {
      new URL(supabaseUrl);
    } catch {
      errors.push('VITE_SUPABASE_URL no es una URL válida');
    }
  }

  if (!supabaseAnonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY no está configurada');
  } else if (!supabaseAnonKey.includes('.')) {
    errors.push('VITE_SUPABASE_ANON_KEY parece ser inválida');
  }

  if (errors.length > 0) {
    logError(new Error(errors.join('\n')), 'supabase');
    throw new Error(`Configuración de Supabase inválida:\n${errors.join('\n')}`);
  }
}

validateSupabaseConfig();

// Crear el cliente de Supabase con opciones personalizadas
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Mantener la sesión entre recargas
    detectSessionInUrl: true, // Detectar la sesión en la URL después del callback
    autoRefreshToken: true, // Refrescar el token automáticamente
    storageKey: 'chato-auth', // Clave única para el almacenamiento
    storage: window.localStorage, // Usar localStorage para persistencia
    flowType: 'pkce' // Usar PKCE para mayor seguridad
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web',
      'X-Client-Version': '2.39.7'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  db: {
    schema: 'public'
  },
});
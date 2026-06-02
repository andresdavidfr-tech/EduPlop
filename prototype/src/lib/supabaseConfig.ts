/**
 * Configuración de Supabase para sincronización entre dispositivos.
 *
 * Se toma de variables de entorno en build (Vercel → Settings → Environment
 * Variables): VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Como alternativa, se
 * pueden pegar los valores en los fallbacks de abajo (la anon key es pública
 * por diseño y queda protegida por las políticas RLS de la tabla).
 *
 * Si no hay configuración, la app funciona igual que antes (solo localStorage).
 */
// Fallbacks opcionales (rellenar si no se usan variables de entorno):
const URL_FALLBACK = "";
const ANON_FALLBACK = "";

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? URL_FALLBACK).replace(/\/$/, "");
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ANON_FALLBACK;
export const SYNC_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

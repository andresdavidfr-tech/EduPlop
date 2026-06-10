import { SUPABASE_URL, SUPABASE_ANON_KEY, SYNC_ENABLED } from "./supabaseConfig";

/**
 * Autenticación real con Supabase Auth (GoTrue) vía REST, sin SDK.
 * - Email + contraseña, sesión con JWT (access/refresh token).
 * - Tabla `profiles` para el rol y la entidad vinculada (familia/docente).
 */

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: { id: string; email?: string };
}
export interface Profile {
  id: string;
  email?: string;
  name?: string;
  role: string;
  guardian_id?: string | null;
  teacher_id?: string | null;
}

const LS_AUTH = "eduplop-auth";

function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function loadStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(LS_AUTH);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch { return null; }
}
export function storeSession(s: AuthSession | null) {
  try {
    if (s) localStorage.setItem(LS_AUTH, JSON.stringify(s));
    else localStorage.removeItem(LS_AUTH);
  } catch { /* noop */ }
}

function toSession(j: any): AuthSession | null {
  if (j?.access_token && j?.refresh_token) {
    return { access_token: j.access_token, refresh_token: j.refresh_token, user: { id: j.user?.id, email: j.user?.email } };
  }
  return null;
}

/** Inicia sesión con email + contraseña. */
export async function signIn(email: string, password: string): Promise<{ session?: AuthSession; error?: string }> {
  if (!SYNC_ENABLED) return { error: "Supabase no configurado" };
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ email, password }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { error: j.error_description || j.msg || j.error || "Credenciales inválidas" };
    const session = toSession(j);
    return session ? { session } : { error: "Respuesta de auth inválida" };
  } catch { return { error: "Sin conexión con el servidor de autenticación" }; }
}

/** Registra una cuenta nueva (usado para autoaprovisionar las cuentas demo). */
export async function signUp(email: string, password: string): Promise<{ session?: AuthSession; error?: string }> {
  if (!SYNC_ENABLED) return { error: "Supabase no configurado" };
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ email, password }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { error: j.error_description || j.msg || j.error || "No se pudo registrar" };
    const session = toSession(j);
    // Si la confirmación de email está activada, no viene sesión.
    return session ? { session } : { error: "La cuenta requiere confirmación por email (desactivala en Supabase para la demo)" };
  } catch { return { error: "Sin conexión con el servidor de autenticación" }; }
}

/** Renueva la sesión con el refresh token. */
export async function refreshSession(refresh_token: string): Promise<AuthSession | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ refresh_token }),
    });
    if (!res.ok) return null;
    return toSession(await res.json());
  } catch { return null; }
}

/** Verifica que el access token siga válido. */
export async function getAuthUser(access_token: string): Promise<{ id: string; email?: string } | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: authHeaders(access_token) });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.id ? { id: j.id, email: j.email } : null;
  } catch { return null; }
}

export async function signOut(access_token: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: authHeaders(access_token) });
  } catch { /* noop */ }
}

/** Lee el perfil (rol/entidad) del usuario autenticado. */
export async function getProfile(s: AuthSession): Promise<Profile | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${s.user.id}&select=*`, {
      headers: authHeaders(s.access_token),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Profile[];
    return rows?.[0] ?? null;
  } catch { return null; }
}

/** Crea/actualiza el perfil del usuario autenticado (autoaprovisión demo). */
export async function upsertProfile(s: AuthSession, p: Omit<Profile, "id">): Promise<Profile | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: { ...authHeaders(s.access_token), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ id: s.user.id, ...p }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Profile[];
    return rows?.[0] ?? { id: s.user.id, ...p };
  } catch { return null; }
}

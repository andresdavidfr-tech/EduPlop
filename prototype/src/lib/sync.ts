import { SUPABASE_URL, SUPABASE_ANON_KEY, SYNC_ENABLED } from "./supabaseConfig";

/**
 * Sincronización del estado compartido vía la API REST de Supabase (PostgREST).
 * Un único registro (id = 'shared') en la tabla `app_state` guarda el estado
 * compartido como JSON. Se lee/escribe con fetch y se detectan cambios por
 * polling. Sin SDK ni websockets, para mantener el bundle liviano.
 */

const TABLE = "app_state";
const ROW_ID = "shared";

export { SYNC_ENABLED };

// Las claves nuevas de Supabase (sb_publishable_…/sb_secret_…) NO son JWT:
// para ellas el header Authorization no debe llevar el token (PostgREST lo
// rechazaría). Las claves legacy (JWT, empiezan con "eyJ") sí van en Bearer.
const IS_JWT = SUPABASE_ANON_KEY.startsWith("eyJ");

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    ...extra,
  };
  if (IS_JWT) h.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  return h;
}

export interface SharedSnapshot {
  data: Record<string, unknown>;
  updated_at: string;
}

/** Lee el estado compartido. ok=false indica problema de red/credenciales. */
export async function pullShared(): Promise<{ ok: boolean; snapshot: SharedSnapshot | null; status: number }> {
  if (!SYNC_ENABLED) return { ok: false, snapshot: null, status: 0 };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=data,updated_at`,
      { headers: headers() }
    );
    if (!res.ok) return { ok: false, snapshot: null, status: res.status };
    const rows = (await res.json()) as SharedSnapshot[];
    return { ok: true, snapshot: rows?.[0] ?? null, status: res.status };
  } catch {
    return { ok: false, snapshot: null, status: 0 };
  }
}

/** Escribe (upsert) el estado compartido. */
export async function pushShared(data: Record<string, unknown>): Promise<{ ok: boolean; updated_at?: string; status: number }> {
  if (!SYNC_ENABLED) return { ok: false, status: 0 };
  const updated_at = new Date().toISOString();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ id: ROW_ID, data, updated_at }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, updated_at, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

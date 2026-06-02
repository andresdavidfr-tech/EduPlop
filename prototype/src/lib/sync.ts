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

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export interface SharedSnapshot {
  data: Record<string, unknown>;
  updated_at: string;
}

/** Lee el estado compartido. Devuelve null si no existe o si hay error/red. */
export async function pullShared(): Promise<SharedSnapshot | null> {
  if (!SYNC_ENABLED) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=data,updated_at`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as SharedSnapshot[];
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Escribe (upsert) el estado compartido. Devuelve el updated_at usado, o null. */
export async function pushShared(data: Record<string, unknown>): Promise<string | null> {
  if (!SYNC_ENABLED) return null;
  const updated_at = new Date().toISOString();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ id: ROW_ID, data, updated_at }),
    });
    if (!res.ok) return null;
    return updated_at;
  } catch {
    return null;
  }
}

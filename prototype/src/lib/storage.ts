import { SUPABASE_URL, SUPABASE_ANON_KEY, SYNC_ENABLED } from "./supabaseConfig";

/**
 * Subida de archivos a Supabase Storage (sin SDK, vía API REST).
 * Las fotos de autorizados se guardan como archivo en un bucket público y en la
 * base sólo queda la URL (no el base64), por lo que pueden ser de buena calidad.
 */

const BUCKET = "autorizados";
const IS_JWT = SUPABASE_ANON_KEY.startsWith("eyJ");

function headers(contentType: string): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": contentType,
    "x-upsert": "true",
  };
  if (IS_JWT) h.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  return h;
}

/** Sube una foto y devuelve su URL pública, o null si falla (p. ej. falta el bucket). */
export async function uploadPhoto(blob: Blob, path: string): Promise<string | null> {
  if (!SYNC_ENABLED) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(path)}`,
      { method: "POST", headers: headers(blob.type || "image/jpeg"), body: blob }
    );
    if (!res.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(path)}`;
  } catch {
    return null;
  }
}

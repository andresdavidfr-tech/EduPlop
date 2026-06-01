import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

// --- base64url helpers ---
export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeJson(obj: unknown): string {
  return b64urlEncode(utf8ToBytes(JSON.stringify(obj)));
}
export function decodeJson<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlDecode(s)));
}

// --- Ed25519 keypair ---
export interface KeyPair {
  priv: string; // hex
  pub: string; // hex
}
export function generateKeyPair(): KeyPair {
  const priv = ed25519.utils.randomPrivateKey();
  const pub = ed25519.getPublicKey(priv);
  return { priv: bytesToHex(priv), pub: bytesToHex(pub) };
}

/**
 * Deriva un par de llaves Ed25519 determinístico a partir de una semilla fija
 * (32 bytes en hex). Útil para que la llave de la institución sea la MISMA en
 * todos los dispositivos, de modo que un pase firmado en el teléfono de la
 * familia se pueda verificar en el del docente. En producción, la privada
 * viviría solo en el servidor; acá es un prototipo client-side.
 */
export function keyPairFromSeed(seedHex: string): KeyPair {
  const priv = hexToBytes(seedHex);
  const pub = ed25519.getPublicKey(priv);
  return { priv: seedHex, pub: bytesToHex(pub) };
}

export function sign(message: string, privHex: string): string {
  const sig = ed25519.sign(utf8ToBytes(message), hexToBytes(privHex));
  return b64urlEncode(sig);
}
export function verify(message: string, sigB64: string, pubHex: string): boolean {
  try {
    return ed25519.verify(b64urlDecode(sigB64), utf8ToBytes(message), hexToBytes(pubHex));
  } catch {
    return false;
  }
}

// --- hashing (cadena de auditoría) ---
export function sha256hex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}

export function shortHash(h: string): string {
  return h.slice(0, 10) + "…";
}

// --- ULID-ish id (ordenado por tiempo, suficiente para la demo) ---
export function ulid(prefix = ""): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}${t}${r}`.toUpperCase();
}

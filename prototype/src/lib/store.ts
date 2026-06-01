import { useSyncExternalStore } from "react";
import {
  generateKeyPair, sign, verify, sha256hex, encodeJson, ulid, type KeyPair,
} from "./crypto";
import type {
  AuthorizationToken, TokenClaims, PickupReceipt, AuditEvent, Incident,
  Settings, AuditEventType, TokenStatus,
} from "./types";
import { INSTITUTION, DEVICE_ID } from "./seed";

interface State {
  institutionKey: KeyPair;
  deviceKey: KeyPair;
  tokens: AuthorizationToken[];
  receipts: PickupReceipt[];
  ledger: AuditEvent[];
  incidents: Incident[];
  settings: Settings;
  consumedLocally: string[]; // jti consumidos en el dispositivo (anti-reuso offline)
  revokedGuardians: string[]; // lista de revocación (cacheable offline)
}

const LS_KEY = "eduplop-state-v1";

function freshState(): State {
  return {
    institutionKey: generateKeyPair(),
    deviceKey: generateKeyPair(),
    tokens: [],
    receipts: [],
    ledger: [],
    incidents: [],
    settings: { ttlSeconds: 60, clockSkewSeconds: 5, deviceOnline: true },
    consumedLocally: [],
    revokedGuardians: [],
  };
}

class Store {
  private state: State;
  private listeners = new Set<() => void>();

  constructor() {
    const raw = localStorage.getItem(LS_KEY);
    this.state = raw ? JSON.parse(raw) : freshState();
  }

  // --- React glue ---
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = () => this.state;
  private commit(next: Partial<State>) {
    this.state = { ...this.state, ...next };
    localStorage.setItem(LS_KEY, JSON.stringify(this.state));
    this.listeners.forEach((l) => l());
  }

  reset() {
    localStorage.removeItem(LS_KEY);
    this.state = freshState();
    this.commit({});
  }

  get institutionPub() { return this.state.institutionKey.pub; }

  // --- Auditoría: cadena hash append-only ---
  private appendAudit(type: AuditEventType, refId: string, actorId: string, detail: string) {
    const ledger = this.state.ledger;
    const prevHash = ledger.length ? ledger[ledger.length - 1].hash : "GENESIS";
    const seq = ledger.length + 1;
    const timestamp = Date.now();
    const body = JSON.stringify({ seq, type, refId, actorId, detail, timestamp, prevHash });
    const hash = sha256hex(body);
    const event: AuditEvent = { seq, type, refId, actorId, detail, timestamp, prevHash, hash };
    this.commit({ ledger: [...ledger, event] });
    return event;
  }

  // --- FAMILIAS: emisión del QR firmado ---
  issueToken(studentId: string, authorizedId: string, issuedBy: string, reason: string) {
    const now = Date.now();
    const claims: TokenClaims = {
      iss: INSTITUTION.id,
      sub: studentId,
      act: authorizedId,
      jti: ulid("JTI_"),
      iat: now,
      exp: now + this.state.settings.ttlSeconds * 1000,
      nonce: ulid(),
    };
    const encoded = encodeJson(claims);
    const sig = sign(encoded, this.state.institutionKey.priv);
    const qrPayload = `v4.public.${encoded}.${sig}`;
    const token: AuthorizationToken = {
      jti: claims.jti, claims, qrPayload, issuedBy, reason, status: "active",
    };
    this.commit({ tokens: [token, ...this.state.tokens] });
    this.appendAudit("token_issued", claims.jti, issuedBy, `QR emitido para ${studentId} → retira ${authorizedId}`);
    return token;
  }

  revokeToken(jti: string) {
    this.setTokenStatus(jti, "revoked");
  }
  private setTokenStatus(jti: string, status: TokenStatus) {
    this.commit({
      tokens: this.state.tokens.map((t) => (t.jti === jti ? { ...t, status } : t)),
    });
  }

  /** Estado efectivo de un token, considerando TTL. */
  effectiveStatus(t: AuthorizationToken): TokenStatus {
    if (t.status !== "active") return t.status;
    if (Date.now() > t.claims.exp) return "expired";
    return "active";
  }

  // --- DOCENTES: verificación local (sin red) firma + TTL ---
  verifyLocally(qrPayload: string): { ok: boolean; reason?: string; claims?: TokenClaims } {
    const parts = qrPayload.split(".");
    if (parts.length !== 4 || parts[0] !== "v4") return { ok: false, reason: "Formato de QR inválido" };
    const encoded = parts[2];
    const sig = parts[3];
    if (!verify(encoded, sig, this.state.institutionKey.pub)) {
      return { ok: false, reason: "Firma inválida (QR no auténtico)" };
    }
    const claims = JSON.parse(new TextDecoder().decode(b64(encoded))) as TokenClaims;
    const skew = this.state.settings.clockSkewSeconds * 1000;
    if (Date.now() > claims.exp + skew) return { ok: false, reason: "QR vencido (TTL superado)", claims };
    return { ok: true, claims };
  }

  /** Valida un retiro. online = verificación autoritativa; offline = encola. */
  validatePickup(qrPayload: string, teacherId: string, visualConfirmed: boolean):
    { ok: boolean; reason?: string; receipt?: PickupReceipt } {
    const local = this.verifyLocally(qrPayload);
    if (!local.ok || !local.claims) {
      this.appendAudit("pickup_failed", local.claims?.jti ?? "?", teacherId, local.reason ?? "fallo");
      return { ok: false, reason: local.reason };
    }
    const claims = local.claims;
    const online = this.state.settings.deviceOnline;

    // revocación del autorizado (lista cacheable → también funciona offline)
    if (this.state.revokedGuardians.includes(claims.act)) {
      this.appendAudit("pickup_failed", claims.jti, teacherId, "Autorizado revocado / suspendido");
      return { ok: false, reason: "Autorizado revocado o suspendido (no habilitado para retirar)" };
    }

    // anti-reuso local (siempre)
    if (this.state.consumedLocally.includes(claims.jti)) {
      this.appendAudit("pickup_failed", claims.jti, teacherId, "QR ya utilizado en este dispositivo");
      return { ok: false, reason: "QR ya utilizado (consumido en este dispositivo)" };
    }

    // online: verificación autoritativa anti-reuso contra el backend
    if (online) {
      const token = this.state.tokens.find((t) => t.jti === claims.jti);
      if (token && token.status === "consumed") {
        this.appendAudit("pickup_failed", claims.jti, teacherId, "QR ya consumido (servidor)");
        return { ok: false, reason: "QR ya consumido (validación autoritativa del servidor)" };
      }
    }

    // construir comprobante (huella encadenada)
    const prevHash = this.state.ledger.length ? this.state.ledger[this.state.ledger.length - 1].hash : "GENESIS";
    const receiptCore = {
      receiptId: ulid("RCPT_"),
      tokenJti: claims.jti,
      studentId: claims.sub,
      authorizedId: claims.act,
      validatedBy: teacherId,
      deviceId: DEVICE_ID,
      mode: (online ? "online" : "offline") as PickupReceipt["mode"],
      visualConfirmed,
      timestamp: Date.now(),
      prevHash,
    };
    const payloadHash = sha256hex(JSON.stringify(receiptCore));
    const deviceSignature = sign(payloadHash, this.state.deviceKey.priv);

    let receipt: PickupReceipt;
    if (online) {
      const serverSignature = sign(payloadHash, this.state.institutionKey.priv);
      receipt = { ...receiptCore, payloadHash, deviceSignature, serverSignature, pendingSync: false };
      this.commit({
        receipts: [receipt, ...this.state.receipts],
        consumedLocally: [...this.state.consumedLocally, claims.jti],
      });
      this.setTokenStatus(claims.jti, "consumed");
      this.appendAudit("pickup_validated", receipt.receiptId, teacherId,
        `Salida ONLINE: ${claims.sub} retirado por ${claims.act}`);
    } else {
      // offline: encolar, firmar solo con dispositivo, NO marcar consumido en servidor
      receipt = { ...receiptCore, payloadHash, deviceSignature, pendingSync: true };
      this.commit({
        receipts: [receipt, ...this.state.receipts],
        consumedLocally: [...this.state.consumedLocally, claims.jti],
      });
    }
    return { ok: true, receipt };
  }

  /** Reconciliación de la cola offline al recuperar conectividad. */
  syncOfflineQueue(): { synced: number; conflicts: number } {
    const pending = this.state.receipts.filter((r) => r.pendingSync);
    let conflicts = 0;
    for (const r of pending) {
      const token = this.state.tokens.find((t) => t.jti === r.tokenJti);
      const alreadyConsumed = token?.status === "consumed";
      // co-firma del servidor
      const serverSignature = sign(r.payloadHash, this.state.institutionKey.priv);
      this.commit({
        receipts: this.state.receipts.map((x) =>
          x.receiptId === r.receiptId ? { ...x, pendingSync: false, serverSignature } : x),
      });
      if (alreadyConsumed) {
        conflicts++;
        const inc: Incident = {
          id: ulid("INC_"), type: "double_use", refReceiptId: r.receiptId, status: "open",
          detail: `Doble uso detectado para ${r.tokenJti}: validado offline en ${r.deviceId} pero ya consumido.`,
          timestamp: Date.now(),
        };
        this.commit({ incidents: [inc, ...this.state.incidents] });
        this.appendAudit("double_use_detected", r.tokenJti, r.validatedBy,
          `Conflicto de doble uso reconciliado (incidente ${inc.id})`);
      } else {
        this.setTokenStatus(r.tokenJti, "consumed");
        this.appendAudit("pickup_synced", r.receiptId, r.validatedBy,
          `Comprobante OFFLINE reconciliado: ${r.studentId} retirado por ${r.authorizedId}`);
      }
    }
    return { synced: pending.length - conflicts, conflicts };
  }

  setOnline(online: boolean) {
    this.commit({ settings: { ...this.state.settings, deviceOnline: online } });
  }
  setTtl(seconds: number) {
    this.commit({ settings: { ...this.state.settings, ttlSeconds: seconds } });
  }

  openDispute(receiptId: string) {
    const inc: Incident = {
      id: ulid("INC_"), type: "dispute", refReceiptId: receiptId, status: "open",
      detail: `Disputa abierta sobre el comprobante ${receiptId}. El registro original permanece inmutable.`,
      timestamp: Date.now(),
    };
    this.commit({ incidents: [inc, ...this.state.incidents] });
    this.appendAudit("dispute_opened", receiptId, "admin", "Disputa registrada (evento compensatorio)");
  }

  resolveIncident(id: string, resolution: string) {
    this.commit({
      incidents: this.state.incidents.map((i) =>
        i.id === id ? { ...i, status: "resolved", resolution } : i),
    });
    this.appendAudit("dispute_resolved", id, "admin", `Incidente resuelto: ${resolution}`);
  }

  revokeGuardian(id: string) {
    if (this.state.revokedGuardians.includes(id)) return;
    this.commit({ revokedGuardians: [...this.state.revokedGuardians, id] });
    this.appendAudit("guardian_revoked", id, "admin", `Autorizado ${id} revocado (lista de revocación)`);
  }
  restoreGuardian(id: string) {
    this.commit({ revokedGuardians: this.state.revokedGuardians.filter((g) => g !== id) });
    this.appendAudit("guardian_restored", id, "admin", `Autorizado ${id} rehabilitado`);
  }
  isRevoked(id: string) { return this.state.revokedGuardians.includes(id); }

  /** Retiro de contingencia (sin QR): el docente registra una salida verificada manualmente. */
  manualPickup(studentId: string, authorizedId: string, teacherId: string):
    { ok: boolean; reason?: string; receipt?: PickupReceipt } {
    if (this.state.revokedGuardians.includes(authorizedId)) {
      this.appendAudit("pickup_failed", "MANUAL", teacherId, "Autorizado revocado (intento de retiro manual)");
      return { ok: false, reason: "Autorizado revocado o suspendido" };
    }
    const online = this.state.settings.deviceOnline;
    const prevHash = this.state.ledger.length ? this.state.ledger[this.state.ledger.length - 1].hash : "GENESIS";
    const receiptCore = {
      receiptId: ulid("RCPT_"),
      tokenJti: "MANUAL",
      studentId, authorizedId,
      validatedBy: teacherId,
      deviceId: DEVICE_ID,
      mode: "manual" as PickupReceipt["mode"],
      visualConfirmed: true,
      timestamp: Date.now(),
      prevHash,
    };
    const payloadHash = sha256hex(JSON.stringify(receiptCore));
    const deviceSignature = sign(payloadHash, this.state.deviceKey.priv);
    const serverSignature = online ? sign(payloadHash, this.state.institutionKey.priv) : undefined;
    const receipt: PickupReceipt = { ...receiptCore, payloadHash, deviceSignature, serverSignature, pendingSync: !online };
    this.commit({ receipts: [receipt, ...this.state.receipts] });
    this.appendAudit("pickup_manual", receipt.receiptId, teacherId,
      `Retiro MANUAL (contingencia): ${studentId} retirado por ${authorizedId}`);
    return { ok: true, receipt };
  }

  // --- DIRECTIVO: verificación e integridad ---
  verifyChain(): { valid: boolean; brokenAt?: number; checked: number } {
    const ledger = this.state.ledger;
    for (let i = 0; i < ledger.length; i++) {
      const e = ledger[i];
      const expectedPrev = i === 0 ? "GENESIS" : ledger[i - 1].hash;
      const body = JSON.stringify({
        seq: e.seq, type: e.type, refId: e.refId, actorId: e.actorId,
        detail: e.detail, timestamp: e.timestamp, prevHash: e.prevHash,
      });
      if (e.prevHash !== expectedPrev || sha256hex(body) !== e.hash) {
        return { valid: false, brokenAt: e.seq, checked: i + 1 };
      }
    }
    return { valid: true, checked: ledger.length };
  }

  /** DEMO: altera un evento del ledger para mostrar que la cadena lo detecta. */
  tamperLedger(): boolean {
    const ledger = [...this.state.ledger];
    const idx = ledger.findIndex((e) => e.type === "pickup_validated" || e.type === "token_issued");
    if (idx < 0) return false;
    ledger[idx] = { ...ledger[idx], detail: ledger[idx].detail + " [ALTERADO]" };
    this.commit({ ledger });
    return true;
  }
}

function b64(s: string): Uint8Array {
  // local re-impl para evitar import circular del nombre
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const store = new Store();

export function useStore(): State {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

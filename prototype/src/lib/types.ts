export type TokenStatus = "active" | "consumed" | "expired" | "revoked";
export type PickupMode = "online" | "offline" | "manual";

export interface Student {
  id: string;
  name: string;
  document: string;
  classroom: string;
  emoji: string; // stand-in for photo_url (cotejo visual)
}

export interface Guardian {
  id: string;
  name: string;
  document: string;
  relation: string;
  emoji: string;
  status: "active" | "revoked";
}

export interface Guardianship {
  guardianId: string;
  studentId: string;
  role: "primary_guardian" | "authorized";
}

/** Claims que viajan firmados dentro del QR (ver docs/03). */
export interface TokenClaims {
  iss: string; // institución
  sub: string; // student_id
  act: string; // authorized_id (quién retira)
  jti: string; // id único (anti-reuso)
  iat: number; // emisión (epoch ms)
  exp: number; // vencimiento (epoch ms)
  nonce: string;
}

export interface AuthorizationToken {
  jti: string;
  claims: TokenClaims;
  qrPayload: string; // base64url(claims).base64url(sig) — lo que codifica el QR
  issuedBy: string; // guardianId
  reason?: string;
  status: TokenStatus;
}

export interface PickupReceipt {
  receiptId: string;
  tokenJti: string;
  studentId: string;
  authorizedId: string;
  validatedBy: string; // staff/teacher
  deviceId: string;
  mode: PickupMode;
  visualConfirmed: boolean;
  timestamp: number;
  prevHash: string;
  payloadHash: string;
  deviceSignature: string;
  serverSignature?: string; // co-firma al reconciliar
  pendingSync?: boolean;
}

export type AuditEventType =
  | "token_issued"
  | "pickup_validated"
  | "pickup_manual"
  | "pickup_failed"
  | "pickup_synced"
  | "double_use_detected"
  | "dispute_opened"
  | "dispute_resolved"
  | "guardian_revoked"
  | "guardian_restored"
  | "device_revoked";

export interface AuditEvent {
  seq: number;
  type: AuditEventType;
  refId: string;
  actorId: string;
  detail: string;
  timestamp: number;
  prevHash: string;
  hash: string;
}

export interface Incident {
  id: string;
  type: "double_use" | "dispute" | "offline_conflict";
  refReceiptId: string;
  status: "open" | "resolved";
  detail: string;
  resolution?: string;
  timestamp: number;
}

export interface Settings {
  ttlSeconds: number;
  clockSkewSeconds: number;
  deviceOnline: boolean; // toggle del dispositivo docente (online/offline)
}

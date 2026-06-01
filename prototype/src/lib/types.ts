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

export type Role = "family" | "teacher" | "director";

export interface User {
  username: string;
  password: string; // demo: en producción nunca en claro (hash + backend)
  role: Role;
  name: string;
  guardianId?: string; // si role=family
  teacherId?: string; // si role=teacher
}

export interface Notification {
  id: string;
  audienceRole?: Role; // destinatario por rol (p. ej. comunicado a familias)
  audienceUser?: string; // destinatario puntual (username)
  kind: "pickup" | "announcement" | "alert" | "message" | "agenda";
  title: string;
  body: string;
  timestamp: number;
  readBy: string[]; // usernames que ya la leyeron
}

// --- Mensajería bidireccional familia ↔ colegio ---
export type MessageCategory = "absence" | "permission" | "general";

export interface ConvMessage {
  from: string; // username
  fromName: string;
  body: string;
  ts: number;
}

export interface Conversation {
  id: string;
  familyUser: string; // dueño del hilo (lado familia)
  studentId?: string;
  category: MessageCategory;
  subject: string;
  messages: ConvMessage[];
  status: "open" | "answered" | "closed";
  updatedAt: number;
  readBy: string[]; // usernames que leyeron el último estado
}

// --- Agenda interactiva vinculada ---
export type AgendaType = "reunion" | "acto" | "examen" | "feriado" | "salida" | "otro";
export type RsvpValue = "yes" | "no" | "maybe";

export interface AgendaEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time?: string;
  type: AgendaType;
  audienceRole: "family" | "teacher" | "all";
  createdBy: string;
  rsvps: Record<string, RsvpValue>;
}

export interface NotifPrefs {
  pickup: boolean;
  message: boolean;
  agenda: boolean;
  announcement: boolean;
}

import { useSyncExternalStore } from "react";
import {
  generateKeyPair, keyPairFromSeed, sign, verify, sha256hex, encodeJson, ulid, type KeyPair,
} from "./crypto";
import type {
  AuthorizationToken, TokenClaims, PickupReceipt, AuditEvent, Incident,
  Settings, AuditEventType, TokenStatus, Notification, User,
  Conversation, MessageCategory, AgendaEvent, AgendaType, RsvpValue, NotifPrefs,
  Guardian, Guardianship, Sala, Turno,
} from "./types";
import { INSTITUTION, DEVICE_ID, USERS, STUDENTS, GUARDIANS, GUARDIANSHIPS, SALAS, STUDENT_SALA, TEACHER_TASKS, DEMO_ACCOUNTS, type DemoAccount } from "./seed";
import { SYNC_ENABLED, pullShared, pushShared } from "./sync";
import * as auth from "./auth";
import type { AuthSession, Profile } from "./auth";

interface State {
  institutionKey: KeyPair;
  deviceKey: KeyPair;
  tokens: AuthorizationToken[];
  receipts: PickupReceipt[];
  ledger: AuditEvent[];
  incidents: Incident[];
  settings: Settings;
  consumedLocally: string[]; // jti consumidos en el dispositivo (anti-reuso offline)
  consumedJtis: string[]; // jti efectivamente retirados (compartido entre dispositivos)
  revokedGuardians: string[]; // lista de revocación (cacheable offline)
  authStatus: "loading" | "anon" | "authed"; // estado de la sesión (local)
  authUser: User | null; // usuario autenticado (local)
  notifications: Notification[];
  conversations: Conversation[];
  agenda: AgendaEvent[];
  pushEnabled: boolean;
  notifPrefs: NotifPrefs;
  customGuardians: Guardian[]; // autorizados dados de alta por las familias
  customGuardianships: Guardianship[];
  // --- Administración del establecimiento (editable por Dirección) ---
  salas: Sala[];
  studentSala: Record<string, string>; // studentId → salaId
  teacherTasks: Record<string, string>; // teacherId → tareas
  syncStatus: "off" | "connecting" | "ok" | "error"; // estado de la nube (local)
  syncDetail: string; // detalle del error de sync (local)
}

const LS_KEY = "eduplop-state-v3";

// Campos que se COMPARTEN entre dispositivos (vía Supabase). El resto
// (sesión, llaves, anti-reuso local, prefs de push) son por dispositivo.
const SHARED_KEYS: (keyof State)[] = [
  "tokens", "receipts", "ledger", "incidents", "settings", "revokedGuardians",
  "consumedJtis", "notifications", "conversations", "agenda", "customGuardians",
  "customGuardianships", "salas", "studentSala", "teacherTasks",
];

function pickShared(s: State): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SHARED_KEYS) out[k] = s[k];
  return out;
}

// --- Fusión de estado compartido (evita perder datos al sincronizar) ---
function unionBy<T>(a: T[], b: T[], key: (x: T) => string, prefer?: (x: T, y: T) => T): T[] {
  const map = new Map<string, T>();
  for (const it of a ?? []) map.set(key(it), it);
  for (const it of b ?? []) {
    const k = key(it);
    const ex = map.get(k);
    map.set(k, ex && prefer ? prefer(ex, it) : it);
  }
  return [...map.values()];
}
function uniq(a: string[] = [], b: string[] = []): string[] { return [...new Set([...a, ...b])]; }

const STATUS_RANK: Record<string, number> = { active: 0, scheduled: 0, expired: 1, revoked: 2, consumed: 3 };

/** Fusiona dos estados compartidos (uniones por id, prefiriendo lo "más avanzado"). */
function mergeShared(a: Partial<State>, b: Partial<State>): Record<string, unknown> {
  const tokens = unionBy(a.tokens ?? [], b.tokens ?? [], (t) => t.jti,
    (x, y) => (STATUS_RANK[y.status] ?? 0) >= (STATUS_RANK[x.status] ?? 0) ? y : x);
  const receipts = unionBy(a.receipts ?? [], b.receipts ?? [], (r) => r.receiptId,
    (x, y) => (x.pendingSync && !y.pendingSync ? y : x));
  const ledger = unionBy(a.ledger ?? [], b.ledger ?? [], (e) => e.hash).sort((x, y) => x.seq - y.seq);
  const incidents = unionBy(a.incidents ?? [], b.incidents ?? [], (i) => i.id,
    (x, y) => (y.status === "resolved" ? y : x));
  const notifications = unionBy(a.notifications ?? [], b.notifications ?? [], (n) => n.id,
    (x, y) => ({ ...y, readBy: uniq(x.readBy, y.readBy) }));
  const conversations = unionBy(a.conversations ?? [], b.conversations ?? [], (c) => c.id,
    (x, y) => (y.updatedAt >= x.updatedAt ? y : x));
  const agenda = unionBy(a.agenda ?? [], b.agenda ?? [], (e) => e.id);
  const customGuardians = unionBy(a.customGuardians ?? [], b.customGuardians ?? [], (g) => g.id,
    (x, y) => (y.photo ? y : x)); // preferimos la versión que trae foto
  const customGuardianships = unionBy(a.customGuardianships ?? [], b.customGuardianships ?? [],
    (g) => `${g.guardianId}|${g.studentId}`);
  const salas = unionBy(a.salas ?? [], b.salas ?? [], (s) => s.id);
  return {
    tokens, receipts, ledger, incidents, notifications, conversations, agenda,
    customGuardians, customGuardianships, salas,
    revokedGuardians: uniq(a.revokedGuardians, b.revokedGuardians),
    consumedJtis: uniq(a.consumedJtis, b.consumedJtis),
    settings: { ...(a.settings ?? {}), ...(b.settings ?? {}) },
    studentSala: { ...(a.studentSala ?? {}), ...(b.studentSala ?? {}) },
    teacherTasks: { ...(a.teacherTasks ?? {}), ...(b.teacherTasks ?? {}) },
  };
}

// Llave de institución FIJA (compartida por todos los dispositivos) para que
// un pase firmado en un teléfono se verifique en cualquier otro. En producción
// la privada estaría en el servidor; en este prototipo es una semilla constante.
const INSTITUTION_SEED = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const INSTITUTION_KEY = keyPairFromSeed(INSTITUTION_SEED);

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const CATEGORY_LABEL: Record<MessageCategory, string> = {
  absence: "Justificar ausencia",
  permission: "Pedido de permiso",
  general: "Consulta general",
};

// Persistencia tolerante a fallos: localStorage puede estar bloqueado en file://
const safeStorage = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* in-memory only */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

function freshState(): State {
  return {
    institutionKey: INSTITUTION_KEY,
    deviceKey: generateKeyPair(),
    tokens: [],
    receipts: [],
    ledger: [],
    incidents: [],
    settings: { ttlSeconds: 300, clockSkewSeconds: 30, deviceOnline: true },
    consumedLocally: [],
    consumedJtis: [],
    revokedGuardians: [],
    authStatus: SYNC_ENABLED ? "loading" : "anon",
    authUser: null,
    notifications: [
      {
        id: "n_welcome", audienceRole: "family", kind: "announcement",
        title: "¡Bienvenidos al Hub de EduPlop!",
        body: "Desde acá podés autorizar retiros, recibir avisos del colegio y ver la actividad de tus hijos/as.",
        timestamp: Date.now() - 86400000, readBy: [],
      },
      {
        id: "n_reunion", audienceRole: "family", kind: "announcement",
        title: "Reunión de padres — jueves 18:00",
        body: "Los esperamos en el SUM para la reunión del primer trimestre. ¡No falten!",
        timestamp: Date.now() - 3600000, readBy: [],
      },
    ],
    conversations: [
      {
        id: "c_seed", familyUser: "familia", studentId: "stu_001", category: "general",
        subject: "Consulta sobre la merienda",
        messages: [
          { from: "familia", fromName: "Laura Fernández", body: "Hola, ¿Mía puede llevar su propia merienda?", ts: Date.now() - 7200000 },
          { from: "direccion", fromName: "Dirección", body: "¡Hola Laura! Sí, sin problema. Evitá frutos secos por alergias en la sala. 🙂", ts: Date.now() - 5400000 },
        ],
        status: "answered", updatedAt: Date.now() - 5400000, readBy: ["familia", "direccion"],
      },
    ],
    agenda: [
      { id: "a_reunion", title: "Reunión de padres", description: "Primer trimestre — Sala Verde y 1° A.", date: todayPlus(3), time: "18:00", type: "reunion", audienceRole: "family", createdBy: "direccion", rsvps: {} },
      { id: "a_acto", title: "Acto del 9 de Julio", description: "Vengan con escarapela. Patio central.", date: todayPlus(10), time: "10:00", type: "acto", audienceRole: "all", createdBy: "direccion", rsvps: {} },
      { id: "a_salida", title: "Salida didáctica al museo", description: "Traer autorización y vianda.", date: todayPlus(17), time: "09:00", type: "salida", audienceRole: "family", createdBy: "docente", rsvps: {} },
    ],
    pushEnabled: false,
    notifPrefs: { pickup: true, message: true, agenda: true, announcement: true },
    customGuardians: [],
    customGuardianships: [],
    salas: SALAS.map((s) => ({ ...s })),
    studentSala: { ...STUDENT_SALA },
    teacherTasks: { ...TEACHER_TASKS },
    syncStatus: SYNC_ENABLED ? "connecting" : "off",
    syncDetail: "",
  };
}

/**
 * Carga tolerante a esquemas viejos: fusiona el estado persistido sobre los
 * valores por defecto. Así, si un estado guardado por una versión anterior no
 * tiene algún campo (p. ej. `customGuardians`, `agenda`...), no queda
 * `undefined` y no rompe los `[...spread]` que asumen arrays. Preserva los
 * datos del usuario que sí existan.
 */
function hydrate(raw: string | null): State {
  const base = freshState();
  if (!raw) return base;
  try {
    const saved = JSON.parse(raw) as Partial<State>;
    return {
      ...base,
      ...saved,
      // La llave de institución es ahora FIJA y compartida: ignoramos cualquier
      // llave aleatoria persistida por versiones anteriores (si no, los pases
      // firmados entre dispositivos no se verificarían entre sí).
      institutionKey: base.institutionKey,
      syncStatus: base.syncStatus, // estado en vivo, no el persistido
      syncDetail: "",
      authStatus: base.authStatus, // la sesión se restaura desde los tokens
      authUser: null,
      settings: { ...base.settings, ...(saved.settings ?? {}) },
      notifPrefs: { ...base.notifPrefs, ...(saved.notifPrefs ?? {}) },
    };
  } catch {
    return base;
  }
}

class Store {
  private state: State;
  private listeners = new Set<() => void>();

  // --- sincronización entre dispositivos (Supabase) ---
  private lastSyncedAt = "";
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pulling = false;

  constructor() {
    this.state = hydrate(safeStorage.get(LS_KEY));
    if (SYNC_ENABLED) this.initSync();
    this.initAuth();
  }

  // --- React glue ---
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = () => this.state;
  private commit(next: Partial<State>) {
    this.state = { ...this.state, ...next };
    safeStorage.set(LS_KEY, JSON.stringify(this.state));
    this.listeners.forEach((l) => l());
    // Si cambió algún campo compartido, lo subimos (debounced).
    if (SYNC_ENABLED && SHARED_KEYS.some((k) => k in next)) this.schedulePush();
  }

  reset() {
    safeStorage.del(LS_KEY);
    this.state = freshState();
    this.commit({});
    if (SYNC_ENABLED) this.schedulePush();
  }

  // --- Sync helpers ---
  private setSyncStatus(s: State["syncStatus"], detail = "") {
    if (this.state.syncStatus === s && this.state.syncDetail === detail) return;
    this.state = { ...this.state, syncStatus: s, syncDetail: detail };
    this.listeners.forEach((l) => l());
  }
  private errDetail(status: number) {
    return status ? `(HTTP ${status})` : "(sin red / CORS)";
  }

  private async initSync() {
    // Fusiona lo local con lo remoto y siembra/actualiza la tabla (sin perder datos).
    const { ok, snapshot, status } = await pullShared();
    const merged = mergeShared(pickShared(this.state) as Partial<State>, (snapshot?.data ?? {}) as Partial<State>);
    this.applyMerged(merged);
    const push = await pushShared(merged);
    if (push.ok && push.updated_at) this.lastSyncedAt = push.updated_at;
    if (ok || push.ok) this.setSyncStatus("ok");
    else this.setSyncStatus("error", this.errDetail(status || push.status));
    // Polling: detecta cambios hechos en otros dispositivos.
    setInterval(() => this.poll(), 3000);
    if (typeof window !== "undefined") {
      window.addEventListener("focus", () => this.poll());
    }
  }

  /** Fuerza una sincronización inmediata (p. ej. justo antes de validar un QR,
   *  para traer la foto del autorizado recién cargada en otro dispositivo). */
  async refresh() {
    if (!SYNC_ENABLED) return;
    const { ok, snapshot, status } = await pullShared();
    this.setSyncStatus(ok ? "ok" : "error", ok ? "" : this.errDetail(status));
    if (ok && snapshot && snapshot.updated_at !== this.lastSyncedAt) {
      const merged = mergeShared(pickShared(this.state) as Partial<State>, snapshot.data as Partial<State>);
      this.applyMerged(merged);
      this.lastSyncedAt = snapshot.updated_at;
    }
  }

  private async poll() {
    if (!SYNC_ENABLED || this.pulling) return;
    // No sondear si la pestaña está oculta (ahorra red/batería); al volver el
    // foco, el listener de "focus" dispara una sincronización inmediata.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    this.pulling = true;
    try {
      const { ok, snapshot, status } = await pullShared();
      this.setSyncStatus(ok ? "ok" : "error", ok ? "" : this.errDetail(status));
      if (ok && snapshot && snapshot.updated_at !== this.lastSyncedAt) {
        const merged = mergeShared(pickShared(this.state) as Partial<State>, snapshot.data as Partial<State>);
        this.applyMerged(merged);
        this.lastSyncedAt = snapshot.updated_at;
      }
    } finally {
      this.pulling = false;
    }
  }

  /** Aplica el estado compartido fusionado preservando los campos locales. */
  private applyMerged(data: Record<string, unknown>) {
    const shared: Partial<State> = {};
    for (const k of SHARED_KEYS) {
      if (k in data) (shared as Record<string, unknown>)[k] = data[k];
    }
    this.state = { ...this.state, ...shared };
    safeStorage.set(LS_KEY, JSON.stringify(this.state));
    this.listeners.forEach((l) => l());
  }

  private schedulePush() {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(async () => {
      // Antes de subir, fusionamos con lo último remoto para no pisar cambios ajenos.
      const { snapshot } = await pullShared();
      const merged = mergeShared((snapshot?.data ?? {}) as Partial<State>, pickShared(this.state) as Partial<State>);
      this.applyMerged(merged);
      const push = await pushShared(merged);
      if (push.ok && push.updated_at) this.lastSyncedAt = push.updated_at;
      this.setSyncStatus(push.ok ? "ok" : "error");
    }, 600);
  }

  get institutionPub() { return this.state.institutionKey.pub; }

  // --- AUTENTICACIÓN ---
  currentUser(): User | null { return this.state.authUser; }
  private setAuth(status: State["authStatus"], user: User | null) {
    this.state = { ...this.state, authStatus: status, authUser: user };
    safeStorage.set(LS_KEY, JSON.stringify(this.state));
    this.listeners.forEach((l) => l());
  }
  private profileToUser(p: Profile): User {
    return {
      username: p.email ?? p.id, password: "",
      role: (p.role as User["role"]) ?? "family",
      name: p.name ?? p.email ?? "Usuario",
      guardianId: p.guardian_id ?? undefined,
      teacherId: p.teacher_id ?? undefined,
    };
  }

  /** Restaura la sesión al iniciar (Supabase Auth). */
  private async initAuth() {
    if (!SYNC_ENABLED) { this.setAuth("anon", null); return; }
    let session = auth.loadStoredSession();
    if (!session) { this.setAuth("anon", null); return; }
    // valida el access token; si venció, intenta refrescar
    let ok = await auth.getAuthUser(session.access_token);
    if (!ok) {
      const refreshed = await auth.refreshSession(session.refresh_token);
      if (refreshed) { session = refreshed; auth.storeSession(session); ok = refreshed.user; }
    }
    if (!ok) { auth.storeSession(null); this.setAuth("anon", null); return; }
    const profile = await auth.getProfile(session);
    if (!profile) { this.setAuth("anon", null); return; }
    this.setAuth("authed", this.profileToUser(profile));
  }

  /** Login con email + contraseña (cuentas creadas por la escuela). */
  async loginWithPassword(email: string, password: string): Promise<{ ok: boolean; reason?: string }> {
    if (!SYNC_ENABLED) {
      // Fallback sin Supabase: cuentas demo locales (por usuario o email).
      const u = USERS.find((x) => x.username === email.trim().toLowerCase().split("@")[0] && x.password === password);
      if (!u) return { ok: false, reason: "Usuario o contraseña incorrectos" };
      this.setAuth("authed", u);
      return { ok: true };
    }
    const { session, error } = await auth.signIn(email.trim().toLowerCase(), password);
    if (!session) return { ok: false, reason: error ?? "No se pudo iniciar sesión" };
    auth.storeSession(session);
    const profile = await auth.getProfile(session);
    if (!profile) return { ok: false, reason: "Tu cuenta no tiene un perfil asignado. Contactá a la escuela." };
    this.setAuth("authed", this.profileToUser(profile));
    return { ok: true };
  }

  /** Entra con una cuenta demo: la autoaprovisiona (signup + perfil) la primera vez. */
  async loginDemo(acc: DemoAccount): Promise<{ ok: boolean; reason?: string }> {
    if (!SYNC_ENABLED) {
      this.setAuth("authed", { username: acc.email, password: "", role: acc.role, name: acc.name, guardianId: acc.guardianId, teacherId: acc.teacherId });
      return { ok: true };
    }
    let session: AuthSession | undefined = (await auth.signIn(acc.email, acc.password)).session;
    if (!session) session = (await auth.signUp(acc.email, acc.password)).session; // primera vez
    if (!session) {
      // si el signup falló por existir, reintenta login
      session = (await auth.signIn(acc.email, acc.password)).session;
    }
    if (!session) return { ok: false, reason: "No se pudo crear/iniciar la cuenta demo. Revisá la config de Supabase Auth." };
    auth.storeSession(session);
    let profile = await auth.getProfile(session);
    if (!profile) {
      profile = await auth.upsertProfile(session, {
        email: acc.email, name: acc.name, role: acc.role,
        guardian_id: acc.guardianId ?? null, teacher_id: acc.teacherId ?? null,
      });
    }
    this.setAuth("authed", profile ? this.profileToUser(profile)
      : { username: acc.email, password: "", role: acc.role, name: acc.name, guardianId: acc.guardianId, teacherId: acc.teacherId });
    return { ok: true };
  }

  async logout() {
    const s = auth.loadStoredSession();
    if (s) await auth.signOut(s.access_token);
    auth.storeSession(null);
    this.setAuth("anon", null);
  }

  // --- NOTIFICACIONES / COMUNICACIÓN ---
  private pushNotification(n: Omit<Notification, "id" | "timestamp" | "readBy">) {
    const notif: Notification = { ...n, id: ulid("N_"), timestamp: Date.now(), readBy: [] };
    this.commit({ notifications: [notif, ...this.state.notifications] });
    this.maybePush(n.kind, n.title, n.body);
    return notif;
  }

  // --- PUSH (Web Notifications API) ---
  async requestPush(): Promise<boolean> {
    try {
      if (!("Notification" in window)) return false;
      const perm = await Notification.requestPermission();
      const ok = perm === "granted";
      this.commit({ pushEnabled: ok });
      if (ok) this.maybePush("announcement", "Notificaciones activadas ✅", "Vas a recibir avisos de EduPlop en este dispositivo.");
      return ok;
    } catch { return false; }
  }
  setPushEnabled(v: boolean) { this.commit({ pushEnabled: v }); }
  setNotifPref(kind: keyof NotifPrefs, v: boolean) {
    this.commit({ notifPrefs: { ...this.state.notifPrefs, [kind]: v } });
  }
  private maybePush(kind: Notification["kind"], title: string, body: string) {
    try {
      const prefKey = (kind === "alert" ? "announcement" : kind) as keyof NotifPrefs;
      if (!this.state.pushEnabled || !this.state.notifPrefs[prefKey]) return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      new Notification(title, { body, icon: undefined, tag: ulid() });
    } catch { /* noop */ }
  }
  sendAnnouncement(audienceRole: "family" | "teacher", title: string, body: string) {
    this.pushNotification({ audienceRole, kind: "announcement", title, body });
  }
  notificationsFor(user: User | null): Notification[] {
    if (!user) return [];
    return this.state.notifications.filter(
      (n) => (n.audienceRole && n.audienceRole === user.role) || n.audienceUser === user.username
    );
  }
  unreadCountFor(user: User | null): number {
    if (!user) return 0;
    return this.notificationsFor(user).filter((n) => !n.readBy.includes(user.username)).length;
  }
  markAllRead(user: User | null) {
    if (!user) return;
    this.commit({
      notifications: this.state.notifications.map((n) =>
        n.readBy.includes(user.username) ? n : { ...n, readBy: [...n.readBy, user.username] }),
    });
  }

  // --- AUTORIZADOS (seed + altas de familias) ---
  guardians(): Guardian[] { return [...GUARDIANS, ...this.state.customGuardians]; }
  guardianships(): Guardianship[] { return [...GUARDIANSHIPS, ...this.state.customGuardianships]; }
  guardianById(id: string): Guardian | undefined { return this.guardians().find((g) => g.id === id); }
  /**
   * Resuelve la persona autorizada de un pase: primero busca localmente; si no
   * está (p. ej. la cargó la familia en otro dispositivo), la reconstruye con
   * los datos embebidos en el pase firmado.
   */
  resolveActor(claims: TokenClaims): Guardian | undefined {
    const local = this.guardianById(claims.act);
    if (local) return local;
    if (claims.act_name) {
      return {
        id: claims.act,
        name: claims.act_name,
        document: claims.act_doc ?? "",
        relation: claims.act_rel ?? "Autorizado",
        emoji: claims.act_emoji ?? "🧑",
        photo: claims.act_photo,
        status: "active",
      };
    }
    return undefined;
  }
  authorizedFor(studentId: string): Guardian[] {
    const ids = this.guardianships().filter((g) => g.studentId === studentId).map((g) => g.guardianId);
    return this.guardians().filter((g) => ids.includes(g.id));
  }
  /** Alta de un autorizado por parte de la familia (nombre, DNI, foto opcional). */
  addAuthorized(input: { name: string; document: string; relation: string; photo?: string; studentId: string }): Guardian {
    const g: Guardian = {
      id: ulid("guar_"), name: input.name.trim(), document: input.document.trim(),
      relation: input.relation.trim() || "Autorizado", emoji: "🧑", photo: input.photo, status: "active",
    };
    this.commit({
      customGuardians: [...this.state.customGuardians, g],
      customGuardianships: [...this.state.customGuardianships, { guardianId: g.id, studentId: input.studentId, role: "authorized" }],
    });
    return g;
  }

  /** Avisa a la familia (tutor principal) que su hijo/a fue retirado. */
  private notifyFamilyOfPickup(studentId: string, authorizedId: string, mode: string) {
    const link = this.guardianships().find((g) => g.studentId === studentId && g.role === "primary_guardian");
    const famUser = USERS.find((u) => u.role === "family" && u.guardianId === link?.guardianId);
    const student = STUDENTS.find((s) => s.id === studentId);
    const who = this.guardianById(authorizedId);
    const target = famUser ? { audienceUser: famUser.username } : { audienceRole: "family" as const };
    const now = new Date();
    const fecha = now.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const hora = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const modoTxt = mode === "online" ? "validación en línea"
      : mode === "offline" ? "validación diferida (sin conexión)"
      : "registro manual (contingencia)";
    this.pushNotification({
      ...target, kind: "pickup",
      title: `Retiro confirmado — ${student?.name ?? "su hijo/a"}`,
      body: `Se registró el retiro de ${student?.name ?? "su hijo/a"} por ${who?.name ?? "la persona autorizada"} el ${fecha} a las ${hora} hs en el acceso del establecimiento (${modoTxt}).`,
    });
  }

  // --- ADMINISTRACIÓN DEL ESTABLECIMIENTO (Dirección) ---
  salas(): Sala[] { return this.state.salas; }
  salaById(id: string): Sala | undefined { return this.state.salas.find((s) => s.id === id); }
  /** Sala asignada a un alumno (o la de su classroom semilla como respaldo). */
  salaOfStudent(studentId: string): Sala | undefined {
    const id = this.state.studentSala[studentId];
    return id ? this.salaById(id) : undefined;
  }
  /** Nombre de sala/curso de un alumno para mostrar (admin tiene prioridad). */
  studentClassroom(studentId: string): string {
    return this.salaOfStudent(studentId)?.name
      ?? STUDENTS.find((s) => s.id === studentId)?.classroom
      ?? "—";
  }
  salaOfTeacher(teacherId: string): Sala | undefined {
    return this.state.salas.find((s) => s.teacherId === teacherId);
  }
  studentsOfSala(salaId: string): typeof STUDENTS {
    return STUDENTS.filter((s) => this.state.studentSala[s.id] === salaId);
  }
  teacherTasksOf(teacherId: string): string { return this.state.teacherTasks[teacherId] ?? ""; }

  private isDirector() { return this.currentUser()?.role === "director"; }
  addSala(name: string, turno: Turno) {
    if (!this.isDirector() || !name.trim()) return;
    this.commit({ salas: [...this.state.salas, { id: ulid("sala_"), name: name.trim(), turno }] });
  }
  updateSala(id: string, patch: Partial<Omit<Sala, "id">>) {
    if (!this.isDirector()) return;
    this.commit({ salas: this.state.salas.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }
  deleteSala(id: string) {
    if (!this.isDirector()) return;
    this.commit({ salas: this.state.salas.filter((s) => s.id !== id) });
  }
  assignStudentSala(studentId: string, salaId: string) {
    if (!this.isDirector()) return;
    this.commit({ studentSala: { ...this.state.studentSala, [studentId]: salaId } });
  }
  setTeacherTasks(teacherId: string, tareas: string) {
    if (!this.isDirector()) return;
    this.commit({ teacherTasks: { ...this.state.teacherTasks, [teacherId]: tareas } });
  }

  // --- MENSAJERÍA bidireccional ---
  startConversation(category: MessageCategory, subject: string, body: string, studentId?: string): Conversation | null {
    const u = this.currentUser();
    if (!u) return null;
    const conv: Conversation = {
      id: ulid("CONV_"), familyUser: u.username, studentId, category, subject,
      messages: [{ from: u.username, fromName: u.name, body, ts: Date.now() }],
      status: "open", updatedAt: Date.now(), readBy: [u.username],
    };
    this.commit({ conversations: [conv, ...this.state.conversations] });
    // avisar al colegio
    this.pushNotification({
      audienceRole: "director", kind: "message",
      title: `💬 Nuevo mensaje de ${u.name}`,
      body: `${CATEGORY_LABEL[category]}: ${subject}`,
    });
    return conv;
  }
  replyConversation(id: string, body: string) {
    const u = this.currentUser();
    if (!u) return;
    const fromSchool = u.role !== "family";
    this.commit({
      conversations: this.state.conversations.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          messages: [...c.messages, { from: u.username, fromName: u.name, body, ts: Date.now() }],
          status: fromSchool ? "answered" : "open",
          updatedAt: Date.now(),
          readBy: [u.username],
        };
      }),
    });
    const conv = this.state.conversations.find((c) => c.id === id);
    if (fromSchool && conv) {
      this.pushNotification({
        audienceUser: conv.familyUser, kind: "message",
        title: `💬 Respuesta del colegio`,
        body: `${conv.subject}: ${body.slice(0, 60)}`,
      });
    } else if (conv) {
      this.pushNotification({
        audienceRole: "director", kind: "message",
        title: `💬 ${u.name} respondió`,
        body: `${conv.subject}: ${body.slice(0, 60)}`,
      });
    }
  }
  conversationsFor(user: User | null): Conversation[] {
    if (!user) return [];
    const list = user.role === "family"
      ? this.state.conversations.filter((c) => c.familyUser === user.username)
      : this.state.conversations; // colegio ve todas
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // --- AGENDA interactiva ---
  addAgendaEvent(e: Omit<AgendaEvent, "id" | "rsvps" | "createdBy">) {
    const u = this.currentUser();
    const ev: AgendaEvent = { ...e, id: ulid("AG_"), createdBy: u?.username ?? "colegio", rsvps: {} };
    this.commit({ agenda: [...this.state.agenda, ev] });
    const audience = e.audienceRole === "teacher" ? "teacher" : "family";
    this.pushNotification({
      audienceRole: audience, kind: "agenda",
      title: `📅 Nuevo evento: ${e.title}`,
      body: `${e.date}${e.time ? " " + e.time : ""} — ${e.description}`,
    });
  }
  /** Edita un evento existente (docentes y dirección). Conserva id, autor y RSVPs. */
  updateAgendaEvent(id: string, patch: Partial<Omit<AgendaEvent, "id" | "rsvps" | "createdBy">>) {
    const u = this.currentUser();
    if (!u || u.role === "family") return; // solo colegio
    let updated: AgendaEvent | undefined;
    this.commit({
      agenda: this.state.agenda.map((e) => {
        if (e.id !== id) return e;
        updated = { ...e, ...patch };
        return updated;
      }),
    });
    if (updated) {
      const audience = updated.audienceRole === "teacher" ? "teacher" : "family";
      this.pushNotification({
        audienceRole: audience, kind: "agenda",
        title: `✏️ Evento actualizado: ${updated.title}`,
        body: `${updated.date}${updated.time ? " " + updated.time : ""} — ${updated.description}`,
      });
    }
  }
  /** Elimina un evento (docentes y dirección). */
  deleteAgendaEvent(id: string) {
    const u = this.currentUser();
    if (!u || u.role === "family") return; // solo colegio
    this.commit({ agenda: this.state.agenda.filter((e) => e.id !== id) });
  }
  agendaFor(user: User | null): AgendaEvent[] {
    if (!user) return [];
    const list = user.role === "family"
      ? this.state.agenda.filter((e) => e.audienceRole === "family" || e.audienceRole === "all")
      : this.state.agenda;
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  }
  rsvp(eventId: string, value: RsvpValue) {
    const u = this.currentUser();
    if (!u) return;
    this.commit({
      agenda: this.state.agenda.map((e) =>
        e.id === eventId ? { ...e, rsvps: { ...e.rsvps, [u.username]: value } } : e),
    });
  }

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
  // scheduleAt: epoch ms del retiro programado. Si se omite, es "express" (válido desde ya).
  issueToken(studentId: string, authorizedId: string, issuedBy: string, reason: string, scheduleAt?: number) {
    const now = Date.now();
    const scheduled = typeof scheduleAt === "number" && scheduleAt > now + 60000;
    // ventana de validez alrededor de la hora programada (±)
    const windowMs = 30 * 60 * 1000; // 30 min después de la hora indicada
    const preMs = 15 * 60 * 1000; // se habilita 15 min antes
    const nbf = scheduled ? scheduleAt - preMs : now;
    const exp = scheduled ? scheduleAt + windowMs : now + this.state.settings.ttlSeconds * 1000;
    // Embebemos solo TEXTO de la persona autorizada (nombre, DNI, vínculo,
    // emoji) para que el QR siga siendo liviano y escaneable. La FOTO ya no va
    // en el QR (haría el código demasiado denso): viaja por la sincronización
    // (customGuardians) y el docente la ve vía resolveActor.
    const actor = this.guardianById(authorizedId);
    const claims: TokenClaims = {
      iss: INSTITUTION.id,
      sub: studentId,
      act: authorizedId,
      jti: ulid("JTI_"),
      iat: now,
      nbf,
      exp,
      nonce: ulid(),
      act_name: actor?.name,
      act_doc: actor?.document,
      act_rel: actor?.relation,
      act_emoji: actor?.emoji,
    };
    const encoded = encodeJson(claims);
    const sig = sign(encoded, this.state.institutionKey.priv);
    const qrPayload = `v4.public.${encoded}.${sig}`;
    const token: AuthorizationToken = {
      jti: claims.jti, claims, qrPayload, issuedBy, reason, status: "active",
    };
    this.commit({ tokens: [token, ...this.state.tokens] });
    this.appendAudit("token_issued", claims.jti, issuedBy,
      `QR ${scheduled ? "programado" : "express"} para ${studentId} → retira ${authorizedId}`);
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

  /** Estado efectivo de un token, considerando TTL y programación. */
  effectiveStatus(t: AuthorizationToken): TokenStatus {
    // Retiro confirmado en cualquier dispositivo (set compartido): aunque el
    // token local siga "active", si su jti fue consumido, mostramos "consumed".
    if (this.state.consumedJtis.includes(t.jti)) return "consumed";
    if (t.status !== "active") return t.status;
    const now = Date.now();
    if (now > t.claims.exp) return "expired";
    if (t.claims.nbf && now < t.claims.nbf) return "scheduled";
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
    const now = Date.now();
    if (now > claims.exp + skew) return { ok: false, reason: "QR vencido (TTL superado)", claims };
    if (claims.nbf && now < claims.nbf - skew) {
      const when = new Date(claims.nbf).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      return { ok: false, reason: `Pase programado: aún no está activo (se habilita ${when})`, claims };
    }
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
        consumedJtis: [...this.state.consumedJtis, claims.jti],
      });
      this.setTokenStatus(claims.jti, "consumed");
      this.appendAudit("pickup_validated", receipt.receiptId, teacherId,
        `Salida ONLINE: ${claims.sub} retirado por ${claims.act}`);
      this.notifyFamilyOfPickup(claims.sub, claims.act, "online");
    } else {
      // offline: encolar, firmar solo con dispositivo, NO marcar consumido en servidor
      receipt = { ...receiptCore, payloadHash, deviceSignature, pendingSync: true };
      this.commit({
        receipts: [receipt, ...this.state.receipts],
        consumedLocally: [...this.state.consumedLocally, claims.jti],
        consumedJtis: [...this.state.consumedJtis, claims.jti],
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
        this.notifyFamilyOfPickup(r.studentId, r.authorizedId, "offline");
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
    this.notifyFamilyOfPickup(studentId, authorizedId, "manual");
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

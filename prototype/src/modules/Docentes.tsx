import { useMemo, useState } from "react";
import { store, useStore } from "../lib/store";
import { STUDENTS, TEACHERS } from "../lib/seed";
import { QrScanner } from "../components/QrScanner";
import { Avatar } from "../components/Avatar";
import { playSuccess, playError } from "../lib/sound";
import { Messages } from "../components/Messages";
import { Agenda } from "../components/Agenda";
import { SectionNav, type SectionDef } from "../components/SectionNav";

const VIEWS: SectionDef[] = [
  { key: "puerta", label: "Puerta / Aula", icon: "🚪" },
  { key: "manual", label: "Registro manual", icon: "✍️" },
  { key: "salidas", label: "Salidas de hoy", icon: "📋" },
  { key: "agenda", label: "Agenda", icon: "📅" },
  { key: "mensajes", label: "Mensajes", icon: "💬" },
];

export function Docentes() {
  const state = useStore();
  const user = store.currentUser();
  const [view, setView] = useState("puerta");
  const teacherId = user?.teacherId ?? TEACHERS[0].id;
  const teacherName = user?.name ?? TEACHERS[0].name;

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanned, setScanned] = useState<string | null>(null); // payload escaneado → abre modal
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const pending = state.receipts.filter((r) => r.pendingSync);

  // resultado de la verificación local del QR escaneado
  const verification = useMemo(() => (scanned ? store.verifyLocally(scanned) : null), [scanned]);
  const claims = verification?.claims;
  const student = claims && STUDENTS.find((s) => s.id === claims.sub);
  const authorized = claims ? store.resolveActor(claims) : undefined;

  function handleScan(payload: string) {
    setScannerOpen(false);
    const v = store.verifyLocally(payload);
    if (v.ok) playSuccess(); else playError();
    setScanned(payload); // abre el modal con el detalle
  }

  function simulate() {
    const t = state.tokens.find((x) => store.effectiveStatus(x) === "active");
    if (!t) { setScannerOpen(false); setToast({ ok: false, msg: "No hay pases activos para simular. Generá uno en Familias." }); return; }
    handleScan(t.qrPayload);
  }

  function confirmar() {
    if (!scanned) return;
    const res = store.validatePickup(scanned, teacherId, true);
    if (res.ok) playSuccess(); else playError();
    setToast(res.ok
      ? { ok: true, msg: `✅ Entrega registrada (${res.receipt?.mode}). Se avisó a la familia.` }
      : { ok: false, msg: res.reason ?? "Rechazado" });
    setScanned(null);
  }

  function sync() {
    const r = store.syncOfflineQueue();
    setToast({ ok: r.conflicts === 0, msg: `Reconciliados ${r.synced} comprobante(s). Conflictos: ${r.conflicts}.` });
  }

  // retiro manual (contingencia)
  const [mStudent, setMStudent] = useState(STUDENTS[0].id);
  const mAuthorizeds = useMemo(() => store.authorizedFor(mStudent), [mStudent, state.customGuardians]);
  const [mAuth, setMAuth] = useState(mAuthorizeds[0]?.id);
  function manual() {
    const auth = mAuth ?? mAuthorizeds[0]?.id;
    const res = store.manualPickup(mStudent, auth, teacherId);
    if (res.ok) playSuccess(); else playError();
    setToast(res.ok
      ? { ok: true, msg: `Retiro manual registrado (${res.receipt?.mode}). Se avisó a la familia.` }
      : { ok: false, msg: res.reason ?? "Rechazado" });
  }

  const announcements = store.notificationsFor(user).filter((n) => n.kind === "announcement");

  return (
    <div className="grid two">
      <SectionNav views={VIEWS} active={view} onChange={setView} />

      {view === "puerta" && <>
      <section className="card">
        <div className="row between">
          <h2>Puerta / Aula</h2>
          <label className={`switch ${state.settings.deviceOnline ? "on" : "off"}`}>
            <input type="checkbox" checked={state.settings.deviceOnline}
              onChange={(e) => store.setOnline(e.target.checked)} />
            <span>{state.settings.deviceOnline ? "🟢 Conectado" : "🔴 Sin conexión"}</span>
          </label>
        </div>
        <p className="muted">Hola <b>{teacherName}</b>. Para entregar un alumno, escaneá el pase que muestra la familia.</p>

        <button className="primary big scan-btn" onClick={() => setScannerOpen(true)}>
          📷 Escanear pase de retiro
        </button>

        {!state.settings.deviceOnline && (
          <div className="note offline-note">
            Sin conexión: igual podés validar. Verificamos el pase en el dispositivo y registramos la salida; se sincroniza al volver la señal.
          </div>
        )}

        {pending.length > 0 && (
          <div className="note sync-note">
            ⏳ {pending.length} salida(s) sin sincronizar.
            <button className="link" onClick={sync} disabled={!state.settings.deviceOnline}>
              {state.settings.deviceOnline ? "Sincronizar ahora" : "Reconectá para sincronizar"}
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>📣 Avisos</h2>
        {announcements.length === 0 && <p className="muted">Sin avisos.</p>}
        {announcements.map((a) => (
          <div key={a.id} className="aviso"><b>{a.title}</b><p className="muted small">{a.body}</p></div>
        ))}
      </section>
      </>}

      {toast && <div className={`toast span2 ${toast.ok ? "ok" : "bad"}`}>{toast.msg}</div>}

      {view === "manual" && (
      <section className="card span2">
        <h2>Registro manual (si no hay pase)</h2>
        <p className="muted small">Para casos sin QR (sin app, falla total). Queda registrado igual y se avisa a la familia.</p>
        <div className="row gap wrap">
          <div className="grow">
            <label>Alumno/a</label>
            <select value={mStudent} onChange={(e) => { setMStudent(e.target.value); setMAuth(undefined); }}>
              {STUDENTS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name} · {s.classroom}</option>)}
            </select>
          </div>
          <div className="grow">
            <label>Quién retira</label>
            <select value={mAuth ?? mAuthorizeds[0]?.id} onChange={(e) => setMAuth(e.target.value)}>
              {mAuthorizeds.map((g) => (
                <option key={g.id} value={g.id}>{g.emoji} {g.name} · {g.relation}{store.isRevoked(g.id) ? " (revocado)" : ""}</option>
              ))}
            </select>
          </div>
          <button className="ghost" onClick={manual}>Registrar retiro manual</button>
        </div>
      </section>
      )}

      {view === "salidas" && (
      <section className="card span2">
        <h2>Salidas de hoy</h2>
        <table className="tbl">
          <thead><tr><th>Alumno</th><th>Retiró</th><th>Modo</th><th>Hora</th></tr></thead>
          <tbody>
            {state.receipts.length === 0 && <tr><td colSpan={4} className="muted">Sin salidas registradas.</td></tr>}
            {state.receipts.map((r) => {
              const stu = STUDENTS.find((s) => s.id === r.studentId);
              const g = store.guardianById(r.authorizedId);
              return (
                <tr key={r.receiptId}>
                  <td>{stu?.emoji} {stu?.name}</td>
                  <td>{g?.name}</td>
                  <td><span className={`pill ${r.mode}`}>{r.mode}</span>{r.pendingSync && <span className="pill warn">pendiente</span>}</td>
                  <td>{new Date(r.timestamp).toLocaleTimeString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      )}

      {view === "agenda" && <Agenda />}
      {view === "mensajes" && <Messages />}

      {scannerOpen && (
        <QrScanner onResult={handleScan} onClose={() => setScannerOpen(false)} onSimulate={simulate} />
      )}

      {scanned && verification && (
        <div className="modal-overlay" onClick={() => setScanned(null)}>
          <div className={`modal ${verification.ok ? "ok" : "bad"}`} onClick={(e) => e.stopPropagation()}>
            {verification.ok ? (
              <>
                <div className="modal-hero ok">✅ Pase válido</div>
                <p className="modal-sub">Verificá que la persona coincida y entregá al alumno/a.</p>
                <div className="idcards">
                  <div className="idcard big">
                    <div className="avatar">{student?.emoji ?? "❓"}</div>
                    <div><small>Alumno/a</small><b>{student?.name}</b><span className="mono">Doc. {student?.document}</span><span className="muted small">{student?.classroom}</span></div>
                  </div>
                  <div className="idcard big highlight">
                    <Avatar g={authorized} size={48} />
                    <div><small>Persona autorizada a retirar</small><b>{authorized?.name}</b><span className="mono">Doc. {authorized?.document}</span><span className="muted small">{authorized?.relation}</span></div>
                  </div>
                </div>
                <div className="row gap" style={{ marginTop: 16 }}>
                  <button className="primary big" onClick={confirmar}>Confirmar entrega</button>
                  <button className="ghost" onClick={() => setScanned(null)}>Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-hero bad">⛔ Pase no válido</div>
                <p className="modal-sub">{verification.reason}</p>
                {claims && student && (
                  <p className="muted small">Correspondía a {student.emoji} {student.name}. Pedí a la familia un pase nuevo.</p>
                )}
                <button className="ghost" onClick={() => setScanned(null)} style={{ marginTop: 12 }}>Entendido</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

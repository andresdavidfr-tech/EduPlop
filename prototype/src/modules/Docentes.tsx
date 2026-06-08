import { useMemo, useState, lazy, Suspense } from "react";
import { store, useStore } from "../lib/store";
import { STUDENTS, TEACHERS } from "../lib/seed";
// El escáner arrastra ZXing (pesado): se carga solo al abrirlo.
const QrScanner = lazy(() => import("../components/QrScanner").then((m) => ({ default: m.QrScanner })));
import { Avatar } from "../components/Avatar";
import { playSuccess, playError } from "../lib/sound";
import { Messages } from "../components/Messages";
import { Agenda } from "../components/Agenda";
import { SectionNav, type SectionDef } from "../components/SectionNav";
import { SYNC_ENABLED } from "../lib/supabaseConfig";
import { downloadReceipt } from "../lib/receipt";
import { Modal } from "../ui/Modal";
import type { PickupReceipt, Guardian } from "../lib/types";

const VIEWS: SectionDef[] = [
  { key: "mensajes", label: "Mensajes", icon: "💬" },
  { key: "agenda", label: "Agenda", icon: "📅" },
  { key: "puerta", label: "Puerta / Aula", icon: "🚪" },
  { key: "salidas", label: "Salidas de hoy", icon: "📋" },
];

export function Docentes() {
  const state = useStore();
  const user = store.currentUser();
  const [view, setView] = useState("mensajes");
  const teacherId = user?.teacherId ?? TEACHERS[0].id;
  const teacherName = user?.name ?? TEACHERS[0].name;

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanned, setScanned] = useState<string | null>(null); // payload escaneado → abre modal
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmed, setConfirmed] = useState<{ receipt: PickupReceipt; actor?: Guardian; studentName?: string } | null>(null);

  const pending = state.receipts.filter((r) => r.pendingSync);

  // resultado de la verificación local del QR escaneado
  const verification = useMemo(() => (scanned ? store.verifyLocally(scanned) : null), [scanned]);
  const claims = verification?.claims;
  const student = claims && STUDENTS.find((s) => s.id === claims.sub);
  const authorized = claims ? store.resolveActor(claims) : undefined;

  async function handleScan(payload: string) {
    setScannerOpen(false);
    await store.refresh(); // traer la última info (incluida la foto del autorizado) antes de validar
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
    if (res.ok && res.receipt) {
      setConfirmed({ receipt: res.receipt, actor: authorized, studentName: student?.name });
    } else {
      setToast({ ok: false, msg: res.reason ?? "Rechazado" });
    }
    setScanned(null);
  }

  function sync() {
    const r = store.syncOfflineQueue();
    setToast({ ok: r.conflicts === 0, msg: `Reconciliados ${r.synced} comprobante(s). Conflictos: ${r.conflicts}.` });
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

        {!SYNC_ENABLED && (
          <div className="note demo-note">
            🔎 <b>Demo de un dispositivo:</b> la validación se registra en este mismo navegador. Para ver el flujo completo, generá el pase y validálo en la misma sesión (o usá “Simular” en el escáner). Sincronizar el estado entre teléfonos distintos requeriría un backend compartido.
          </div>
        )}

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
        <Suspense fallback={<div className="scanner-overlay" role="status" aria-live="polite"><div className="scanner"><span className="spinner" aria-hidden="true" /> Abriendo cámara…</div></div>}>
          <QrScanner onResult={handleScan} onClose={() => setScannerOpen(false)} onSimulate={simulate} />
        </Suspense>
      )}

      {scanned && verification && (
        <Modal label={verification.ok ? "Pase válido" : "Pase no válido"}
          className={verification.ok ? "ok" : "bad"} onClose={() => setScanned(null)}>
            {verification.ok ? (
              <>
                <div className="modal-hero ok">Pase válido</div>
                <p className="modal-sub">Control facial: compará el rostro con la persona presente y verificá los datos antes de entregar.</p>
                <div className="idcards">
                  <div className="idcard big">
                    <div className="avatar">{student?.emoji ?? "❓"}</div>
                    <div><small>Alumno/a</small><b>{student?.name}</b><span className="mono">Doc. {student?.document}</span><span className="muted small">{student ? store.studentClassroom(student.id) : ""}</span></div>
                  </div>
                  <div className="idcard big highlight facial">
                    <Avatar g={authorized} size={92} />
                    <div><small>Persona autorizada a retirar</small><b>{authorized?.name}</b><span className="mono">Doc. {authorized?.document}</span><span className="muted small">{authorized?.relation}</span></div>
                  </div>
                </div>
                {!authorized?.photo && (
                  <p className="muted small" style={{ marginTop: 8 }}>⚠️ Sin foto registrada para esta persona: verificá la identidad con documento.</p>
                )}
                <div className="row gap" style={{ marginTop: 16 }}>
                  <button className="primary big" onClick={confirmar}>Confirmar entrega</button>
                  <button className="ghost" onClick={() => setScanned(null)}>Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-hero bad">Pase no válido</div>
                <p className="modal-sub">{verification.reason}</p>
                {claims && student && (
                  <p className="muted small">Correspondía a {student.emoji} {student.name}. Pedí a la familia un pase nuevo.</p>
                )}
                <button className="ghost" onClick={() => setScanned(null)} style={{ marginTop: 12 }}>Entendido</button>
              </>
            )}
        </Modal>
      )}

      {confirmed && (
        <Modal label="Retiro registrado" className="ok" onClose={() => setConfirmed(null)}>
            <div className="modal-hero ok">Retiro registrado</div>
            <p className="modal-sub">Se confirmó el retiro de <b>{confirmed.studentName ?? "el/la estudiante"}</b> y se notificó a la familia. Comprobante <span className="mono">{confirmed.receipt.receiptId}</span>.</p>
            <div className="row gap" style={{ justifyContent: "center", marginTop: 16 }}>
              <button className="primary" onClick={() => downloadReceipt(confirmed.receipt, confirmed.actor)}>📄 Descargar comprobante</button>
              <button className="ghost" onClick={() => setConfirmed(null)}>Listo</button>
            </div>
        </Modal>
      )}
    </div>
  );
}

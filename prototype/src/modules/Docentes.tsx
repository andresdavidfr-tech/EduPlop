import { useMemo, useState } from "react";
import { store, useStore } from "../lib/store";
import { STUDENTS, GUARDIANS, GUARDIANSHIPS, TEACHERS } from "../lib/seed";

const TEACHER = TEACHERS[0]; // Doc. Pérez

export function Docentes() {
  const state = useStore();
  const [scanned, setScanned] = useState<string | null>(null);
  const [visual, setVisual] = useState(true);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const pending = state.receipts.filter((r) => r.pendingSync);

  function scanLatestActive() {
    const t = state.tokens.find((x) => store.effectiveStatus(x) === "active");
    if (!t) { setToast({ ok: false, msg: "No hay QR activos para escanear. Generá uno en Familias." }); return; }
    setScanned(t.qrPayload);
    setToast(null);
  }

  function scanSpecific(jti: string) {
    const t = state.tokens.find((x) => x.jti === jti);
    if (t) { setScanned(t.qrPayload); setToast(null); }
  }

  const verification = scanned ? store.verifyLocally(scanned) : null;
  const claims = verification?.claims;
  const student = claims && STUDENTS.find((s) => s.id === claims.sub);
  const authorized = claims && GUARDIANS.find((g) => g.id === claims.act);

  function confirmar() {
    if (!scanned) return;
    const res = store.validatePickup(scanned, TEACHER.id, visual);
    setToast(res.ok
      ? { ok: true, msg: `Salida autorizada (${res.receipt?.mode}). Comprobante ${res.receipt?.receiptId}` }
      : { ok: false, msg: res.reason ?? "Rechazado" });
    if (res.ok) setScanned(null);
  }

  function sync() {
    const r = store.syncOfflineQueue();
    setToast({ ok: r.conflicts === 0, msg: `Reconciliados ${r.synced} comprobante(s). Conflictos: ${r.conflicts}.` });
  }

  // --- retiro manual (contingencia) ---
  const [mStudent, setMStudent] = useState(STUDENTS[0].id);
  const mAuthorizeds = useMemo(() => {
    const ids = GUARDIANSHIPS.filter((g) => g.studentId === mStudent).map((g) => g.guardianId);
    return GUARDIANS.filter((g) => ids.includes(g.id));
  }, [mStudent]);
  const [mAuth, setMAuth] = useState(mAuthorizeds[0]?.id);
  function manual() {
    const auth = mAuth ?? mAuthorizeds[0]?.id;
    const res = store.manualPickup(mStudent, auth, TEACHER.id);
    setToast(res.ok
      ? { ok: true, msg: `Retiro manual registrado (${res.receipt?.mode}). Comprobante ${res.receipt?.receiptId}` }
      : { ok: false, msg: res.reason ?? "Rechazado" });
  }

  return (
    <div className="grid two">
      <section className="card">
        <div className="row between">
          <h2>Validación de salida</h2>
          <label className={`switch ${state.settings.deviceOnline ? "on" : "off"}`}>
            <input type="checkbox" checked={state.settings.deviceOnline}
              onChange={(e) => store.setOnline(e.target.checked)} />
            <span>{state.settings.deviceOnline ? "🟢 Online" : "🔴 Offline"}</span>
          </label>
        </div>
        <p className="muted">Dispositivo <b>dev_door_03</b> · valida {TEACHER.name} ({TEACHER.classroom})</p>

        <button className="primary big" onClick={scanLatestActive}>📷 Escanear último QR activo</button>

        <label className="mt">…o simular escaneo de un QR presentado</label>
        <select value="" onChange={(e) => e.target.value && scanSpecific(e.target.value)}>
          <option value="">Seleccionar un QR específico…</option>
          {state.tokens.map((t) => (
            <option key={t.jti} value={t.jti}>{t.jti} · {store.effectiveStatus(t)}</option>
          ))}
        </select>

        {!state.settings.deviceOnline && (
          <div className="note offline-note">
            Modo offline: se verifica firma + TTL localmente con la caché aprovisionada. Los comprobantes se firman y encolan.
          </div>
        )}

        {pending.length > 0 && (
          <div className="note sync-note">
            ⏳ {pending.length} comprobante(s) offline pendientes de sincronizar.
            <button className="link" onClick={sync} disabled={!state.settings.deviceOnline}>
              {state.settings.deviceOnline ? "Sincronizar ahora" : "Reconectá para sincronizar"}
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Cotejo de identidad</h2>
        {!scanned && <div className="empty">Escaneá un QR para verificar 🔍</div>}
        {scanned && verification && (
          <>
            <div className={`verdict ${verification.ok ? "ok" : "bad"}`}>
              {verification.ok ? "✅ QR válido (firma + TTL verificados localmente)" : `❌ ${verification.reason}`}
            </div>
            {claims && (
              <div className="idcards">
                <div className="idcard">
                  <div className="avatar">{student?.emoji ?? "❓"}</div>
                  <div><small>Alumno/a</small><b>{student?.name}</b><span className="mono">{student?.document}</span></div>
                </div>
                <div className="idcard">
                  <div className="avatar">{authorized?.emoji ?? "❓"}</div>
                  <div><small>Retira</small><b>{authorized?.name}</b><span className="mono">{authorized?.document}</span></div>
                </div>
              </div>
            )}
            {verification.ok && (
              <>
                <label className="check">
                  <input type="checkbox" checked={visual} onChange={(e) => setVisual(e.target.checked)} />
                  Confirmo el cotejo visual (foto + documento)
                </label>
                <button className="primary big" disabled={!visual} onClick={confirmar}>
                  Confirmo entrega
                </button>
              </>
            )}
          </>
        )}
      </section>

      {toast && (
        <div className={`toast span2 ${toast.ok ? "ok" : "bad"}`}>{toast.msg}</div>
      )}

      <section className="card span2">
        <h2>Registro manual (contingencia)</h2>
        <p className="muted small">
          Si el QR no puede generarse o escanearse (sin app, falla total), el docente registra
          la salida seleccionando un autorizado verificado. Queda marcada como excepción (<b>mode=manual</b>) y es auditable.
        </p>
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

      <section className="card span2">
        <h2>Mi bitácora de salidas</h2>
        <table className="tbl">
          <thead><tr><th>Comprobante</th><th>Alumno</th><th>Retiró</th><th>Modo</th><th>Hora</th><th>Sello</th></tr></thead>
          <tbody>
            {state.receipts.length === 0 && <tr><td colSpan={6} className="muted">Sin retiros registrados.</td></tr>}
            {state.receipts.map((r) => {
              const stu = STUDENTS.find((s) => s.id === r.studentId);
              const g = GUARDIANS.find((x) => x.id === r.authorizedId);
              return (
                <tr key={r.receiptId}>
                  <td className="mono">{r.receiptId}</td>
                  <td>{stu?.emoji} {stu?.name}</td>
                  <td>{g?.emoji} {g?.name}</td>
                  <td><span className={`pill ${r.mode}`}>{r.mode}</span>{r.pendingSync && <span className="pill warn">pendiente</span>}</td>
                  <td>{new Date(r.timestamp).toLocaleTimeString()}</td>
                  <td>{r.serverSignature ? "✍️✍️ doble" : "✍️ dispositivo"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

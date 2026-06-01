import { useState } from "react";
import { store, useStore } from "../lib/store";
import { STUDENTS, GUARDIANS } from "../lib/seed";
import { shortHash } from "../lib/crypto";

const TYPE_LABEL: Record<string, string> = {
  token_issued: "QR emitido",
  pickup_validated: "Salida validada",
  pickup_synced: "Salida reconciliada",
  pickup_failed: "Intento fallido",
  double_use_detected: "Doble uso",
  dispute_opened: "Disputa",
  device_revoked: "Dispositivo revocado",
};

export function Directivo() {
  const state = useStore();
  const [chain, setChain] = useState<{ valid: boolean; brokenAt?: number; checked: number } | null>(null);

  const validated = state.receipts.filter((r) => !r.pendingSync).length;
  const offline = state.receipts.filter((r) => r.mode === "offline").length;
  const failed = state.ledger.filter((e) => e.type === "pickup_failed").length;

  return (
    <div className="grid">
      <section className="kpis span2">
        <div className="kpi"><b>{state.receipts.length}</b><small>Retiros registrados</small></div>
        <div className="kpi"><b>{validated}</b><small>Validados</small></div>
        <div className="kpi"><b>{offline}</b><small>En modo offline</small></div>
        <div className="kpi"><b>{failed}</b><small>Intentos fallidos</small></div>
        <div className="kpi alert"><b>{state.incidents.length}</b><small>Incidentes</small></div>
      </section>

      <section className="card">
        <h2>Configuración de seguridad</h2>
        <label>TTL del QR: <b>{state.settings.ttlSeconds}s</b></label>
        <input type="range" min={10} max={300} step={5}
          value={state.settings.ttlSeconds}
          onChange={(e) => store.setTtl(Number(e.target.value))} />
        <p className="muted small">Tolerancia de reloj (skew): {state.settings.clockSkewSeconds}s.</p>
      </section>

      <section className="card">
        <h2>Integridad del libro de auditoría</h2>
        <p className="muted small">Cadena hash append-only (SHA-256). Verificá o simulá una alteración.</p>
        <div className="row gap">
          <button className="primary" onClick={() => setChain(store.verifyChain())}>Verificar integridad</button>
          <button className="ghost" onClick={() => { store.tamperLedger(); setChain(store.verifyChain()); }}>
            Simular alteración
          </button>
        </div>
        {chain && (
          <div className={`verdict ${chain.valid ? "ok" : "bad"}`}>
            {chain.valid
              ? `✅ Cadena íntegra · ${chain.checked} eventos verificados`
              : `❌ ¡Alteración detectada! Cadena rota en el evento #${chain.brokenAt}`}
          </div>
        )}
      </section>

      <section className="card span2">
        <h2>Incidentes</h2>
        {state.incidents.length === 0 && <p className="muted">Sin incidentes.</p>}
        {state.incidents.map((i) => (
          <div key={i.id} className="incident">
            <span className={`pill ${i.type}`}>{i.type}</span> {i.detail}
            <span className="mono"> · {i.id}</span>
          </div>
        ))}
      </section>

      <section className="card span2">
        <h2>Libro de auditoría (ledger encadenado)</h2>
        <table className="tbl">
          <thead><tr><th>#</th><th>Evento</th><th>Detalle</th><th>Actor</th><th>prev_hash</th><th>hash</th></tr></thead>
          <tbody>
            {state.ledger.length === 0 && <tr><td colSpan={6} className="muted">Sin eventos.</td></tr>}
            {[...state.ledger].reverse().map((e) => (
              <tr key={e.seq} className={e.detail.includes("[ALTERADO]") ? "tampered" : ""}>
                <td>{e.seq}</td>
                <td><span className={`pill ${e.type}`}>{TYPE_LABEL[e.type] ?? e.type}</span></td>
                <td>{e.detail}</td>
                <td className="mono">{e.actorId}</td>
                <td className="mono">{shortHash(e.prevHash)}</td>
                <td className="mono">{shortHash(e.hash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card span2">
        <h2>Comprobantes (gestión de disputas)</h2>
        <table className="tbl">
          <thead><tr><th>Comprobante</th><th>Alumno</th><th>Retiró</th><th>Modo</th><th>payload_hash</th><th></th></tr></thead>
          <tbody>
            {state.receipts.length === 0 && <tr><td colSpan={6} className="muted">Sin comprobantes.</td></tr>}
            {state.receipts.map((r) => {
              const stu = STUDENTS.find((s) => s.id === r.studentId);
              const g = GUARDIANS.find((x) => x.id === r.authorizedId);
              return (
                <tr key={r.receiptId}>
                  <td className="mono">{r.receiptId}</td>
                  <td>{stu?.emoji} {stu?.name}</td>
                  <td>{g?.emoji} {g?.name}</td>
                  <td><span className={`pill ${r.mode}`}>{r.mode}</span></td>
                  <td className="mono">{shortHash(r.payloadHash)}</td>
                  <td><button className="link" onClick={() => store.openDispute(r.receiptId)}>Abrir disputa</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

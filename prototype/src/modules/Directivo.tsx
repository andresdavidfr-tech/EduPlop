import { useState } from "react";
import { store, useStore } from "../lib/store";
import { shortHash } from "../lib/crypto";
import { Messages } from "../components/Messages";
import { Agenda } from "../components/Agenda";
import { Mural } from "./Mural";
import { Comunicados } from "../components/Comunicados";
import { SectionNav, type SectionDef } from "../components/SectionNav";
import { Administracion } from "../components/Administracion";
import { downloadReceipt } from "../lib/receipt";

const VIEWS: SectionDef[] = [
  { key: "resumen", label: "Resumen", icon: "📊" },
  { key: "mensajes", label: "Mensajes", icon: "💬" },
  { key: "comunicado", label: "Comunicado", icon: "📣" },
  { key: "agenda", label: "Agenda", icon: "📅" },
  { key: "administracion", label: "Administración", icon: "🗂️" },
  { key: "mural", label: "Mural", icon: "🖼️" },
  { key: "registros", label: "Auditoría", icon: "📜" },
];

const TYPE_LABEL: Record<string, string> = {
  token_issued: "QR emitido",
  pickup_validated: "Salida validada",
  pickup_manual: "Salida manual",
  pickup_synced: "Salida reconciliada",
  pickup_failed: "Intento fallido",
  double_use_detected: "Doble uso",
  dispute_opened: "Disputa abierta",
  dispute_resolved: "Disputa resuelta",
  guardian_revoked: "Autorizado revocado",
  guardian_restored: "Autorizado rehabilitado",
  device_revoked: "Dispositivo revocado",
};

export function Directivo() {
  const state = useStore();
  const students = store.students();
  const [view, setView] = useState("resumen");

  // --- Resumen del día ---
  const todayStr = new Date().toDateString();
  const retirosHoy = state.receipts.filter((r) => new Date(r.timestamp).toDateString() === todayStr);
  const porResponder = state.conversations.filter((c) => c.status === "open");
  const hoyISO = new Date().toISOString().slice(0, 10);
  const en7ISO = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const proximos = [...state.agenda].filter((e) => e.date >= hoyISO && e.date <= en7ISO).sort((a, b) => a.date.localeCompare(b.date));
  const autorizadosActivos = store.guardians().filter((g) => !state.revokedGuardians.includes(g.id)).length;
  const incidentesAbiertos = state.incidents.filter((i) => i.status === "open");
  const pasesActivos = state.tokens.filter((t) => ["active", "scheduled"].includes(store.effectiveStatus(t))).length;
  const fechaLarga = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="grid">
      <SectionNav views={VIEWS} active={view} onChange={setView} />

      {view === "resumen" && <>
      <section className="card span2">
        <div className="row between">
          <h2>Resumen del día</h2>
          <span className="muted small" style={{ textTransform: "capitalize" }}>{fechaLarga}</span>
        </div>
        {incidentesAbiertos.length > 0 && (
          <div className="note alert-note">
            ⚠️ {incidentesAbiertos.length} incidente(s) abierto(s) requieren atención.{" "}
            <button className="link" onClick={() => setView("registros")}>Ver en Auditoría →</button>
          </div>
        )}
        <div className="kpi-grid">
          <button className="kpi clickable" onClick={() => setView("mensajes")}>
            <b>{porResponder.length}</b><small>Mensajes por responder</small>
          </button>
          <div className="kpi"><b>{retirosHoy.length}</b><small>Retiros hoy</small></div>
          <button className="kpi clickable" onClick={() => setView("agenda")}>
            <b>{proximos.length}</b><small>Eventos (7 días)</small>
          </button>
          <div className="kpi"><b>{pasesActivos}</b><small>Pases activos ahora</small></div>
          <button className="kpi clickable" onClick={() => setView("autorizados")}>
            <b>{autorizadosActivos}</b><small>Autorizados activos</small>
          </button>
          <div className="kpi"><b>{students.length}</b><small>Alumnos</small></div>
        </div>
      </section>

      <section className="card">
        <h2>📨 Mensajes por responder</h2>
        {porResponder.length === 0 && <p className="muted">No hay mensajes pendientes. 🎉</p>}
        {porResponder.slice(0, 5).map((c) => (
          <div key={c.id} className="list-row">
            <div><b>{c.subject}</b><div className="muted small">{c.familyUser} · {new Date(c.updatedAt).toLocaleDateString("es-AR")}</div></div>
          </div>
        ))}
        {porResponder.length > 0 && <button className="link" onClick={() => setView("mensajes")}>Ir a Mensajes →</button>}
      </section>

      <section className="card">
        <h2>🚪 Retiros de hoy</h2>
        {retirosHoy.length === 0 && <p className="muted">Todavía no hubo retiros hoy.</p>}
        {retirosHoy.slice(0, 6).map((r) => {
          const stu = students.find((s) => s.id === r.studentId);
          const g = store.guardianById(r.authorizedId);
          return (
            <div key={r.receiptId} className="list-row">
              <div><b>{stu?.emoji} {stu?.name}</b><div className="muted small">retiró {g?.name ?? "—"} · {new Date(r.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div></div>
              <span className={`pill ${r.mode}`}>{r.mode}</span>
            </div>
          );
        })}
      </section>

      <section className="card span2">
        <h2>📅 Próximos eventos (7 días)</h2>
        {proximos.length === 0 && <p className="muted">Sin eventos en los próximos 7 días.</p>}
        {proximos.slice(0, 5).map((e) => (
          <div key={e.id} className="list-row">
            <div><b>{e.title}</b><div className="muted small">{e.description}</div></div>
            <span className="muted small" style={{ whiteSpace: "nowrap" }}>{new Date(e.date + "T00:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}{e.time ? ` · ${e.time}` : ""}</span>
          </div>
        ))}
        {proximos.length > 0 && <button className="link" onClick={() => setView("agenda")}>Ir a Agenda →</button>}
      </section>
      </>}

      {view === "comunicado" && <Comunicados />}

      {view === "agenda" && <Agenda />}
      {view === "mensajes" && <Messages />}
      {view === "mural" && <Mural />}

      {view === "administracion" && <Administracion />}

      {view === "registros" && <>
      <section className="card span2">
        <h2>Comprobantes de retiro</h2>
        <p className="muted small">Constancia de cada salida. Descargá el comprobante o abrí una disputa si corresponde.</p>
        <div className="table-scroll">
          <table className="tbl">
            <thead><tr><th>Comprobante</th><th>Alumno</th><th>Retiró</th><th>Modo</th><th></th></tr></thead>
            <tbody>
              {state.receipts.length === 0 && <tr><td colSpan={5} className="muted">Sin comprobantes.</td></tr>}
              {state.receipts.map((r) => {
                const stu = students.find((s) => s.id === r.studentId);
                const g = store.guardianById(r.authorizedId);
                return (
                  <tr key={r.receiptId}>
                    <td className="mono">{r.receiptId}</td>
                    <td>{stu?.emoji} {stu?.name}</td>
                    <td>{g?.emoji} {g?.name}</td>
                    <td><span className={`pill ${r.mode}`}>{r.mode}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="link" onClick={() => downloadReceipt(r)}>Descargar</button>
                      {" · "}
                      <button className="link" onClick={() => store.openDispute(r.receiptId)}>Disputa</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card span2">
        <h2>Incidentes</h2>
        {state.incidents.length === 0 && <p className="muted">Sin incidentes registrados.</p>}
        {state.incidents.map((i) => (
          <div key={i.id} className="incident">
            <span className={`pill ${i.type}`}>{i.type}</span>{" "}
            <span className={`pill ${i.status === "resolved" ? "active" : "warn"}`}>{i.status}</span>
            {" "}{i.detail}
            {i.resolution && <div className="muted small">↳ Resolución: {i.resolution}</div>}
            {i.status === "open" && (
              <div><button className="link" onClick={() => store.resolveIncident(i.id, "Verificado con evidencia; salida legítima")}>Resolver</button></div>
            )}
          </div>
        ))}
      </section>

      <section className="card span2">
        <h2>Libro de auditoría (cadena SHA-256)</h2>
        <p className="muted small">Registro inmutable y encadenado de todos los eventos.</p>
        <div className="table-scroll">
          <table className="tbl">
            <thead><tr><th>#</th><th>Evento</th><th>Detalle</th><th>Actor</th><th>hash</th></tr></thead>
            <tbody>
              {state.ledger.length === 0 && <tr><td colSpan={5} className="muted">Sin eventos.</td></tr>}
              {[...state.ledger].reverse().map((e) => (
                <tr key={e.seq} className={e.detail.includes("[ALTERADO]") ? "tampered" : ""}>
                  <td>{e.seq}</td>
                  <td><span className={`pill ${e.type}`}>{TYPE_LABEL[e.type] ?? e.type}</span></td>
                  <td>{e.detail}</td>
                  <td className="mono">{e.actorId}</td>
                  <td className="mono">{shortHash(e.hash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </>}
    </div>
  );
}

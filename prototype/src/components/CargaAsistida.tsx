import { useState } from "react";
import { store, useStore } from "../lib/store";
import { parseRoster, type ParsedRow } from "../lib/rosterParse";

const EXAMPLE = `Alumnos:
Mía Fernández, DNI 55.120.331, Sala Verde
Lucas Gómez 55.880.114 sala verde
Valentina Ruiz 56.001.902 1° A

Docentes:
Ana Gómez
Profe Martín Acosta`;

const KID_EMOJIS = ["🧒", "👧", "👦", "🧑", "👶"];

/**
 * Carga asistida por IA: Dirección pega una lista libre (planilla, WhatsApp…) y
 * el asistente la estructura en alumnos/docentes para revisar y dar de alta en
 * lote. El análisis es local; ninguna información sale del dispositivo.
 */
export function CargaAsistida() {
  useStore();
  const salas = store.salas();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function analizar() {
    setDone(null);
    const existingDocs = store.students().map((s) => s.document);
    setRows(parseRoster(text, salas.map((s) => ({ id: s.id, name: s.name })), existingDocs));
  }

  function update(id: string, patch: Partial<ParsedRow>) {
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null);
  }
  function remove(id: string) {
    setRows((rs) => rs?.filter((r) => r.id !== id) ?? null);
  }

  function crear() {
    if (!rows) return;
    const students = rows.filter((r) => r.type === "student" && r.name.trim());
    const teachers = rows.filter((r) => r.type === "teacher" && r.name.trim());
    const nS = store.addStudentsBulk(students.map((r) => ({ name: r.name, document: r.document, emoji: r.emoji, salaId: r.salaId || undefined })));
    const nT = store.addTeachersBulk(teachers.map((r) => r.name));
    setRows(null); setText("");
    setDone(`✓ Se dieron de alta ${nS} alumno(s) y ${nT} docente(s).`);
  }

  const nStudents = rows?.filter((r) => r.type === "student").length ?? 0;
  const nTeachers = rows?.filter((r) => r.type === "teacher").length ?? 0;

  return (
    <section className="card span2">
      <h2>🤖 Carga asistida por IA</h2>
      <p className="muted small">
        Pegá una lista de alumnos y/o docentes (de una planilla, un mensaje, lo que tengas). El asistente reconoce
        nombre, DNI y sala, separa alumnos de docentes y lo deja listo para revisar antes de dar de alta. El análisis
        es local: nada se envía afuera.
      </p>

      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={EXAMPLE}
        aria-label="Lista para analizar" />
      <div className="row gap" style={{ marginTop: 10 }}>
        <button className="primary" onClick={analizar} disabled={!text.trim()}>✨ Analizar</button>
        {text.trim() === "" && <button className="ghost" onClick={() => setText(EXAMPLE)}>Ver ejemplo</button>}
        {done && <span className="pill active">{done}</span>}
      </div>

      {rows && (
        <div className="carga-preview">
          {rows.length === 0 && <p className="muted" style={{ marginTop: 12 }}>No reconocí registros. Probá con un nombre por línea.</p>}
          {rows.length > 0 && (
            <>
              <p className="muted small" style={{ marginTop: 14 }}>Revisá y corregí lo que haga falta. Reconocí <b>{nStudents}</b> alumno(s) y <b>{nTeachers}</b> docente(s).</p>
              <div className="table-scroll">
                <table className="tbl carga-tbl">
                  <thead><tr><th>Tipo</th><th>Nombre</th><th>DNI</th><th>Sala</th><th>Avisos</th><th></th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <select value={r.type} onChange={(e) => update(r.id, { type: e.target.value as ParsedRow["type"] })} aria-label="Tipo">
                            <option value="student">🎓 Alumno/a</option>
                            <option value="teacher">🧑‍🏫 Docente</option>
                          </select>
                        </td>
                        <td>
                          <div className="row gap" style={{ gap: 6 }}>
                            {r.type === "student" && (
                              <select value={r.emoji} onChange={(e) => update(r.id, { emoji: e.target.value })} aria-label="Emoji" style={{ width: "auto" }}>
                                {KID_EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
                              </select>
                            )}
                            <input value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} aria-label="Nombre" />
                          </div>
                        </td>
                        <td>{r.type === "student"
                          ? <input value={r.document} onChange={(e) => update(r.id, { document: e.target.value })} placeholder="DNI" aria-label="DNI" style={{ minWidth: 110 }} />
                          : <span className="muted small">—</span>}</td>
                        <td>{r.type === "student"
                          ? <select value={r.salaId} onChange={(e) => update(r.id, { salaId: e.target.value })} aria-label="Sala">
                              <option value="">— Sin sala —</option>
                              {salas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          : <span className="muted small">—</span>}</td>
                        <td>{r.notes.map((n) => <span key={n} className={`pill ${n.includes("duplicado") ? "warn" : ""}`}>{n}</span>)}</td>
                        <td><button className="link danger" onClick={() => remove(r.id)} aria-label="Quitar fila">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row gap" style={{ marginTop: 12 }}>
                <button className="primary" onClick={crear} disabled={rows.length === 0}>Dar de alta {rows.length} registro(s)</button>
                <button className="ghost" onClick={() => setRows(null)}>Descartar</button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

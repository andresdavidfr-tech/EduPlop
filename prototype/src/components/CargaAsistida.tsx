import { useRef, useState } from "react";
import { store, useStore } from "../lib/store";
import { parseRoster, type ParsedRow } from "../lib/rosterParse";
import { readImportFile } from "../lib/fileImport";

const EXAMPLE = `Salas:
2° B, turno tarde

Alumnos:
Mía Fernández, DNI 55.120.331, Sala Verde
Lucas Gómez 55.880.114 sala verde
Valentina Ruiz 56.001.902 1° A

Docentes:
Ana Gómez
Profe Martín Acosta`;

const KID_EMOJIS = ["🧒", "👧", "👦", "🧑", "👶"];
const TYPE_LABEL: Record<ParsedRow["type"], string> = { student: "🎓 Alumno/a", teacher: "🧑‍🏫 Docente", sala: "🏫 Sala" };

/**
 * Carga asistida por IA: Dirección pega una lista o sube un archivo (CSV / Excel
 * / texto) con salas, alumnos y docentes; el asistente lo estructura para
 * revisar y dar de alta en lote. El análisis es local: nada se envía afuera.
 */
export function CargaAsistida() {
  useStore();
  const salas = store.salas();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function analizar(src?: string) {
    setDone(null); setErr(null);
    const existingDocs = store.students().map((s) => s.document);
    setRows(parseRoster(src ?? text, salas.map((s) => ({ id: s.id, name: s.name })), existingDocs));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true); setErr(null); setDone(null);
    try {
      const content = await readImportFile(f);
      setText(content);
      analizar(content);
    } catch {
      setErr("No pude leer el archivo. Probá con CSV, Excel (.xlsx) o texto.");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function update(id: string, patch: Partial<ParsedRow>) {
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null);
  }
  function remove(id: string) {
    setRows((rs) => rs?.filter((r) => r.id !== id) ?? null);
  }

  function crear() {
    if (!rows) return;
    const salasIn = rows.filter((r) => r.type === "sala" && r.name.trim()).map((r) => ({ name: r.name, turno: r.turno }));
    const studentsIn = rows.filter((r) => r.type === "student" && r.name.trim())
      .map((r) => ({ name: r.name, document: r.document, emoji: r.emoji, salaId: r.salaId || undefined, salaName: r.salaId ? undefined : (r.salaName || undefined) }));
    const teachersIn = rows.filter((r) => r.type === "teacher" && r.name.trim()).map((r) => ({ name: r.name }));
    const res = store.bulkImport({ salas: salasIn, students: studentsIn, teachers: teachersIn });
    setRows(null); setText("");
    setDone(`✓ Alta: ${res.salas} sala(s), ${res.students} alumno(s), ${res.teachers} docente(s).`);
  }

  const counts = rows
    ? { s: rows.filter((r) => r.type === "student").length, t: rows.filter((r) => r.type === "teacher").length, sa: rows.filter((r) => r.type === "sala").length }
    : null;

  return (
    <section className="card span2">
      <h2>🤖 Carga asistida por IA</h2>
      <p className="muted small">
        Subí un archivo (CSV, Excel o texto) o pegá una lista con salas, alumnos y docentes. El asistente reconoce
        nombre, DNI, sala y turno, separa los roles y lo deja listo para revisar antes de dar de alta. Todo se procesa
        en tu dispositivo: nada se envía afuera.
      </p>

      <div className="row gap wrap" style={{ marginBottom: 10 }}>
        <button className="ghost" onClick={() => fileRef.current?.click()} disabled={loading} aria-busy={loading}>
          {loading ? <><span className="spinner" aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-2px" }} />Leyendo…</> : "📎 Subir archivo (CSV / Excel)"}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/plain" hidden onChange={onFile} />
        <span className="muted small">o pegá el texto abajo</span>
      </div>

      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={EXAMPLE}
        aria-label="Lista para analizar" />
      <div className="row gap wrap" style={{ marginTop: 10 }}>
        <button className="primary" onClick={() => analizar()} disabled={!text.trim()}>✨ Analizar</button>
        {text.trim() === "" && <button className="ghost" onClick={() => setText(EXAMPLE)}>Ver ejemplo</button>}
        {done && <span className="pill active">{done}</span>}
        {err && <span className="pill bad">{err}</span>}
      </div>

      {rows && (
        <div className="carga-preview">
          {rows.length === 0 && <p className="muted" style={{ marginTop: 12 }}>No reconocí registros. Probá con un nombre por línea o un CSV con encabezados (nombre, dni, sala).</p>}
          {rows.length > 0 && counts && (
            <>
              <p className="muted small" style={{ marginTop: 14 }}>
                Revisá y corregí lo que haga falta. Reconocí <b>{counts.sa}</b> sala(s), <b>{counts.s}</b> alumno(s) y <b>{counts.t}</b> docente(s).
              </p>
              <div className="table-scroll">
                <table className="tbl carga-tbl">
                  <thead><tr><th>Tipo</th><th>Nombre</th><th>DNI</th><th>Sala / Turno</th><th>Avisos</th><th></th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <select value={r.type} onChange={(e) => update(r.id, { type: e.target.value as ParsedRow["type"] })} aria-label="Tipo">
                            {(["student", "teacher", "sala"] as const).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
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
                        <td>
                          {r.type === "sala" && (
                            <select value={r.turno} onChange={(e) => update(r.id, { turno: e.target.value as ParsedRow["turno"] })} aria-label="Turno">
                              <option value="mañana">Turno mañana</option>
                              <option value="tarde">Turno tarde</option>
                            </select>
                          )}
                          {r.type === "student" && (
                            <select value={r.salaId || (r.salaName ? "__new__" : "")} onChange={(e) => {
                              const v = e.target.value;
                              if (v === "__new__") update(r.id, { salaId: "" });
                              else update(r.id, { salaId: v, salaName: "" });
                            }} aria-label="Sala">
                              <option value="">— Sin sala —</option>
                              {r.salaName && <option value="__new__">➕ Crear “{r.salaName}”</option>}
                              {salas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          )}
                          {r.type === "teacher" && <span className="muted small">—</span>}
                        </td>
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

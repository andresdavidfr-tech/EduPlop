import { useRef, useState } from "react";
import { store, useStore } from "../lib/store";
import { fileToDataUrl } from "../lib/image";
import { uploadPhoto } from "../lib/storage";
import { SYNC_ENABLED } from "../lib/supabaseConfig";
import type { SchoolDoc, DocType, DocAudience } from "../lib/types";

const DOC_MAX = 20 * 1024 * 1024; // 20 MB por archivo
const DOC_TYPES: Record<DocType, { label: string; emoji: string }> = {
  boletin: { label: "Boletín", emoji: "📊" },
  autorizacion: { label: "Autorización", emoji: "✍️" },
  circular: { label: "Circular", emoji: "📋" },
  otro: { label: "Otro", emoji: "📎" },
};
const fmtDate = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "");
const fmtWhen = (ts: number) => new Date(ts).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

async function uploadDoc(f: File): Promise<{ url: string; name: string; type: string } | null> {
  const ext = (f.name.split(".").pop() || "bin").toLowerCase();
  if (SYNC_ENABLED) {
    const url = await uploadPhoto(f, `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
    if (url) return { url, name: f.name, type: f.type || "application/octet-stream" };
  }
  return { url: await fileToDataUrl(f), name: f.name, type: f.type || "application/octet-stream" };
}

async function downloadDoc(url: string, name: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  } catch { window.open(url, "_blank"); }
}

function audienceLabel(d: SchoolDoc): string {
  if (d.audience.kind === "sala") return store.salaById(d.audience.salaId ?? "")?.name ?? "Sala";
  if (d.audience.kind === "student") return store.studentById(d.audience.studentId ?? "")?.name ?? "Alumno/a";
  return "Toda la escuela";
}

export function Documentos() {
  useStore();
  const user = store.currentUser();
  const isFamily = user?.role === "family";
  const docs = store.documentsFor(user);
  const [composing, setComposing] = useState(false);

  return (
    <>
      <section className="card span2">
        <div className="row between">
          <h2>📄 Documentos</h2>
          {!isFamily && <button className="ghost" onClick={() => setComposing((v) => !v)}>{composing ? "Cerrar" : "+ Subir documento"}</button>}
        </div>
        <p className="muted small">
          {isFamily
            ? "Boletines, autorizaciones y circulares del colegio. Descargá, completá y devolvé firmado lo que haga falta."
            : "Subí boletines, autorizaciones y circulares para las familias. Después podés ver lo que devuelven firmado."}
        </p>
        {composing && !isFamily && <DocComposer onDone={() => setComposing(false)} />}
      </section>

      {docs.length === 0 && (
        <section className="card span2"><div className="empty">{isFamily ? "No tenés documentos por ahora 📭" : "Todavía no subiste documentos."}</div></section>
      )}
      {docs.map((d) => <DocItem key={d.id} doc={d} isFamily={isFamily} />)}
    </>
  );
}

function DocItem({ doc, isFamily }: { doc: SchoolDoc; isFamily: boolean }) {
  const user = store.currentUser();
  const meta = DOC_TYPES[doc.type];
  const canManage = store.canManageDocument(doc);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const myResponses = doc.responses.filter((r) => r.byUser === user?.username);

  async function onResp(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > DOC_MAX) { setErr("El archivo supera 20 MB. Probá con uno más liviano."); return; }
    setUploading(true); setErr(null);
    try {
      const up = await uploadDoc(f);
      if (up) store.addDocResponse(doc.id, { fileUrl: up.url, fileName: up.name });
    } catch { setErr("No se pudo subir el archivo."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <article className="card span2 doc-item">
      <div className="doc-head">
        <span className="doc-ico" aria-hidden="true">{meta.emoji}</span>
        <div className="grow">
          <b>{doc.title}</b>
          <small className="muted">{meta.label} · {doc.createdByName} · {fmtWhen(doc.ts)}{!isFamily ? ` · para ${audienceLabel(doc)}` : ""}</small>
        </div>
        {doc.dueDate && <span className="pill warn">Entregar antes del {fmtDate(doc.dueDate)}</span>}
      </div>

      {doc.description && <p className="doc-desc">{doc.description}</p>}

      <div className="doc-actions">
        <button className="primary" onClick={() => downloadDoc(doc.fileUrl, doc.fileName)}>⬇️ Descargar</button>
        {isFamily && (
          <>
            <button className="ghost" onClick={() => fileRef.current?.click()} disabled={uploading} aria-busy={uploading}>
              {uploading ? <><span className="spinner" aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-2px" }} />Subiendo…</> : "📎 Devolver firmado/completado"}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,application/pdf,image/*" hidden onChange={onResp} />
          </>
        )}
        {canManage && <button className="mini-btn danger" onClick={() => { if (confirm(`¿Eliminar el documento "${doc.title}"?`)) store.deleteDocument(doc.id); }}>Eliminar</button>}
      </div>
      {err && <div className="login-error" role="alert">{err}</div>}

      {/* Respuestas: la familia ve las suyas; el colegio ve todas */}
      {(isFamily ? myResponses : doc.responses).length > 0 && (
        <div className="doc-resp">
          <small className="muted">{isFamily ? "Tu devolución:" : `Devoluciones (${doc.responses.length}):`}</small>
          <ul>
            {(isFamily ? myResponses : doc.responses).map((r) => (
              <li key={r.id}>
                <button className="link" onClick={() => downloadDoc(r.fileUrl, r.fileName)}>📎 {r.fileName}</button>
                <span className="muted small"> · {isFamily ? "" : r.byName + " · "}{fmtWhen(r.ts)}</span>
                {(r.byUser === user?.username || user?.role === "director") && (
                  <button className="cmt-x" title="Quitar" aria-label="Quitar" onClick={() => store.deleteDocResponse(doc.id, r.id)}>✕</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function DocComposer({ onDone }: { onDone: () => void }) {
  const user = store.currentUser();
  const isDirector = user?.role === "director";
  const allSalas = store.salas();
  const salaOptions = isDirector ? allSalas : (allSalas.filter((s) => s.teacherId === user?.teacherId).length ? allSalas.filter((s) => s.teacherId === user?.teacherId) : allSalas);
  const students = store.students();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocType>("autorizacion");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [aud, setAud] = useState<DocAudience["kind"]>("sala");
  const [salaId, setSalaId] = useState(salaOptions[0]?.id ?? "");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [file, setFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > DOC_MAX) { setErr("El archivo supera 20 MB. Probá con uno más liviano."); return; }
    setUploading(true); setErr(null);
    try {
      const up = await uploadDoc(f);
      if (up) setFile(up);
      if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
    } catch { setErr("No se pudo subir el archivo."); }
    finally { setUploading(false); }
  }

  function publish() {
    if (!title.trim() || !file) { setErr("Falta el título o el archivo."); return; }
    const audience: DocAudience = aud === "sala" ? { kind: "sala", salaId } : aud === "student" ? { kind: "student", studentId } : { kind: "all" };
    store.addDocument({ title, type, description, fileUrl: file.url, fileName: file.name, fileType: file.type, audience, dueDate });
    onDone();
  }

  return (
    <div className="event-form">
      <div className="row gap wrap">
        <div><label htmlFor="doc-type">Tipo</label>
          <select id="doc-type" value={type} onChange={(e) => setType(e.target.value as DocType)}>
            {(Object.keys(DOC_TYPES) as DocType[]).map((k) => <option key={k} value={k}>{DOC_TYPES[k].emoji} {DOC_TYPES[k].label}</option>)}
          </select>
        </div>
        <div className="grow"><label htmlFor="doc-title">Título</label>
          <input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Autorización salida al museo" />
        </div>
      </div>

      <div className="row gap wrap">
        <div><label htmlFor="doc-aud">Para</label>
          <select id="doc-aud" value={aud} onChange={(e) => setAud(e.target.value as DocAudience["kind"])}>
            {isDirector && <option value="all">🏫 Toda la escuela</option>}
            <option value="sala">👥 Una sala</option>
            <option value="student">👨‍👩‍👧 Una familia (alumno/a)</option>
          </select>
        </div>
        {aud === "sala" && (
          <div><label htmlFor="doc-sala">Sala</label>
            <select id="doc-sala" value={salaId} onChange={(e) => setSalaId(e.target.value)}>
              {salaOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {aud === "student" && (
          <div className="grow"><label htmlFor="doc-stu">Alumno/a</label>
            <select id="doc-stu" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
          </div>
        )}
        <div><label htmlFor="doc-due">Fecha límite (opcional)</label>
          <input id="doc-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      <label htmlFor="doc-desc">Indicaciones (opcional)</label>
      <input id="doc-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Completar, firmar y devolver antes del miércoles." />

      <div className="row gap wrap" style={{ marginTop: 12 }}>
        <button className="ghost" onClick={() => fileRef.current?.click()} disabled={uploading} aria-busy={uploading}>
          {uploading ? <><span className="spinner" aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-2px" }} />Subiendo…</> : (file ? `✓ ${file.name}` : "📎 Elegir archivo (PDF, imagen, doc…)")}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,application/pdf,image/*" hidden onChange={onFile} />
        <button className="primary grow" onClick={publish} disabled={uploading || !file || !title.trim()}>Publicar documento</button>
      </div>
      {err && <div className="login-error" role="alert">{err}</div>}
    </div>
  );
}

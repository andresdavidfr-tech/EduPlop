import { useState } from "react";
import { store, useStore } from "../lib/store";

/**
 * Compositor de comunicados + lista de enviados con editar/borrar.
 * Dirección elige el destinatario (familias o docentes) y modera todos;
 * los docentes envían a las familias y gestionan los propios.
 */
export function Comunicados() {
  useStore();
  const user = store.currentUser();
  const isDirector = user?.role === "director";

  const [audience, setAudience] = useState<"family" | "teacher">("family");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  function enviar() {
    if (!title.trim()) return;
    store.sendAnnouncement(isDirector ? audience : "family", title.trim(), body.trim());
    setTitle(""); setBody(""); setSent(true);
    setTimeout(() => setSent(false), 2500);
  }

  // Dirección ve todos; docentes ven los que crearon ellos.
  const list = store.announcements().filter((n) => isDirector || n.createdBy === user?.username);

  return (
    <>
      <section className="card span2">
        <h2>📣 {isDirector ? "Enviar comunicado" : "Enviar aviso a las familias"}</h2>
        <p className="muted small">
          {isDirector
            ? "Comunicate con las familias o el equipo docente. Les llega como notificación."
            : "Enviá un aviso a las familias (p. ej. de tu sala). Les llega como notificación."}
        </p>
        <div className="row gap wrap">
          {isDirector && (
            <div>
              <label htmlFor="com-aud">Para</label>
              <select id="com-aud" value={audience} onChange={(e) => setAudience(e.target.value as "family" | "teacher")}>
                <option value="family">👨‍👩‍👧 Familias</option>
                <option value="teacher">🧑‍🏫 Docentes</option>
              </select>
            </div>
          )}
          <div className="grow">
            <label htmlFor="com-title">Título</label>
            <input id="com-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Salida didáctica del jueves" />
          </div>
        </div>
        <label htmlFor="com-body">Mensaje</label>
        <input id="com-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribí el aviso…" />
        <div className="row gap" style={{ marginTop: 12 }}>
          <button className="primary" onClick={enviar}>{isDirector ? "Enviar comunicado" : "Enviar aviso"}</button>
          {sent && <span className="pill active">✓ Enviado</span>}
        </div>
      </section>

      <section className="card span2">
        <h2>🗂️ {isDirector ? "Comunicados enviados" : "Mis avisos enviados"}</h2>
        <p className="muted small">Editá o eliminá lo que ya publicaste. Los cambios se reflejan en las notificaciones.</p>
        {list.length === 0 && <p className="muted">Todavía no enviaste {isDirector ? "comunicados" : "avisos"}.</p>}
        <div className="agenda-list">
          {list.map((n) => <SentRow key={n.id} id={n.id} canPickAudience={isDirector} />)}
        </div>
      </section>
    </>
  );
}

function SentRow({ id, canPickAudience }: { id: string; canPickAudience: boolean }) {
  useStore();
  const n = store.announcements().find((x) => x.id === id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(n?.title ?? "");
  const [body, setBody] = useState(n?.body ?? "");
  const [aud, setAud] = useState<"family" | "teacher">(n?.audienceRole === "teacher" ? "teacher" : "family");
  if (!n) return null;

  function save() {
    if (!title.trim()) return;
    store.updateAnnouncement(id, { title: title.trim(), body: body.trim(), audienceRole: aud });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="event-form">
        <div className="row gap wrap">
          {canPickAudience && (
            <div>
              <label htmlFor={`ce-aud-${id}`}>Para</label>
              <select id={`ce-aud-${id}`} value={aud} onChange={(e) => setAud(e.target.value as "family" | "teacher")}>
                <option value="family">👨‍👩‍👧 Familias</option>
                <option value="teacher">🧑‍🏫 Docentes</option>
              </select>
            </div>
          )}
          <div className="grow"><label htmlFor={`ce-title-${id}`}>Título</label><input id={`ce-title-${id}`} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        </div>
        <label htmlFor={`ce-body-${id}`}>Mensaje</label>
        <input id={`ce-body-${id}`} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="row gap" style={{ marginTop: 12 }}>
          <button className="primary" onClick={save}>Guardar cambios</button>
          <button className="ghost" onClick={() => setEditing(false)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="list-row">
      <div>
        <b>{n.title}</b> <span className="pill">{n.audienceRole === "teacher" ? "Docentes" : "Familias"}</span>
        <div className="muted small">{n.body}</div>
        <div className="muted small">{new Date(n.timestamp).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      <div className="agenda-admin">
        <button className="ghost small-btn" onClick={() => { setTitle(n.title); setBody(n.body); setAud(n.audienceRole === "teacher" ? "teacher" : "family"); setEditing(true); }}>✏️ Editar</button>
        <button className="ghost small-btn danger" onClick={() => { if (confirm(`¿Eliminar "${n.title}"?`)) store.deleteAnnouncement(id); }}>🗑️ Eliminar</button>
      </div>
    </div>
  );
}

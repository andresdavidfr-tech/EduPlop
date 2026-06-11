import { useState } from "react";
import { store, useStore } from "../lib/store";
import { suggestComTemplates, type ComTemplate } from "../lib/comunicadoTemplates";

/**
 * Compositor de comunicados + lista de enviados con editar/borrar.
 * Dirección elige el destinatario (familias/docentes) y puede segmentar por sala;
 * los docentes envían a las familias y pueden apuntar a su sala. Cada quien
 * gestiona los propios; dirección modera todos.
 */
export function Comunicados() {
  useStore();
  const user = store.currentUser();
  const isDirector = user?.role === "director";

  // Salas disponibles para segmentar: dirección todas; docente las suyas
  // (si no tiene ninguna asignada, puede elegir entre todas).
  const allSalas = store.salas();
  const mySalas = isDirector ? allSalas : allSalas.filter((s) => s.teacherId === user?.teacherId);
  const salaOptions = mySalas.length ? mySalas : allSalas;

  const [audience, setAudience] = useState<"family" | "teacher">("family");
  const [salaId, setSalaId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  const targetsFamilies = !isDirector || audience === "family";

  // Asistente de redacción: modelos sugeridos según el motivo/título escrito.
  const suggestions = suggestComTemplates(title, user?.role);
  function applyTemplate(t: ComTemplate) {
    setTitle((cur) => (cur.trim() ? cur : t.title));
    setBody(t.body);
  }

  function enviar() {
    if (!title.trim()) return;
    store.sendAnnouncement(isDirector ? audience : "family", title.trim(), body.trim(), targetsFamilies ? salaId : "");
    setTitle(""); setBody(""); setSalaId(""); setSent(true);
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
            ? "Comunicate con las familias o el equipo docente. Podés enviarlo a toda la escuela o a una sala."
            : "Enviá un aviso a las familias. Podés mandarlo a todas o solo a tu sala."}
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
          {targetsFamilies && (
            <div>
              <label htmlFor="com-sala">Sala</label>
              <select id="com-sala" value={salaId} onChange={(e) => setSalaId(e.target.value)}>
                <option value="">🏫 Todas las familias</option>
                {salaOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="grow">
            <label htmlFor="com-title">Título</label>
            <input id="com-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Salida didáctica del jueves" />
          </div>
        </div>
        <div className="ai-suggest">
          <span className="muted small">✨ Asistente de redacción — {title.trim() ? "según tu motivo, te propongo:" : "¿sobre qué es? elegí un modelo y lo completás:"}</span>
          <div className="sugg-chips">
            {suggestions.map((t) => (
              <button key={t.id} type="button" className="sugg-chip" onClick={() => applyTemplate(t)} title={`Usar modelo: ${t.label}`}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        <label htmlFor="com-body">Mensaje</label>
        <textarea id="com-body" value={body} onChange={(e) => setBody(e.target.value)} rows={7}
          placeholder="Escribí el aviso… o elegí un modelo arriba y completá los datos entre [corchetes]." />
        <div className="row gap" style={{ marginTop: 12 }}>
          <button className="primary" onClick={enviar}>{isDirector ? "Enviar comunicado" : "Enviar aviso"}</button>
          {body.trim() && <button className="ghost" onClick={() => setBody("")}>Limpiar</button>}
          {sent && <span className="pill active">✓ Enviado</span>}
        </div>
      </section>

      <section className="card span2">
        <h2>🗂️ {isDirector ? "Comunicados enviados" : "Mis avisos enviados"}</h2>
        <p className="muted small">Editá o eliminá lo que ya publicaste. Los cambios se reflejan en las notificaciones.</p>
        {list.length === 0 && <p className="muted">Todavía no enviaste {isDirector ? "comunicados" : "avisos"}.</p>}
        <div className="agenda-list">
          {list.map((n) => <SentRow key={n.id} id={n.id} canPickAudience={isDirector} salaOptions={salaOptions} />)}
        </div>
      </section>
    </>
  );
}

function SentRow({ id, canPickAudience, salaOptions }: { id: string; canPickAudience: boolean; salaOptions: { id: string; name: string }[] }) {
  useStore();
  const n = store.announcements().find((x) => x.id === id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(n?.title ?? "");
  const [body, setBody] = useState(n?.body ?? "");
  const [aud, setAud] = useState<"family" | "teacher">(n?.audienceRole === "teacher" ? "teacher" : "family");
  const [salaId, setSalaId] = useState(n?.audienceSala ?? "");
  if (!n) return null;

  const targetsFamilies = aud === "family";
  const salaName = n.audienceSala ? (store.salas().find((s) => s.id === n.audienceSala)?.name ?? "Sala") : null;

  function save() {
    if (!title.trim()) return;
    store.updateAnnouncement(id, { title: title.trim(), body: body.trim(), audienceRole: aud, audienceSala: targetsFamilies ? salaId : "" });
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
          {targetsFamilies && (
            <div>
              <label htmlFor={`ce-sala-${id}`}>Sala</label>
              <select id={`ce-sala-${id}`} value={salaId} onChange={(e) => setSalaId(e.target.value)}>
                <option value="">🏫 Todas las familias</option>
                {salaOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="grow"><label htmlFor={`ce-title-${id}`}>Título</label><input id={`ce-title-${id}`} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        </div>
        <label htmlFor={`ce-body-${id}`}>Mensaje</label>
        <textarea id={`ce-body-${id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
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
        <b>{n.title}</b> <span className="pill">{salaName ? `📍 ${salaName}` : (n.audienceRole === "teacher" ? "Docentes" : "Todas las familias")}</span>
        <div className="muted small">{n.body}</div>
        <div className="muted small">{new Date(n.timestamp).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      <div className="agenda-admin">
        <button className="ghost small-btn" onClick={() => { setTitle(n.title); setBody(n.body); setAud(n.audienceRole === "teacher" ? "teacher" : "family"); setSalaId(n.audienceSala ?? ""); setEditing(true); }}>✏️ Editar</button>
        <button className="ghost small-btn danger" onClick={() => { if (confirm(`¿Eliminar "${n.title}"?`)) store.deleteAnnouncement(id); }}>🗑️ Eliminar</button>
      </div>
    </div>
  );
}

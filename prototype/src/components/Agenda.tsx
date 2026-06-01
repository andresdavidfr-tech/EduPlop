import { useState } from "react";
import { store, useStore } from "../lib/store";
import type { AgendaType, RsvpValue } from "../lib/types";

const TYPE_META: Record<AgendaType, { icon: string; label: string }> = {
  reunion: { icon: "👥", label: "Reunión" },
  acto: { icon: "🎉", label: "Acto" },
  examen: { icon: "📝", label: "Evaluación" },
  feriado: { icon: "🏖️", label: "Feriado" },
  salida: { icon: "🚌", label: "Salida" },
  otro: { icon: "📌", label: "Otro" },
};

const RSVP_LABEL: Record<RsvpValue, string> = { yes: "Asistiré", no: "No puedo", maybe: "Quizás" };

function fmtDate(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }); }
  catch { return d; }
}

export function Agenda() {
  useStore();
  const user = store.currentUser();
  const events = store.agendaFor(user);
  const isSchool = user?.role !== "family";
  const [creating, setCreating] = useState(false);

  return (
    <section className="card span2">
      <div className="row between">
        <h2>📅 Agenda</h2>
        {isSchool && <button className="ghost" onClick={() => setCreating((v) => !v)}>{creating ? "Cerrar" : "+ Nuevo evento"}</button>}
      </div>
      <p className="muted small">Eventos del colegio. {user?.role === "family" ? "Confirmá tu asistencia con un toque." : "Publicá eventos para familias o docentes."}</p>

      {creating && isSchool && <EventForm onDone={() => setCreating(false)} />}

      <div className="agenda-list">
        {events.length === 0 && <p className="muted">No hay eventos.</p>}
        {events.map((e) => {
          const meta = TYPE_META[e.type];
          const myRsvp = user ? e.rsvps[user.username] : undefined;
          const counts = Object.values(e.rsvps);
          const yes = counts.filter((v) => v === "yes").length;
          return (
            <div key={e.id} className="agenda-item">
              <div className="agenda-date">
                <span className="agenda-ico">{meta.icon}</span>
                <small>{fmtDate(e.date)}{e.time ? ` · ${e.time}` : ""}</small>
              </div>
              <div className="agenda-main">
                <b>{e.title}</b> <span className="pill">{meta.label}</span>
                <p className="muted small">{e.description}</p>
                {user?.role === "family" ? (
                  <div className="rsvp">
                    {(["yes", "maybe", "no"] as RsvpValue[]).map((v) => (
                      <button key={v} className={myRsvp === v ? "rsvp-btn active" : "rsvp-btn"} onClick={() => store.rsvp(e.id, v)}>
                        {RSVP_LABEL[v]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <small className="muted">✅ {yes} familia(s) confirmaron asistencia</small>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EventForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [type, setType] = useState<AgendaType>("reunion");
  const [audienceRole, setAudienceRole] = useState<"family" | "teacher" | "all">("family");

  function save() {
    if (!title.trim()) return;
    store.addAgendaEvent({ title: title.trim(), description: description.trim(), date, time, type, audienceRole });
    onDone();
  }

  return (
    <div className="event-form">
      <div className="row gap wrap">
        <div className="grow"><label>Título</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Reunión de padres" /></div>
        <div><label>Fecha</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label>Hora</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      </div>
      <div className="row gap wrap">
        <div><label>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value as AgendaType)}>
            {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div><label>Para</label>
          <select value={audienceRole} onChange={(e) => setAudienceRole(e.target.value as any)}>
            <option value="family">Familias</option>
            <option value="teacher">Docentes</option>
            <option value="all">Todos</option>
          </select>
        </div>
        <div className="grow"><label>Descripción</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalle del evento" /></div>
      </div>
      <button className="primary" onClick={save} style={{ marginTop: 12 }}>Publicar evento</button>
    </div>
  );
}

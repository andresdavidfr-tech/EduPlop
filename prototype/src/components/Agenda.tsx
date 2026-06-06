import { useState } from "react";
import { store, useStore } from "../lib/store";
import type { AgendaEvent, AgendaType, RsvpValue } from "../lib/types";
import { googleCalendarUrl, outlookCalendarUrl, downloadIcs, googleMapsUrl } from "../lib/calendar";

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
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="card span2">
      <div className="row between">
        <h2>📅 Agenda</h2>
        {isSchool && <button className="ghost" onClick={() => { setCreating((v) => !v); setEditing(null); }}>{creating ? "Cerrar" : "+ Nuevo evento"}</button>}
      </div>
      <p className="muted small">Eventos del colegio. {user?.role === "family" ? "Confirmá tu asistencia y agregalos a tu calendario." : "Publicá y editá eventos para familias o docentes."}</p>

      {creating && isSchool && <EventForm onDone={() => setCreating(false)} />}

      <div className="agenda-list">
        {events.length === 0 && <p className="muted">No hay eventos.</p>}
        {events.map((e, i) => {
          const meta = TYPE_META[e.type];
          const myRsvp = user ? e.rsvps[user.username] : undefined;
          const counts = Object.values(e.rsvps);
          const yes = counts.filter((v) => v === "yes").length;
          if (editing === e.id) {
            return <EventForm key={e.id} event={e} onDone={() => setEditing(null)} />;
          }
          return (
            <div key={e.id} className="agenda-item" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
              <div className="agenda-date">
                <span className="agenda-ico">{meta.icon}</span>
                <small>{fmtDate(e.date)}{e.time ? ` · ${e.time}` : ""}</small>
              </div>
              <div className="agenda-main">
                <b>{e.title}</b> <span className="pill">{meta.label}</span>
                <p className="muted small">{e.description}</p>
                {e.location && (
                  <a className="agenda-loc" href={googleMapsUrl(e.location)} target="_blank" rel="noopener noreferrer">
                    📍 {e.location}
                  </a>
                )}

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

                {/* Vincular con calendarios externos */}
                <div className="agenda-links">
                  <a className="cal-link" href={googleCalendarUrl(e)} target="_blank" rel="noopener noreferrer">📆 Google Calendar</a>
                  <a className="cal-link" href={outlookCalendarUrl(e)} target="_blank" rel="noopener noreferrer">📧 Outlook</a>
                  <button className="cal-link" onClick={() => downloadIcs(e)}>📥 .ics (Apple/otros)</button>
                  {e.location && <a className="cal-link" href={googleMapsUrl(e.location)} target="_blank" rel="noopener noreferrer">🗺️ Maps</a>}
                </div>

                {isSchool && (
                  <div className="agenda-admin">
                    <button className="ghost small-btn" onClick={() => { setEditing(e.id); setCreating(false); }}>✏️ Editar</button>
                    <button className="ghost small-btn danger" onClick={() => { if (confirm(`¿Eliminar "${e.title}"?`)) store.deleteAgendaEvent(e.id); }}>🗑️ Eliminar</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EventForm({ onDone, event }: { onDone: () => void; event?: AgendaEvent }) {
  const isEdit = !!event;
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [date, setDate] = useState(event?.date ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(event?.time ?? "10:00");
  const [type, setType] = useState<AgendaType>(event?.type ?? "reunion");
  const [audienceRole, setAudienceRole] = useState<"family" | "teacher" | "all">(event?.audienceRole ?? "family");
  const [location, setLocation] = useState(event?.location ?? "");

  function save() {
    if (!title.trim()) return;
    const data = { title: title.trim(), description: description.trim(), date, time, type, audienceRole, location: location.trim() || undefined };
    if (isEdit && event) store.updateAgendaEvent(event.id, data);
    else store.addAgendaEvent(data);
    onDone();
  }

  const uid = event?.id ?? "new";
  return (
    <div className="event-form">
      <div className="row gap wrap">
        <div className="grow"><label htmlFor={`ev-title-${uid}`}>Título</label><input id={`ev-title-${uid}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Reunión de padres" /></div>
        <div><label htmlFor={`ev-date-${uid}`}>Fecha</label><input id={`ev-date-${uid}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label htmlFor={`ev-time-${uid}`}>Hora</label><input id={`ev-time-${uid}`} type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      </div>
      <div className="row gap wrap">
        <div><label htmlFor={`ev-type-${uid}`}>Tipo</label>
          <select id={`ev-type-${uid}`} value={type} onChange={(e) => setType(e.target.value as AgendaType)}>
            {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div><label htmlFor={`ev-aud-${uid}`}>Para</label>
          <select id={`ev-aud-${uid}`} value={audienceRole} onChange={(e) => setAudienceRole(e.target.value as "family" | "teacher" | "all")}>
            <option value="family">Familias</option>
            <option value="teacher">Docentes</option>
            <option value="all">Todos</option>
          </select>
        </div>
        <div className="grow"><label htmlFor={`ev-desc-${uid}`}>Descripción</label><input id={`ev-desc-${uid}`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalle del evento" /></div>
      </div>
      <div className="row gap wrap">
        <div className="grow"><label htmlFor={`ev-loc-${uid}`}>Ubicación (opcional · se abre en Google Maps)</label>
          <input id={`ev-loc-${uid}`} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ej. SUM del colegio, Av. San Martín 1234" />
        </div>
      </div>
      <div className="row gap" style={{ marginTop: 12 }}>
        <button className="primary" onClick={save}>{isEdit ? "Guardar cambios" : "Publicar evento"}</button>
        {isEdit && <button className="ghost" onClick={onDone}>Cancelar</button>}
      </div>
    </div>
  );
}

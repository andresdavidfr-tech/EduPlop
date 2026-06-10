import { useState } from "react";
import { store, useStore, CATEGORY_LABEL } from "../lib/store";
import { ProfileAvatar } from "./ProfileAvatar";
import type { MessageCategory } from "../lib/types";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: "Esperando respuesta", cls: "warn" },
  answered: { label: "Respondido", cls: "active" },
  closed: { label: "Cerrado", cls: "" },
};

export function Messages() {
  useStore();
  const user = store.currentUser();
  const convs = store.conversationsFor(user);
  const isFamily = user?.role === "family";
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [reply, setReply] = useState("");

  const active = convs.find((c) => c.id === openId);

  function sendReply() {
    if (!active || !reply.trim()) return;
    store.replyConversation(active.id, reply.trim());
    setReply("");
  }

  return (
    <section className="card span2">
      <div className="row between">
        <h2>💬 {isFamily ? "Mensajes con el colegio" : "Bandeja de mensajes"}</h2>
        <button className="ghost" onClick={() => { setComposing((v) => !v); setOpenId(null); }}>{composing ? "Cerrar" : (isFamily ? "+ Nuevo mensaje" : "+ Mensaje a una familia")}</button>
      </div>

      {composing && <Composer isFamily={isFamily} onDone={() => setComposing(false)} />}

      <div className="msg-layout">
        <div className="msg-list">
          {convs.length === 0 && <p className="muted small">No hay mensajes.</p>}
          {convs.map((c) => {
            const stu = store.studentById(c.studentId ?? "");
            const st = STATUS_META[c.status];
            return (
              <button key={c.id} className={openId === c.id ? "msg-row active" : "msg-row"} onClick={() => { setOpenId(c.id); setComposing(false); }}>
                <div className="row between">
                  <b>{c.subject}</b>
                  <span className={`pill ${st.cls}`}>{st.label}</span>
                </div>
                <small className="muted">{!isFamily ? c.messages[0]?.fromName + " · " : ""}{CATEGORY_LABEL[c.category]}{stu ? " · " + stu.name : ""}</small>
              </button>
            );
          })}
        </div>

        <div className="msg-thread">
          {!active && <div className="empty small">Elegí una conversación 💬</div>}
          {active && (
            <>
              <h3>{active.subject}</h3>
              <div className="thread-msgs">
                {active.messages.map((m, i) => (
                  <div key={i} className={`thread-msg ${m.from === user?.username ? "mine" : "theirs"}`}>
                    <ProfileAvatar username={m.from} name={m.fromName} size={28} />
                    <div className="thread-msg-body">
                      <small>{m.fromName}</small>
                      <div className="bubble">{m.body}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="row gap" style={{ marginTop: 10 }}>
                <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribí una respuesta…"
                  onKeyDown={(e) => e.key === "Enter" && sendReply()} />
                <button className="primary" onClick={sendReply}>Responder</button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Composer({ onDone, isFamily }: { onDone: () => void; isFamily: boolean }) {
  const user = store.currentUser();
  // Familia: solo sus hijos/as. Colegio: toda la matrícula.
  const students = isFamily
    ? store.students().filter((s) => user?.guardianId
        ? store.guardianships().some((g) => g.studentId === s.id && g.guardianId === user.guardianId)
        : true)
    : store.students();
  const [category, setCategory] = useState<MessageCategory>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [studentId, setStudentId] = useState(students[0]?.id);

  function send() {
    if (!subject.trim() || !body.trim() || !studentId) return;
    if (isFamily) store.startConversation(category, subject.trim(), body.trim(), studentId);
    else store.startSchoolThread(studentId, subject.trim(), body.trim(), category);
    onDone();
  }

  return (
    <div className="event-form">
      <div className="row gap wrap">
        <div><label>Tipo</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as MessageCategory)}>
            <option value="general">{CATEGORY_LABEL.general}</option>
            <option value="permission">{CATEGORY_LABEL.permission}</option>
            <option value="absence">{CATEGORY_LABEL.absence}</option>
          </select>
        </div>
        <div><label>Alumno/a</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
          </select>
        </div>
        <div className="grow"><label>Asunto</label><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={isFamily ? "Ej. Mía faltará el lunes" : "Ej. Reunión por seguimiento"} /></div>
      </div>
      <label>Mensaje</label>
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribí tu mensaje…" />
      <button className="primary" onClick={send} style={{ marginTop: 12 }}>{isFamily ? "Enviar al colegio" : "Enviar a la familia"}</button>
    </div>
  );
}

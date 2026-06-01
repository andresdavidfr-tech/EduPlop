import { useState } from "react";
import { store, useStore, CATEGORY_LABEL } from "../lib/store";
import { STUDENTS, GUARDIANSHIPS } from "../lib/seed";
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
        {isFamily && <button className="ghost" onClick={() => { setComposing((v) => !v); setOpenId(null); }}>{composing ? "Cerrar" : "+ Nuevo mensaje"}</button>}
      </div>

      {composing && isFamily && <Composer onDone={() => setComposing(false)} />}

      <div className="msg-layout">
        <div className="msg-list">
          {convs.length === 0 && <p className="muted small">No hay mensajes.</p>}
          {convs.map((c) => {
            const stu = STUDENTS.find((s) => s.id === c.studentId);
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
                    <small>{m.fromName}</small>
                    <div className="bubble">{m.body}</div>
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

function Composer({ onDone }: { onDone: () => void }) {
  const user = store.currentUser();
  const myStudents = STUDENTS.filter((s) =>
    user?.guardianId
      ? GUARDIANSHIPS.some((g) => g.studentId === s.id && g.guardianId === user.guardianId)
      : true);
  const [category, setCategory] = useState<MessageCategory>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [studentId, setStudentId] = useState(myStudents[0]?.id);

  function send() {
    if (!subject.trim() || !body.trim()) return;
    store.startConversation(category, subject.trim(), body.trim(), studentId);
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
            {myStudents.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
          </select>
        </div>
        <div className="grow"><label>Asunto</label><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej. Mía faltará el lunes" /></div>
      </div>
      <label>Mensaje</label>
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribí tu mensaje…" />
      <button className="primary" onClick={send} style={{ marginTop: 12 }}>Enviar al colegio</button>
    </div>
  );
}

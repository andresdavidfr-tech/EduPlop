import { useEffect, useRef, useState } from "react";
import { store } from "../lib/store";
import { askAssistant } from "../lib/assistant";

interface ChatMsg { who: "bot" | "me"; text: string; suggestions?: string[]; }

export function Assistant() {
  const user = store.currentUser();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && msgs.length === 0 && user) {
      const r = askAssistant("hola", user);
      setMsgs([{ who: "bot", text: r.text, suggestions: r.suggestions }]);
    }
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  if (!user) return null;

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    const r = askAssistant(t, user!);
    setMsgs((m) => [...m, { who: "me", text: t }, { who: "bot", text: r.text, suggestions: r.suggestions }]);
    setInput("");
  }

  return (
    <>
      {!open && (
        <button className="ai-fab" onClick={() => setOpen(true)} title="Asistente EduPlop">
          ✨ Asistente
        </button>
      )}
      {open && (
        <div className="ai-panel">
          <header>
            <span>✨ Asistente EduPlop</span>
            <button onClick={() => setOpen(false)}>✕</button>
          </header>
          <div className="ai-body">
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.who}`}>
                <div className="bubble">{m.text.split("\n").map((l, j) => <div key={j}>{renderBold(l)}</div>)}</div>
                {m.suggestions && (
                  <div className="ai-suggs">
                    {m.suggestions.map((s) => (
                      <button key={s} onClick={() => send(s)}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form className="ai-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribí tu consulta…" />
            <button className="primary" type="submit">Enviar</button>
          </form>
          <p className="ai-foot">Asistente de demostración. En producción se conecta a la Claude API.</p>
        </div>
      )}
    </>
  );
}

function renderBold(line: string) {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>));
}

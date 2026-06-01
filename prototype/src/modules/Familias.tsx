import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { store, useStore } from "../lib/store";
import { STUDENTS, GUARDIANSHIPS, INSTITUTION } from "../lib/seed";
import type { AuthorizationToken } from "../lib/types";
import { Messages } from "../components/Messages";
import { Agenda } from "../components/Agenda";
import { PushSettings } from "../components/PushSettings";

function statusLabel(s: string) {
  return ({ active: "Listo para usar", consumed: "Ya utilizado", expired: "Vencido", revoked: "Anulado", scheduled: "Programado" } as any)[s] ?? s;
}

function Countdown({ exp }: { exp: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.round((exp - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return <span className={left <= 30 ? "cd danger" : "cd"}>{mm}:{ss}</span>;
}

function defaultDate() { return new Date().toISOString().slice(0, 10); }
function defaultTime() {
  const d = new Date(Date.now() + 3600000);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

export function Familias() {
  const state = useStore();
  const user = store.currentUser();

  const myStudents = useMemo(() => {
    if (user?.role === "family" && user.guardianId) {
      const ids = GUARDIANSHIPS.filter((g) => g.guardianId === user.guardianId).map((g) => g.studentId);
      return STUDENTS.filter((s) => ids.includes(s.id));
    }
    return STUDENTS;
  }, [user?.guardianId]);

  const [studentId, setStudentId] = useState(myStudents[0]?.id);
  useEffect(() => { if (!myStudents.find((s) => s.id === studentId)) setStudentId(myStudents[0]?.id); }, [myStudents]);
  const [reason, setReason] = useState("Salida anticipada");
  const [last, setLast] = useState<AuthorizationToken | null>(null);
  const [qrUrl, setQrUrl] = useState("");

  // autorizados del alumno (incluye altas de la familia)
  const authorizeds = useMemo(() => store.authorizedFor(studentId), [studentId, state.customGuardians]);
  const primary = useMemo(() => {
    const link = store.guardianships().find((g) => g.studentId === studentId && g.role === "primary_guardian");
    return store.guardianById(link?.guardianId ?? "");
  }, [studentId, state.customGuardians]);

  const [authorizedId, setAuthorizedId] = useState(authorizeds[0]?.id);
  useEffect(() => { if (!authorizeds.find((g) => g.id === authorizedId)) setAuthorizedId(authorizeds[0]?.id); }, [authorizeds]);

  // programación
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [date, setDate] = useState(defaultDate());
  const [time, setTime] = useState(defaultTime());

  // alta de autorizado
  const [showAdd, setShowAdd] = useState(false);

  const student = myStudents.find((s) => s.id === studentId);
  const ttlMin = Math.round(state.settings.ttlSeconds / 60);

  function emitir() {
    if (!student || !authorizedId) return;
    let scheduleAt: number | undefined;
    if (when === "schedule") {
      const t = new Date(`${date}T${time}`).getTime();
      if (!isNaN(t)) scheduleAt = t;
    }
    const t = store.issueToken(studentId, authorizedId, primary?.id ?? user?.guardianId ?? "guar_010", reason, scheduleAt);
    setLast(t);
  }

  useEffect(() => {
    if (last) QRCode.toDataURL(last.qrPayload, { width: 240, margin: 1 }).then(setQrUrl);
  }, [last?.qrPayload]);

  const liveToken = last ? state.tokens.find((t) => t.jti === last.jti) ?? last : null;
  const liveStatus = liveToken ? store.effectiveStatus(liveToken) : null;

  async function shareWhatsApp() {
    if (!last || !student) return;
    const who = store.guardianById(last.claims.act);
    const sched = last.claims.nbf > Date.now()
      ? `Programado para el ${new Date(last.claims.nbf).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`
      : `Válido por unos minutos.`;
    const text = `🎒 Pase de retiro — ${INSTITUTION.name}\nAlumno/a: ${student.name}\nRetira: ${who?.name ?? ""}\n${sched}\nMostrá este código QR en la puerta.`;
    try {
      if (qrUrl && navigator.canShare) {
        const blob = await (await fetch(qrUrl)).blob();
        const file = new File([blob], "pase-eduplop.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Pase de retiro EduPlop", text });
          return;
        }
      }
    } catch { /* cae al fallback */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  const myTokens = state.tokens.filter((t) =>
    user?.role === "family" ? myStudents.some((s) => s.id === t.claims.sub) : true);

  return (
    <div className="grid two">
      <section className="card">
        <h2>Autorizar un retiro</h2>
        <p className="muted">Generá un pase para que alguien retire a tu hijo/a. Mostrá el código en la puerta y listo. ✨</p>

        <label>¿A quién vas a retirar?</label>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {myStudents.map((s) => (
            <option key={s.id} value={s.id}>{s.emoji} {s.name} · {s.classroom}</option>
          ))}
        </select>

        <label>¿Quién lo/la va a retirar?</label>
        <select value={authorizedId} onChange={(e) => setAuthorizedId(e.target.value)}>
          {authorizeds.map((g) => (
            <option key={g.id} value={g.id}>{g.emoji} {g.name} · {g.relation}{store.isRevoked(g.id) ? " (revocado)" : ""}</option>
          ))}
        </select>
        <button className="link addlink" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Cancelar" : "+ Agregar nuevo autorizado"}
        </button>
        {showAdd && (
          <AddAuthorized studentId={studentId} onAdded={(g) => { setAuthorizedId(g.id); setShowAdd(false); }} />
        )}

        <label>¿Para cuándo?</label>
        <div className="seg">
          <button className={when === "now" ? "seg-btn active" : "seg-btn"} onClick={() => setWhen("now")}>Ahora</button>
          <button className={when === "schedule" ? "seg-btn active" : "seg-btn"} onClick={() => setWhen("schedule")}>Programar día y hora</button>
        </div>
        {when === "schedule" && (
          <div className="row gap wrap" style={{ marginTop: 8 }}>
            <div className="grow"><label>Día</label><input type="date" value={date} min={defaultDate()} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="grow"><label>Hora</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
        )}

        <label>Motivo (opcional)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} />

        {when === "now"
          ? <div className="ttl-note">🕒 El pase quedará activo por <b>{ttlMin} min</b>, tiempo de sobra para llegar a la puerta.</div>
          : <div className="ttl-note">🗓️ El pase se habilitará 15 min antes de la hora elegida y vencerá 30 min después.</div>}

        <button className="primary big" onClick={emitir}>Generar pase de retiro</button>
      </section>

      <section className="card center">
        {last && student && qrUrl ? (
          <>
            <h2>Pase para {student.emoji} {student.name}</h2>
            <img className="qr" src={qrUrl} alt="QR de retiro" />
            <div className="qr-meta">
              <div><b className={`pill ${liveStatus}`}>{statusLabel(liveStatus!)}</b></div>
              {liveStatus === "active" && <div className="big-cd">Válido <Countdown exp={last.claims.exp} /></div>}
              {liveStatus === "scheduled" && (
                <div className="big-cd">📅 {new Date(last.claims.nbf).toLocaleString("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
              )}
            </div>
            <button className="wa-btn" onClick={shareWhatsApp}>
              <span>📲</span> Enviar por WhatsApp
            </button>
            <p className="muted small">Por seguridad no contiene datos personales y vence solo. Te avisaremos cuando se concrete el retiro. 🔔</p>
            <details className="tech">
              <summary>Detalles técnicos</summary>
              <span className="jti">id: {last.jti} · firmado Ed25519</span>
            </details>
          </>
        ) : (
          <div className="empty">Tu pase aparecerá acá 📲</div>
        )}
      </section>

      <PushSettings />

      <Agenda />
      <Messages />

      <section className="card span2">
        <h2>Mis retiros recientes</h2>
        <table className="tbl">
          <thead><tr><th>Alumno</th><th>Retira</th><th>Motivo</th><th>Estado</th></tr></thead>
          <tbody>
            {myTokens.length === 0 && <tr><td colSpan={4} className="muted">Todavía no autorizaste retiros.</td></tr>}
            {myTokens.slice(0, 8).map((t) => {
              const st = store.effectiveStatus(t);
              const stu = STUDENTS.find((s) => s.id === t.claims.sub);
              const g = store.guardianById(t.claims.act);
              return (
                <tr key={t.jti}>
                  <td>{stu?.emoji} {stu?.name}</td>
                  <td>{g?.name}</td>
                  <td>{t.reason}</td>
                  <td><span className={`pill ${st}`}>{statusLabel(st)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function AddAuthorized({ studentId, onAdded }: { studentId: string; onAdded: (g: any) => void }) {
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [relation, setRelation] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(f);
  }

  function save() {
    if (!name.trim() || !document.trim()) return;
    const g = store.addAuthorized({ name, document, relation, photo, studentId });
    onAdded(g);
  }

  return (
    <div className="event-form">
      <p className="muted small">Registrá una persona autorizada a retirar (queda asociada a este alumno/a).</p>
      <div className="row gap wrap">
        <div className="grow"><label>Nombre completo *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Ana Gómez" /></div>
        <div className="grow"><label>DNI *</label><input value={document} onChange={(e) => setDocument(e.target.value)} placeholder="Ej. 35.111.222" /></div>
      </div>
      <div className="row gap wrap">
        <div className="grow"><label>Vínculo</label><input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Ej. Tía, Niñera, Abuelo" /></div>
        <div className="grow">
          <label>Foto (opcional)</label>
          <div className="row gap">
            {photo
              ? <img className="avatar-img" src={photo} style={{ width: 44, height: 44 }} alt="foto" />
              : <span className="avatar" style={{ fontSize: 36 }}>🧑</span>}
            <button className="ghost" onClick={() => fileRef.current?.click()}>Subir foto</button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
          </div>
        </div>
      </div>
      <button className="primary" onClick={save} style={{ marginTop: 12 }}>Guardar autorizado</button>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { store, useStore } from "../lib/store";
import { STUDENTS, GUARDIANS, GUARDIANSHIPS } from "../lib/seed";
import type { AuthorizationToken } from "../lib/types";

function statusLabel(s: string) {
  return ({ active: "Listo para usar", consumed: "Ya utilizado", expired: "Vencido", revoked: "Anulado" } as any)[s] ?? s;
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

function QRView({ token }: { token: AuthorizationToken }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    QRCode.toDataURL(token.qrPayload, { width: 240, margin: 1 }).then(setUrl);
  }, [token.qrPayload]);
  return url ? <img className="qr" src={url} alt="QR de retiro" /> : <div className="qr placeholder" />;
}

export function Familias() {
  const state = useStore();
  const user = store.currentUser();

  // hijos del tutor logueado (o todos, si es Dirección supervisando)
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

  const authorizeds = useMemo(() => {
    const ids = GUARDIANSHIPS.filter((g) => g.studentId === studentId).map((g) => g.guardianId);
    return GUARDIANS.filter((g) => ids.includes(g.id));
  }, [studentId]);

  const primary = useMemo(() => {
    const link = GUARDIANSHIPS.find((g) => g.studentId === studentId && g.role === "primary_guardian");
    return GUARDIANS.find((g) => g.id === link?.guardianId);
  }, [studentId]);

  const [authorizedId, setAuthorizedId] = useState(authorizeds[0]?.id);
  useEffect(() => { setAuthorizedId(authorizeds[0]?.id); }, [studentId]);

  const student = myStudents.find((s) => s.id === studentId);
  const ttlMin = Math.round(state.settings.ttlSeconds / 60);

  function emitir() {
    if (!student || !authorizedId) return;
    const t = store.issueToken(studentId, authorizedId, primary?.id ?? user?.guardianId ?? "guar_010", reason);
    setLast(t);
  }

  const liveStatus = last
    ? store.effectiveStatus(state.tokens.find((t) => t.jti === last.jti) ?? last)
    : null;

  // avisos del colegio
  const avisos = store.notificationsFor(user).filter((n) => n.kind === "announcement");
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
            <option key={g.id} value={g.id}>{g.emoji} {g.name} · {g.relation}</option>
          ))}
        </select>

        <label>Motivo (opcional)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} />

        <div className="ttl-note">🕒 El pase quedará activo por <b>{ttlMin} min</b>, tiempo de sobra para llegar a la puerta.</div>

        <button className="primary big" onClick={emitir}>Generar pase de retiro</button>
      </section>

      <section className="card center">
        {last && student ? (
          <>
            <h2>Pase para {student.emoji} {student.name}</h2>
            <QRView token={last} />
            <div className="qr-meta">
              <div><b className={`pill ${liveStatus}`}>{statusLabel(liveStatus!)}</b></div>
              {liveStatus === "active" && <div className="big-cd">Válido <Countdown exp={last.claims.exp} /></div>}
            </div>
            <p className="muted small">Mostrá este código en la puerta o el aula. Por seguridad no contiene datos personales y vence solo. Te avisaremos cuando se concrete el retiro. 🔔</p>
            <details className="tech">
              <summary>Detalles técnicos</summary>
              <span className="jti">id: {last.jti} · firmado Ed25519</span>
            </details>
          </>
        ) : (
          <div className="empty">Tu pase aparecerá acá 📲</div>
        )}
      </section>

      <section className="card">
        <h2>📣 Avisos del colegio</h2>
        {avisos.length === 0 && <p className="muted">No hay avisos por ahora.</p>}
        {avisos.map((a) => (
          <div key={a.id} className="aviso">
            <b>{a.title}</b>
            <p className="muted small">{a.body}</p>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Mis retiros recientes</h2>
        <table className="tbl">
          <thead><tr><th>Alumno</th><th>Retira</th><th>Motivo</th><th>Estado</th></tr></thead>
          <tbody>
            {myTokens.length === 0 && <tr><td colSpan={4} className="muted">Todavía no autorizaste retiros.</td></tr>}
            {myTokens.slice(0, 8).map((t) => {
              const st = store.effectiveStatus(t);
              const stu = STUDENTS.find((s) => s.id === t.claims.sub);
              const g = GUARDIANS.find((x) => x.id === t.claims.act);
              return (
                <tr key={t.jti}>
                  <td>{stu?.emoji} {stu?.name}</td>
                  <td>{g?.emoji} {g?.name}</td>
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

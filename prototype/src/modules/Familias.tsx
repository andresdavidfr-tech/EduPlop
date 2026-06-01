import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { store, useStore } from "../lib/store";
import { STUDENTS, GUARDIANS, GUARDIANSHIPS } from "../lib/seed";
import type { AuthorizationToken } from "../lib/types";

function statusLabel(s: string) {
  return ({ active: "Activo", consumed: "Utilizado", expired: "Vencido", revoked: "Anulado" } as any)[s] ?? s;
}

function Countdown({ exp }: { exp: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.round((exp - now) / 1000));
  return <span className={left <= 10 ? "cd danger" : "cd"}>{left}s</span>;
}

function QRView({ token }: { token: AuthorizationToken }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    QRCode.toDataURL(token.qrPayload, { width: 220, margin: 1 }).then(setUrl);
  }, [token.qrPayload]);
  return url ? <img className="qr" src={url} alt="QR de retiro" /> : <div className="qr placeholder" />;
}

export function Familias() {
  const state = useStore();
  const [studentId, setStudentId] = useState(STUDENTS[0].id);
  const [reason, setReason] = useState("Turno médico");
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

  const student = STUDENTS.find((s) => s.id === studentId)!;

  function emitir() {
    const t = store.issueToken(studentId, authorizedId, primary!.id, reason);
    setLast(t);
  }

  const liveStatus = last
    ? store.effectiveStatus(state.tokens.find((t) => t.jti === last.jti) ?? last)
    : null;

  return (
    <div className="grid two">
      <section className="card">
        <h2>Retiro express</h2>
        <p className="muted">Generá un QR temporal y firmado para autorizar una salida de último momento.</p>

        <label>Alumno/a</label>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {STUDENTS.map((s) => (
            <option key={s.id} value={s.id}>{s.emoji} {s.name} · {s.classroom}</option>
          ))}
        </select>

        <label>Quién retira (autorizado aprobado)</label>
        <select value={authorizedId} onChange={(e) => setAuthorizedId(e.target.value)}>
          {authorizeds.map((g) => (
            <option key={g.id} value={g.id}>{g.emoji} {g.name} · {g.relation}</option>
          ))}
        </select>

        <label>Motivo (opcional)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} />

        <div className="ttl-note">TTL actual del QR: <b>{state.settings.ttlSeconds}s</b> (configurable por Dirección)</div>

        <button className="primary big" onClick={emitir}>Generar QR de retiro</button>
      </section>

      <section className="card center">
        {last ? (
          <>
            <h2>QR para {student.emoji} {student.name}</h2>
            <QRView token={last} />
            <div className="qr-meta">
              <div>Estado: <b className={`pill ${liveStatus}`}>{statusLabel(liveStatus!)}</b></div>
              {liveStatus === "active" && <div>Caduca en <Countdown exp={last.claims.exp} /></div>}
              <div className="jti">jti: {last.jti}</div>
            </div>
            <p className="muted small">El QR no contiene datos personales: transporta un token firmado (Ed25519). Mostralo en la puerta o el aula.</p>
          </>
        ) : (
          <div className="empty">Generá un QR para verlo aquí 📲</div>
        )}
      </section>

      <section className="card span2">
        <h2>Historial de autorizaciones</h2>
        <table className="tbl">
          <thead><tr><th>jti</th><th>Alumno</th><th>Retira</th><th>Motivo</th><th>Estado</th></tr></thead>
          <tbody>
            {state.tokens.length === 0 && <tr><td colSpan={5} className="muted">Sin autorizaciones todavía.</td></tr>}
            {state.tokens.map((t) => {
              const st = store.effectiveStatus(t);
              const stu = STUDENTS.find((s) => s.id === t.claims.sub);
              const g = GUARDIANS.find((x) => x.id === t.claims.act);
              return (
                <tr key={t.jti}>
                  <td className="mono">{t.jti}</td>
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

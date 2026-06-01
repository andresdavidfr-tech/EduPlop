import { useState } from "react";
import { store } from "../lib/store";
import { USERS, ROLE_LABEL } from "../lib/seed";
import { Logo } from "../components/Logo";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = store.login(username, password);
    if (!res.ok) setError(res.reason ?? "No se pudo iniciar sesión");
  }

  function quick(u: string, p: string) {
    setUsername(u); setPassword(p); setError(null);
    store.login(u, p);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <Logo size={64} />
          <h1>EduPlop</h1>
          <p className="muted">Hub de Experiencia Familiar · Colegio San Martín</p>
        </div>

        <form onSubmit={submit}>
          <label>Usuario</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ej. familia" autoFocus />
          <label>Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          {error && <div className="login-error">{error}</div>}
          <button className="primary big" type="submit">Ingresar</button>
        </form>

        <div className="login-demo">
          <p className="muted small">Cuentas de demostración (toque para entrar):</p>
          {USERS.map((u) => (
            <button key={u.username} className="demo-chip" onClick={() => quick(u.username, u.password)}>
              <b>{ROLE_LABEL[u.role]}</b>
              <span>{u.username} / {u.password}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { store } from "../lib/store";
import { DEMO_ACCOUNTS, ROLE_LABEL } from "../lib/seed";
import { Logo } from "../components/Logo";
import { Button } from "../ui/Button";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    const res = await store.loginWithPassword(email, password);
    if (!res.ok) { setError(res.reason ?? "No se pudo iniciar sesión"); setLoading(false); }
  }

  async function quick(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setError(null); setLoading(true);
    setEmail(acc.email); setPassword(acc.password);
    const res = await store.loginDemo(acc);
    if (!res.ok) { setError(res.reason ?? "No se pudo entrar"); setLoading(false); }
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
          <label htmlFor="login-email">Email</label>
          <input id="login-email" name="email" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="tu-email@colegio.edu" autoFocus />
          <label htmlFor="login-pass">Contraseña</label>
          <input id="login-pass" name="password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          {error && <div className="login-error" role="alert">{error}</div>}
          <Button variant="primary" big type="submit" loading={loading}>Ingresar</Button>
        </form>

        <div className="login-demo">
          <p className="muted small">Cuentas de demostración (toque para entrar):</p>
          {DEMO_ACCOUNTS.map((u) => (
            <button key={u.email} className="demo-chip" onClick={() => quick(u)} disabled={loading}>
              <b>{ROLE_LABEL[u.role]}</b>
              <span>{u.email} / {u.password}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

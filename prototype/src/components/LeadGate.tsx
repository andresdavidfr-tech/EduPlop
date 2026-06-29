import { useState } from "react";
import { Logo } from "./Logo";
import { Button } from "../ui/Button";

// Endpoint de Google Apps Script que escribe en el Sheet de prospectos.
// Para configurarlo: creá un Apps Script Web App (ver instrucciones abajo)
// y pegá su URL de despliegue aquí o en la var de entorno VITE_LEADS_ENDPOINT.
const LEADS_ENDPOINT =
  (import.meta.env.VITE_LEADS_ENDPOINT as string | undefined) ?? "";

const LS_KEY = "eduplop_lead_submitted";

export function useLeadGateSubmitted(): boolean {
  try { return localStorage.getItem(LS_KEY) === "1"; } catch { return false; }
}

export function LeadGate({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload = { nombre: name, email, institucion: institution, rol: role, ts: new Date().toISOString() };

    try {
      if (LEADS_ENDPOINT) {
        await fetch(LEADS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          mode: "no-cors", // Apps Script no devuelve CORS headers en modo doPost
        });
      }
    } catch {
      // fallo silencioso: guardamos igual localmente y dejamos pasar al usuario
    }

    try { localStorage.setItem(LS_KEY, "1"); } catch { /* ignore */ }
    setLoading(false);
    onDone();
  }

  return (
    <div className="login-wrap lead-gate-wrap">
      <div className="login-card lead-gate-card">
        <div className="login-brand">
          <Logo size={52} />
          <h1>Edu<span className="brand-plop">Plop</span></h1>
          <p className="lead-gate-tagline">La plataforma de comunicación escolar</p>
        </div>

        <p className="lead-gate-intro">
          Antes de explorar el demo, dejanos tus datos.
          Te contactaremos con novedades del producto.
        </p>

        <form onSubmit={submit} className="lead-gate-form">
          <label htmlFor="lg-name">Nombre completo</label>
          <input id="lg-name" type="text" autoFocus required value={name}
            onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />

          <label htmlFor="lg-email">Correo electrónico</label>
          <input id="lg-email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />

          <label htmlFor="lg-inst">Institución educativa</label>
          <input id="lg-inst" type="text" required value={institution}
            onChange={(e) => setInstitution(e.target.value)} placeholder="Nombre del colegio o institución" />

          <label htmlFor="lg-role">Tu rol</label>
          <select id="lg-role" required value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Seleccioná tu rol…</option>
            <option value="Director/a">Director/a</option>
            <option value="Docente">Docente</option>
            <option value="Administrativo/a">Administrativo/a</option>
            <option value="Familia">Familia</option>
            <option value="Otro">Otro</option>
          </select>

          {error && <div className="login-error" role="alert">{error}</div>}

          <Button variant="primary" big type="submit" loading={loading}>
            Ver el demo
          </Button>
        </form>

        <p className="lead-gate-privacy">
          Tus datos se usan solo para contactarte sobre EduPlop.
          No los compartimos con terceros.
        </p>
      </div>
    </div>
  );
}

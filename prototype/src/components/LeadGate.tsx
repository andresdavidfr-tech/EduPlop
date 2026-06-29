import { useState } from "react";
import { Logo } from "./Logo";
import { Button } from "../ui/Button";

const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdIi7pe13EFPFPsNjUmatgo13O8KVlbsgiSggWDWccWG0kLlg/viewform?embedded=true";

const LS_KEY = "eduplop_lead_submitted";

export function useLeadGateSubmitted(): boolean {
  try { return localStorage.getItem(LS_KEY) === "1"; } catch { return false; }
}

export function LeadGate({ onDone }: { onDone: () => void }) {
  const [submitted, setSubmitted] = useState(false);

  function confirm() {
    try { localStorage.setItem(LS_KEY, "1"); } catch { /* ignore */ }
    onDone();
  }

  return (
    <div className="login-wrap lead-gate-wrap">
      <div className="lead-gate-card">
        <div className="lead-gate-header">
          <Logo size={44} />
          <div>
            <h1 className="lead-gate-title">Edu<span className="brand-plop">Plop</span></h1>
            <p className="lead-gate-tagline">La plataforma de comunicación escolar</p>
          </div>
        </div>

        <p className="lead-gate-intro">
          Completá el formulario para acceder al demo gratuito.
        </p>

        {!submitted ? (
          <>
            <div className="lead-gate-iframe-wrap">
              <iframe
                src={FORM_URL}
                title="Formulario de acceso al demo"
                frameBorder="0"
                marginHeight={0}
                marginWidth={0}
                className="lead-gate-iframe"
              >
                Cargando formulario…
              </iframe>
            </div>
            <div className="lead-gate-actions">
              <p className="lead-gate-hint">
                Una vez que enviaste el formulario, tocá el botón:
              </p>
              <Button variant="primary" big onClick={() => setSubmitted(true)}>
                Ya lo envié → Ver el demo
              </Button>
            </div>
          </>
        ) : (
          <div className="lead-gate-confirm">
            <div className="lead-gate-check">✓</div>
            <p>¡Gracias! Nos pondremos en contacto pronto.</p>
            <Button variant="primary" big onClick={confirm}>
              Ingresar al demo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

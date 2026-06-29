import { useEffect } from "react";
import { Logo } from "./Logo";

const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdIi7pe13EFPFPsNjUmatgo13O8KVlbsgiSggWDWccWG0kLlg/viewform?embedded=true";

export const LEAD_LS_KEY = "eduplop_lead_submitted";

export function useLeadGateSubmitted(): boolean {
  try { return localStorage.getItem(LEAD_LS_KEY) === "1"; } catch { return false; }
}

export function LeadGate({ onDone }: { onDone: () => void }) {
  // Escucha el postMessage que envía el iframe cuando Google redirige a /?lead=1
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "eduplop_lead_done") {
        try { localStorage.setItem(LEAD_LS_KEY, "1"); } catch {}
        onDone();
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onDone]);

  // Polling de respaldo: detecta si el iframe ya escribió en localStorage
  useEffect(() => {
    const id = setInterval(() => {
      try {
        if (localStorage.getItem(LEAD_LS_KEY) === "1") {
          clearInterval(id);
          onDone();
        }
      } catch {}
    }, 600);
    return () => clearInterval(id);
  }, [onDone]);

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
          El acceso se habilita automáticamente al enviarlo.
        </p>

        <div className="lead-gate-iframe-wrap">
          <iframe
            src={FORM_URL}
            title="Formulario de acceso al demo"
            frameBorder={0}
            className="lead-gate-iframe"
          />
        </div>
      </div>
    </div>
  );
}

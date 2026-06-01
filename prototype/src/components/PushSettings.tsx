import { store, useStore } from "../lib/store";
import type { NotifPrefs } from "../lib/types";

const PREF_LABEL: Record<keyof NotifPrefs, string> = {
  pickup: "Retiros de mis hijos/as",
  message: "Mensajes del colegio",
  agenda: "Eventos de la agenda",
  announcement: "Comunicados",
};

export function PushSettings() {
  const state = useStore();
  const supported = typeof window !== "undefined" && "Notification" in window;

  return (
    <section className="card">
      <h2>🔔 Notificaciones push</h2>
      {!supported && <p className="muted small">Este navegador no soporta notificaciones push.</p>}
      {supported && (
        <>
          {!state.pushEnabled ? (
            <>
              <p className="muted small">Recibí avisos en este dispositivo aunque no tengas la app abierta.</p>
              <button className="primary" onClick={() => store.requestPush()}>Activar notificaciones</button>
            </>
          ) : (
            <>
              <p className="muted small">✅ Activadas. Elegí qué querés recibir:</p>
              {(Object.keys(PREF_LABEL) as (keyof NotifPrefs)[]).map((k) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={state.notifPrefs[k]} onChange={(e) => store.setNotifPref(k, e.target.checked)} />
                  {PREF_LABEL[k]}
                </label>
              ))}
              <button className="link" onClick={() => store.setPushEnabled(false)}>Desactivar</button>
            </>
          )}
        </>
      )}
    </section>
  );
}

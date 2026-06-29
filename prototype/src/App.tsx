import { useEffect, useState, lazy, Suspense } from "react";
import { store, useStore } from "./lib/store";
import { Login } from "./modules/Login";
import { LeadGate, useLeadGateSubmitted, LEAD_LS_KEY } from "./components/LeadGate";
import { NotificationsBell } from "./components/Notifications";
import { ProfilePhotoButton } from "./components/ProfileAvatar";
import { SettingsButton } from "./components/SettingsPanel";
import { applyUiPrefs } from "./lib/uiPrefs";
import { Assistant } from "./components/Assistant";
import { Logo } from "./components/Logo";
import { INSTITUTION, ROLE_MODULES, ROLE_LABEL } from "./lib/seed";
import { SYNC_ENABLED } from "./lib/supabaseConfig";

// Carga diferida por rol: cada módulo (y sus dependencias pesadas, p. ej. el
// escáner ZXing dentro de Docentes) se descarga solo cuando se usa.
const Familias = lazy(() => import("./modules/Familias").then((m) => ({ default: m.Familias })));
const Docentes = lazy(() => import("./modules/Docentes").then((m) => ({ default: m.Docentes })));
const Directivo = lazy(() => import("./modules/Directivo").then((m) => ({ default: m.Directivo })));

type Tab = "familias" | "docentes" | "directivo";

const TAB_META: Record<Tab, { label: string; icon: string }> = {
  familias: { label: "Familias", icon: "👨‍👩‍👧" },
  docentes: { label: "Docentes", icon: "🧑‍🏫" },
  directivo: { label: "Dirección", icon: "🏫" },
};

// Detecta cuando Google Forms redirige al iframe con /?lead=1 tras el envío.
// Guarda el flag en localStorage y notifica al padre con postMessage.
function useLeadRedirect() {
  const [isRedirect] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("lead")) {
        localStorage.setItem(LEAD_LS_KEY, "1");
        window.history.replaceState({}, "", window.location.pathname);
        if (window !== window.parent) {
          window.parent.postMessage({ type: "eduplop_lead_done" }, "*");
          return true; // estamos dentro del iframe → mostrar pantalla de espera
        }
      }
    } catch {}
    return false;
  });
  return isRedirect;
}

export function App() {
  const isRedirect = useLeadRedirect();
  const state = useStore();
  const user = store.currentUser();
  const [gateCleared, setGateCleared] = useState(() => useLeadGateSubmitted());

  useEffect(() => { applyUiPrefs(state.fontScale, state.fontFamily); }, [state.fontScale, state.fontFamily]);

  // Pantalla transitoria que se muestra dentro del iframe luego del envío
  if (isRedirect) {
    return (
      <div className="lead-redirect-screen">
        <div className="lead-redirect-check">✓</div>
        <p>¡Gracias! Accediendo al demo…</p>
      </div>
    );
  }

  if (state.authStatus === "loading") {
    return <div className="route-loading" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /> Cargando sesión…</div>;
  }
  if (!gateCleared) return <LeadGate onDone={() => setGateCleared(true)} />;
  if (!user) return <Login />;

  const allowed = (ROLE_MODULES[user.role] ?? []) as Tab[];
  return <Shell allowed={allowed} userName={user.name} userRole={ROLE_LABEL[user.role]}
    pendingSync={state.receipts.filter((r) => r.pendingSync).length}
    syncStatus={state.syncStatus} syncDetail={state.syncDetail} />;
}

function Shell({ allowed, userName, userRole, pendingSync, syncStatus, syncDetail }:
  { allowed: Tab[]; userName: string; userRole: string; pendingSync: number; syncStatus: string; syncDetail: string }) {
  const [tab, setTab] = useState<Tab>(allowed[0]);
  useEffect(() => { if (!allowed.includes(tab)) setTab(allowed[0]); }, [allowed.join()]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo size={36} />
          <div>
            <h1>Edu<span className="brand-plop">Plop</span></h1>
            <small>{INSTITUTION.name}</small>
          </div>
        </div>

        {allowed.length > 1 && (
          <nav className="tabs" aria-label="Módulos">
            {allowed.map((id) => (
              <button key={id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}>
                <span aria-hidden="true">{TAB_META[id].icon}</span> {TAB_META[id].label}
                {id === "docentes" && pendingSync > 0 && <em className="badge" aria-label={`${pendingSync} pendientes`}>{pendingSync}</em>}
              </button>
            ))}
          </nav>
        )}

        <div className="user-area">
          <NotificationsBell />
          <SettingsButton />
          <ProfilePhotoButton />
          <div className="user-chip">
            <b>{userName}</b>
            <small>{userRole}</small>
          </div>
          <button className="reset" onClick={() => store.logout()} title="Cerrar sesión">Salir</button>
        </div>
      </header>

      <main className="content">
        <Suspense fallback={<div className="route-loading" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /> Cargando…</div>}>
          {tab === "familias" && <Familias />}
          {tab === "docentes" && <Docentes />}
          {tab === "directivo" && <Directivo />}
        </Suspense>
      </main>

      <footer className="foot">
        {SYNC_ENABLED && (
          <div className={`sync-pill ${syncStatus}`}>
            {syncStatus === "ok" && <>☁️ Sincronización entre dispositivos activa</>}
            {syncStatus === "connecting" && <>⏳ Conectando con la nube…</>}
            {syncStatus === "error" && <>⚠️ Sin conexión con la nube {syncDetail} — revisá la tabla/políticas en Supabase</>}
            {syncStatus === "off" && <>Sincronización desactivada</>}
          </div>
        )}
        Prototipo · firmas <b>Ed25519</b> reales + cadena de auditoría <b>SHA-256</b>.
        {!SYNC_ENABLED && <><br />Demo de un dispositivo: la validación se refleja dentro de <b>este mismo navegador</b>.</>}
      </footer>

      <Assistant />
    </div>
  );
}

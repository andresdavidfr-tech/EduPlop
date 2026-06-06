import { useEffect, useState, lazy, Suspense } from "react";
import { store, useStore } from "./lib/store";
import { Login } from "./modules/Login";
import { NotificationsBell } from "./components/Notifications";
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

export function App() {
  const state = useStore();
  const user = store.currentUser();

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
            <h1>EduPlop</h1>
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

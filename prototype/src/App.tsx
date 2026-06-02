import { useEffect, useState } from "react";
import { store, useStore } from "./lib/store";
import { Familias } from "./modules/Familias";
import { Docentes } from "./modules/Docentes";
import { Directivo } from "./modules/Directivo";
import { Login } from "./modules/Login";
import { NotificationsBell } from "./components/Notifications";
import { Assistant } from "./components/Assistant";
import { Logo } from "./components/Logo";
import { INSTITUTION, ROLE_MODULES, ROLE_LABEL } from "./lib/seed";
import { SYNC_ENABLED } from "./lib/supabaseConfig";

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
    pendingSync={state.receipts.filter((r) => r.pendingSync).length} />;
}

function Shell({ allowed, userName, userRole, pendingSync }:
  { allowed: Tab[]; userName: string; userRole: string; pendingSync: number }) {
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
          <nav className="tabs">
            {allowed.map((id) => (
              <button key={id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
                <span>{TAB_META[id].icon}</span> {TAB_META[id].label}
                {id === "docentes" && pendingSync > 0 && <em className="badge">{pendingSync}</em>}
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
        {tab === "familias" && <Familias />}
        {tab === "docentes" && <Docentes />}
        {tab === "directivo" && <Directivo />}
      </main>

      <footer className="foot">
        Prototipo · firmas <b>Ed25519</b> reales + cadena de auditoría <b>SHA-256</b>.
        {SYNC_ENABLED
          ? <> Sincronización entre dispositivos <b>activa</b> ☁️ (Supabase).</>
          : <><br />Demo de un dispositivo: la validación se refleja dentro de <b>este mismo navegador</b>; sincronizar entre teléfonos requeriría un backend compartido.</>}
      </footer>

      <Assistant />
    </div>
  );
}

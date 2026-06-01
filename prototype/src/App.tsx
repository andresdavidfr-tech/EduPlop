import { useState } from "react";
import { store, useStore } from "./lib/store";
import { Familias } from "./modules/Familias";
import { Docentes } from "./modules/Docentes";
import { Directivo } from "./modules/Directivo";
import { INSTITUTION } from "./lib/seed";

type Tab = "familias" | "docentes" | "directivo";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "familias", label: "Familias", icon: "👨‍👩‍👧" },
  { id: "docentes", label: "Docentes", icon: "🧑‍🏫" },
  { id: "directivo", label: "Directivo", icon: "🏫" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("familias");
  const state = useStore();
  const pendingSync = state.receipts.filter((r) => r.pendingSync).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🎒</span>
          <div>
            <h1>EduPlop</h1>
            <small>Hub de Experiencia Familiar · {INSTITUTION.name}</small>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              <span>{t.icon}</span> {t.label}
              {t.id === "docentes" && pendingSync > 0 && (
                <em className="badge">{pendingSync}</em>
              )}
            </button>
          ))}
        </nav>
        <button className="reset" onClick={() => store.reset()} title="Reiniciar demo">
          ↺ Reiniciar
        </button>
      </header>

      <main className="content">
        {tab === "familias" && <Familias />}
        {tab === "docentes" && <Docentes />}
        {tab === "directivo" && <Directivo />}
      </main>

      <footer className="foot">
        Prototipo · firmas <b>Ed25519</b> reales + cadena de auditoría <b>SHA-256</b> · backend simulado en el navegador
      </footer>
    </div>
  );
}

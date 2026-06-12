import { useState } from "react";
import { store, useStore } from "../lib/store";
import { Modal } from "../ui/Modal";
import { PushSettings } from "./PushSettings";
import { FONT_OPTIONS, FONT_SCALES, stackFor } from "../lib/uiPrefs";

/** Botón de engranaje en la barra superior que abre los Ajustes. */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-btn" onClick={() => setOpen(true)} title="Ajustes" aria-label="Ajustes">⚙️</button>
      {open && <SettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const state = useStore();
  const scale = state.fontScale;
  const family = state.fontFamily;

  return (
    <Modal label="Ajustes" onClose={onClose}>
      <div className="settings">
        <h3>🔤 Tamaño de letra</h3>
        <div className="seg" role="group" aria-label="Tamaño de letra">
          {FONT_SCALES.map((s) => (
            <button key={s.value} className={Math.abs(scale - s.value) < 0.01 ? "seg-btn active" : "seg-btn"}
              onClick={() => store.setFontScale(s.value)}>{s.label}</button>
          ))}
        </div>

        <h3 style={{ marginTop: 18 }}>✍️ Tipografía</h3>
        <div className="font-grid">
          {FONT_OPTIONS.map((f) => (
            <button key={f.key} className={family === f.key ? "font-opt active" : "font-opt"}
              onClick={() => store.setFontFamily(f.key)} style={{ fontFamily: f.stack }}>
              <b>{f.label}</b>
              <span>Aa Ñ 123</span>
            </button>
          ))}
        </div>

        <div className="settings-preview" style={{ fontFamily: stackFor(family) }}>
          <b>Vista previa</b>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            Así se verá el texto del Hub. El cambio se aplica al instante y se guarda en este dispositivo.
          </p>
        </div>

        <hr className="settings-sep" />
        <PushSettings />
      </div>
    </Modal>
  );
}

import { useState } from "react";
import { store, useStore } from "../lib/store";
import { Modal } from "../ui/Modal";
import { PushSettings } from "./PushSettings";
import { FONT_OPTIONS, FONT_SCALES, stackFor, applyUiPrefs } from "../lib/uiPrefs";

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
  const savedScale = state.fontScale;
  const savedFamily = state.fontFamily;
  const [scale, setScale] = useState(savedScale);
  const [family, setFamily] = useState(savedFamily);
  const [saved, setSaved] = useState(false);

  // Previsualiza en vivo sin persistir todavía.
  function pickScale(v: number) { setScale(v); applyUiPrefs(v, family); setSaved(false); }
  function pickFamily(k: string) { setFamily(k); applyUiPrefs(scale, k); setSaved(false); }

  function guardar() {
    store.setFontScale(scale);
    store.setFontFamily(family);
    setSaved(true);
  }
  function cerrar() {
    // Si hubo cambios sin guardar, revertimos la vista previa a lo guardado.
    applyUiPrefs(state.fontScale, state.fontFamily);
    onClose();
  }

  const dirty = Math.abs(scale - savedScale) > 0.001 || family !== savedFamily;

  return (
    <Modal label="Ajustes" onClose={cerrar}>
      <div className="settings">
        <h3>🔤 Tamaño de letra</h3>
        <div className="seg" role="group" aria-label="Tamaño de letra">
          {FONT_SCALES.map((s) => (
            <button key={s.value} className={Math.abs(scale - s.value) < 0.01 ? "seg-btn active" : "seg-btn"}
              onClick={() => pickScale(s.value)}>{s.label}</button>
          ))}
        </div>

        <h3 style={{ marginTop: 18 }}>✍️ Tipografía</h3>
        <div className="font-grid">
          {FONT_OPTIONS.map((f) => (
            <button key={f.key} className={family === f.key ? "font-opt active" : "font-opt"}
              onClick={() => pickFamily(f.key)} style={{ fontFamily: f.stack }}>
              <b>{f.label}</b>
              <span>Aa Ñ 123</span>
            </button>
          ))}
        </div>

        <div className="settings-preview" style={{ fontFamily: stackFor(family) }}>
          <b>Vista previa</b>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            Así se verá el texto del Hub. Tocá <b>Guardar</b> para confirmar el cambio en este dispositivo.
          </p>
        </div>

        <div className="row gap" style={{ marginTop: 14 }}>
          <button className="primary" onClick={guardar} disabled={!dirty}>Guardar</button>
          <button className="ghost" onClick={cerrar}>Cerrar</button>
          {saved && <span className="pill active">✓ Guardado</span>}
          {dirty && !saved && <span className="muted small">Cambios sin guardar…</span>}
        </div>

        <hr className="settings-sep" />
        <PushSettings />
      </div>
    </Modal>
  );
}

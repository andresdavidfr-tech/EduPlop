import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { playScan } from "../lib/sound";

interface Props {
  onResult: (text: string) => void;
  onClose: () => void;
  /** Permite simular el escaneo si no hay cámara (demo). */
  onSimulate?: () => void;
}

/**
 * Abre la cámara y escanea QR en vivo con ZXing.
 * Requiere contexto seguro (https:// o localhost). Si la cámara no está
 * disponible, ofrece un fallback de simulación.
 */
export function QrScanner({ onResult, onClose, onSimulate }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 200 });

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Este navegador no permite acceso a la cámara.");
        }
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result, err, ctrl) => {
            controlsRef.current = ctrl;
            if (result && !cancelled) {
              cancelled = true;
              playScan();
              ctrl.stop();
              onResult(result.getText());
            }
          }
        );
        controlsRef.current = controls;
      } catch (e: any) {
        const msg = e?.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Habilitá la cámara o usá el modo simulación."
          : e?.message || "No se pudo abrir la cámara.";
        if (!cancelled) setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      try { controlsRef.current?.stop(); } catch { /* noop */ }
    };
  }, [onResult]);

  return (
    <div className="scanner-overlay" onClick={onClose}>
      <div className="scanner" onClick={(e) => e.stopPropagation()}>
        <h3>📷 Escaneá el QR del retiro</h3>
        {!error ? (
          <>
            <div className="scanner-frame">
              <video ref={videoRef} playsInline muted />
              <div className="scanner-reticle" />
            </div>
            <p className="muted small">Apuntá la cámara al código QR que muestra la familia. Tenés tiempo de sobra: el QR es válido por varios minutos.</p>
          </>
        ) : (
          <div className="scanner-error">
            <p>⚠️ {error}</p>
          </div>
        )}
        <div className="row gap" style={{ justifyContent: "center", marginTop: 12 }}>
          {onSimulate && (
            <button className="ghost" onClick={onSimulate}>Sin cámara: simular escaneo</button>
          )}
          <button className="ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

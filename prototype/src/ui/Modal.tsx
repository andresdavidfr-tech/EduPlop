import { useEffect, useRef, type ReactNode } from "react";

/**
 * Diálogo modal accesible y reutilizable:
 * - role="dialog" + aria-modal + etiqueta.
 * - Cierra con Escape o clic fuera.
 * - Lleva el foco al abrir, lo atrapa con Tab y lo restaura al cerrar.
 * - Bloquea el scroll del fondo mientras está abierto.
 */
export function Modal({ onClose, label, className, children }: {
  onClose: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    document.body.style.overflow = "hidden";
    // Foco al primer elemento enfocable (o al contenedor).
    const focusables = node?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (focusables?.[0] ?? node)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    node?.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      node?.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label}
        className={`modal ${className ?? ""}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

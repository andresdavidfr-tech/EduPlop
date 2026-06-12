/**
 * Preferencias de interfaz (tamaño de letra y tipografía). Se guardan por
 * dispositivo en el store y se aplican como variables CSS en :root.
 */
export interface FontOption { key: string; label: string; stack: string; }

export const FONT_OPTIONS: FontOption[] = [
  { key: "system", label: "Sistema", stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  { key: "humanist", label: "Legible", stack: 'Verdana, "Segoe UI", Tahoma, Geneva, sans-serif' },
  { key: "rounded", label: "Redondeada", stack: 'ui-rounded, "Avenir Next", Avenir, "Segoe UI", system-ui, sans-serif' },
  { key: "serif", label: "Serif", stack: 'Georgia, Cambria, "Times New Roman", Times, serif' },
];

export const FONT_SCALES: { label: string; value: number }[] = [
  { label: "Chica", value: 0.9 },
  { label: "Normal", value: 1 },
  { label: "Grande", value: 1.12 },
  { label: "Muy grande", value: 1.25 },
];

export function stackFor(key: string): string {
  return (FONT_OPTIONS.find((f) => f.key === key) ?? FONT_OPTIONS[0]).stack;
}

/** Aplica las preferencias a las variables CSS globales. */
export function applyUiPrefs(scale: number, familyKey: string) {
  const root = document.documentElement;
  root.style.setProperty("--ui-font-scale", String(scale || 1));
  root.style.setProperty("--ui-font-family", stackFor(familyKey));
}

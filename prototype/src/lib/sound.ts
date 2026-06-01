// Sonidos generados con Web Audio (sin archivos externos).
// Se invocan tras un gesto del usuario (clic), por lo que el autoplay no los bloquea.

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.15) {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + dur);
}

/** Sonido de éxito: dos tonos ascendentes alegres. */
export function playSuccess() {
  tone(660, 0, 0.15, "sine");
  tone(990, 0.13, 0.25, "sine");
}

/** Sonido de error: tono grave de advertencia. */
export function playError() {
  tone(220, 0, 0.35, "square", 0.12);
}

/** "Beep" corto al detectar un QR. */
export function playScan() {
  tone(880, 0, 0.1, "triangle", 0.12);
}

import type { Guardian } from "../lib/types";

/** Muestra la foto del autorizado si existe; si no, el emoji. */
export function Avatar({ g, size = 34 }: { g?: Guardian; size?: number }) {
  if (g?.photo) {
    return <img className="avatar-img" src={g.photo} alt={g.name} style={{ width: size, height: size }} />;
  }
  return <span className="avatar" style={{ fontSize: size }}>{g?.emoji ?? "❓"}</span>;
}

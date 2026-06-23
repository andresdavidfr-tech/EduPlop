/**
 * Logo de marca EduPlop: anillo "C" en degradado azul→violeta (abierto a la
 * derecha) con una mochila roja en el centro. Vectorial (SVG) para verse nítido
 * a cualquier tamaño y combinar con el tema.
 */
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg
      className="brand-logo"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="EduPlop"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="eduplop-grad" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#3b2be0" />
          <stop offset="0.55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#a83cea" />
        </linearGradient>
      </defs>

      {/* Anillo "C" abierto a la derecha */}
      <path d="M85 24 A44 44 0 1 0 85 96" fill="none" stroke="url(#eduplop-grad)" strokeWidth="14" strokeLinecap="round" />

      {/* Mochila roja centrada */}
      <path d="M50 49 v-3 a10 10 0 0 1 20 0 v3" fill="none" stroke="#ef2b2b" strokeWidth="5" strokeLinecap="round" />
      <rect x="42" y="47" width="36" height="37" rx="11" fill="#ef2b2b" />
      <path d="M49 59 h22" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <path d="M51 66 a9 9 0 0 0 18 0" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.95" />
    </svg>
  );
}

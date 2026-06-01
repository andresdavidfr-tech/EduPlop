/**
 * Logo de marca EduPlop: insignia con forma "e/C" en degradado azul→rojo
 * y un maletín en el centro. Vectorial (SVG) para verse nítido a cualquier
 * tamaño. Reemplaza al emoji de mochila usado previamente.
 */
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg
      className="brand-logo"
      width={size}
      height={size}
      viewBox="0 0 120 110"
      role="img"
      aria-label="EduPlop"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="eduplop-grad" x1="0" y1="0" x2="1" y2="1">
          {/* shimmer: el degradado azul→rojo gira suavemente */}
          <animate attributeName="x1" values="0;0.35;0" dur="6s" repeatCount="indefinite" />
          <animate attributeName="y1" values="0;0.2;0" dur="6s" repeatCount="indefinite" />
          <animate attributeName="x2" values="1;0.75;1" dur="6s" repeatCount="indefinite" />
          <stop offset="0" stopColor="#1f74ff" />
          <stop offset="0.55" stopColor="#8b35a6" />
          <stop offset="1" stopColor="#ee2630" />
        </linearGradient>
        {/* Anillo "e/C": cuadrado redondeado con hueco interior y boca a la derecha */}
        <mask id="eduplop-ring">
          <rect width="120" height="110" fill="black" />
          <rect x="6" y="13" width="108" height="84" rx="36" fill="white" />
          <rect x="32" y="37" width="90" height="36" rx="18" fill="black" />
          <rect x="88" y="39" width="40" height="32" fill="black" />
        </mask>
      </defs>

      {/* Marco con degradado */}
      <rect width="120" height="110" fill="url(#eduplop-grad)" mask="url(#eduplop-ring)" />

      {/* Maletín rojo centrado */}
      <g fill="none" stroke="#ee2630" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        {/* asa */}
        <path d="M50 42 v-6 a5 5 0 0 1 5-5 h10 a5 5 0 0 1 5 5 v6" />
      </g>
      <rect x="42" y="42" width="36" height="32" rx="7" fill="#ee2630" />
      {/* ranura/agarre blanco */}
      <rect x="51" y="53" width="18" height="8" rx="4" fill="#ffffff" />
    </svg>
  );
}

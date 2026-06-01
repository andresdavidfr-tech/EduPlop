/**
 * Barra de navegación por secciones dentro de un módulo. Renderiza un botón
 * por vista; el botón activo controla qué sección se muestra.
 */
export interface SectionDef {
  key: string;
  label: string;
  icon: string;
}

export function SectionNav({ views, active, onChange }: {
  views: SectionDef[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <nav className="section-nav span2" role="tablist" aria-label="Secciones del módulo">
      {views.map((v) => (
        <button
          key={v.key}
          role="tab"
          aria-selected={active === v.key}
          className={active === v.key ? "sec-btn active" : "sec-btn"}
          onClick={() => onChange(v.key)}
        >
          <span className="sec-ico" aria-hidden="true">{v.icon}</span>
          <span>{v.label}</span>
        </button>
      ))}
    </nav>
  );
}

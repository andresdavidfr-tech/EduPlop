# EduPlop
import { useState, useEffect } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PALETA DE COLORES DIVERSA Y PROFESIONAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PALETTE = {
  // Primary Blues
  navy: "#0A3A52",
  sky: "#2B5F7F",
  blue: "#3B82F6",
  lightBlue: "#E0F2FE",
  
  // Greens
  emerald: "#10B981",
  teal: "#14B8A6",
  lightGreen: "#D1FAE5",
  
  // Purples
  purple: "#8B5CF6",
  violet: "#7C3AED",
  lightPurple: "#F3E8FF",
  
  // Oranges & Warm
  orange: "#F59E0B",
  amber: "#FBBF24",
  lightOrange: "#FEF3C7",
  
  // Pinks & Coral
  rose: "#F43F5E",
  coral: "#FF6B6B",
  lightRose: "#FFE4E6",
  
  // Neutrals
  white: "#FFFFFF",
  surface: "#F8FAFC",
  border: "#CBD5E1",
  text: "#1E293B",
  muted: "#64748B",
  
  // Semantic
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');
`;

const ANIMATIONS = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 0 0 currentColor; }
    50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.1); }
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    75% { transform: translateX(2px); }
  }
  
  .slide-in { animation: slideIn 0.3s ease; }
  .pulse { animation: pulse 2s ease-in-out infinite; }
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Icon({ name, size = 20, color = "currentColor" }) {
  const icons = {
    dashboard: <path d="M3 13h2v8H3zm4-8h2v16H7zm4-2h2v18h-2zm4-2h2v20h-2zm4 4h2v16h-2zm4-4h2v20h-2z" fill={color} />,
    users: <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill={color} />,
    calendar: <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" fill={color} />,
    bell: <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill={color} />,
    settings: <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.64l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.25-.41-.5-.41h-3.84c-.25 0-.46.17-.49.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.22-.07.49.12.64l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.64l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.25.41.5.41h3.84c.25 0 .46-.17.49-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.64l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill={color} />,
    check: <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill={color} />,
    logout: <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" fill={color} />,
    message: <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" fill={color} />,
    home: <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill={color} />,
    file: <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" fill={color} />,
  };
  
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
      {icons[name] || icons.dashboard}
    </svg>
  );
}

function Button({ 
  label, 
  onClick, 
  variant = "primary", 
  fullWidth = false, 
  size = "md",
  icon: IconComp,
  disabled = false,
  style = {}
}) {
  const variants = {
    primary: {
      bg: `linear-gradient(135deg, ${PALETTE.blue} 0%, ${PALETTE.purple} 100%)`,
      color: PALETTE.white,
      hover: "0 8px 20px rgba(59, 130, 246, 0.25)",
    },
    secondary: {
      bg: PALETTE.lightBlue,
      color: PALETTE.blue,
      hover: `0 4px 12px rgba(59, 130, 246, 0.15)`,
    },
    success: {
      bg: `linear-gradient(135deg, ${PALETTE.emerald} 0%, ${PALETTE.teal} 100%)`,
      color: PALETTE.white,
      hover: "0 8px 20px rgba(16, 185, 129, 0.25)",
    },
    outline: {
      bg: "transparent",
      color: PALETTE.navy,
      hover: `0 2px 8px rgba(10, 58, 82, 0.08)`,
      border: `2px solid ${PALETTE.border}`,
    },
    danger: {
      bg: PALETTE.error,
      color: PALETTE.white,
      hover: "0 8px 20px rgba(239, 68, 68, 0.25)",
    },
  };

  const sizes = {
    sm: { padding: "8px 14px", fontSize: 13, height: "auto" },
    md: { padding: "12px 20px", fontSize: 14, height: "auto" },
    lg: { padding: "14px 28px", fontSize: 15, height: "auto" },
  };

  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...variants[variant],
        ...sizes[size],
        border: variants[variant].border || "none",
        borderRadius: 10,
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        width: fullWidth ? "100%" : "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: isHovered && !disabled ? variants[variant].hover : "0 2px 4px rgba(0, 0, 0, 0.05)",
        transform: isHovered && !disabled ? "translateY(-2px)" : "translateY(0)",
        ...style,
      }}
    >
      {IconComp}
      {label}
    </button>
  );
}

function Card({ children, hover = false, style = {}, bg = PALETTE.white }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: bg,
        borderRadius: 14,
        padding: "20px",
        border: `1px solid ${PALETTE.border}`,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: hover ? "pointer" : "default",
        boxShadow: isHovered && hover
          ? "0 12px 24px rgba(0, 0, 0, 0.08)"
          : "0 2px 8px rgba(0, 0, 0, 0.04)",
        transform: isHovered && hover ? "translateY(-4px)" : "translateY(0)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Header({ title, subtitle, logo }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, paddingBottom: 24, borderBottom: `1px solid ${PALETTE.border}` }}>
      {logo && (
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          background: PALETTE.lightBlue,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          border: `2px solid ${PALETTE.blue}`,
        }}>
          {logo}
        </div>
      )}
      <div>
        <h1 style={{
          margin: 0,
          fontSize: 32,
          fontWeight: 800,
          fontFamily: "'Sora', sans-serif",
          color: PALETTE.navy,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            margin: "6px 0 0",
            fontSize: 15,
            color: PALETTE.muted,
            fontWeight: 500,
          }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, unit, color = PALETTE.blue, icon: Icon }) {
  return (
    <Card style={{
      background: `linear-gradient(135deg, ${color}08 0%, ${color}04 100%)`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{
            margin: "0 0 8px",
            fontSize: 12,
            color: PALETTE.muted,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}>
            {label}
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color }}>{value}</span>
            {unit && <span style={{ fontSize: 14, color: PALETTE.muted, fontWeight: 500 }}>{unit}</span>}
          </div>
        </div>
        {Icon && (
          <div style={{
            color,
            opacity: 0.2,
            fontSize: 28,
            display: "flex",
            alignItems: "center",
          }}>
            {Icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FAMILIAS MODULE - CENTRO DE LA EXPERIENCIA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const mockNotices = [
  {
    id: 1,
    title: "Acto del 25 de Mayo",
    description: "Se realizará a las 10:00 en el patio principal. Traer uniforme completo.",
    date: "23 May",
    type: "institucional",
    color: PALETTE.blue,
    colorLight: PALETTE.lightBlue,
  },
  {
    id: 2,
    title: "Cambio en horario de Ed. Física",
    description: "La clase del jueves se adelanta a las 09:00",
    date: "20 May",
    type: "academico",
    color: PALETTE.emerald,
    colorLight: PALETTE.lightGreen,
  },
];

const mockStudents = [
  {
    id: 1,
    name: "Valentina García",
    grade: "5°A",
    avatar: "V",
    color: PALETTE.purple,
    attendance: 96,
    average: 8.5,
  },
  {
    id: 2,
    name: "Tomás Rodríguez",
    grade: "3°B",
    avatar: "T",
    color: PALETTE.orange,
    attendance: 92,
    average: 7.2,
  },
];

const mockMessages = [
  {
    id: 1,
    from: "Prof. Ana López",
    subject: "Tarea de Matemáticas",
    preview: "Mañana traer la tarea de fracciones resuelta.",
    time: "09:15",
    unread: true,
    color: PALETTE.purple,
  },
  {
    id: 2,
    from: "Dirección",
    subject: "Aviso importante",
    preview: "Se informa que el horario de salida mañana será a las 13:30",
    time: "Ayer",
    unread: false,
    color: PALETTE.blue,
  },
];

function FamiliasModule() {
  const [tab, setTab] = useState("inicio");
  const [schoolLogo, setSchoolLogo] = useState("📚");
  const [logoInput, setLogoInput] = useState("");

  const handleLogoUpload = () => {
    if (logoInput.trim()) {
      setSchoolLogo(logoInput);
      setLogoInput("");
    }
  };

  // ────── INICIO ──────
  if (tab === "inicio") {
    return (
      <div style={{ padding: "40px 28px" }}>
        <Header
          title="EduPlop"
          subtitle="Tu escuela en la palma de tu mano"
          logo={schoolLogo}
        />

        {/* Welcome section */}
        <Card style={{
          background: `linear-gradient(135deg, ${PALETTE.purple} 0%, ${PALETTE.violet} 100%)`,
          color: PALETTE.white,
          marginBottom: 32,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Hola, familia García</h2>
              <p style={{ margin: "8px 0 0", opacity: 0.9 }}>
                Todo está en orden. Tus hijos están asistiendo regularmente.
              </p>
            </div>
            <div style={{ fontSize: 40 }}>✨</div>
          </div>
        </Card>

        {/* Quick stats */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{
            margin: "0 0 16px",
            fontSize: 16,
            fontWeight: 700,
            color: PALETTE.text,
          }}>
            Resumen rápido
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <StatBox
              label="Mensajes"
              value="3"
              color={PALETTE.blue}
            />
            <StatBox
              label="Próximos eventos"
              value="2"
              color={PALETTE.rose}
            />
            <StatBox
              label="Asistencia promedio"
              value="94"
              unit="%"
              color={PALETTE.emerald}
            />
            <StatBox
              label="Promedio de calificaciones"
              value="7.9"
              color={PALETTE.orange}
            />
          </div>
        </div>

        {/* Children status */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{
            margin: "0 0 16px",
            fontSize: 16,
            fontWeight: 700,
            color: PALETTE.text,
          }}>
            Estado de tus hijos
          </h3>
          {mockStudents.map(student => (
            <Card key={student.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: student.color,
                    color: PALETTE.white,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    fontWeight: 800,
                  }}>
                    {student.avatar}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: PALETTE.text }}>
                      {student.name}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: PALETTE.muted }}>
                      {student.grade}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{
                    margin: 0,
                    fontSize: 12,
                    color: PALETTE.muted,
                    fontWeight: 600,
                  }}>
                    Asistencia
                  </p>
                  <p style={{
                    margin: "2px 0",
                    fontWeight: 800,
                    color: PALETTE.emerald,
                  }}>
                    {student.attendance}%
                  </p>
                  <p style={{
                    margin: 0,
                    fontSize: 12,
                    color: PALETTE.muted,
                    fontWeight: 600,
                  }}>
                    Promedio: {student.average}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Notices */}
        <div>
          <h3 style={{
            margin: "0 0 16px",
            fontSize: 16,
            fontWeight: 700,
            color: PALETTE.text,
          }}>
            Últimos comunicados
          </h3>
          {mockNotices.map(notice => (
            <Card key={notice.id} style={{
              marginBottom: 12,
              background: notice.colorLight,
              border: `1px solid ${notice.color}40`,
            }}>
              <div style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}>
                <div style={{
                  width: 8,
                  height: 8,
                  background: notice.color,
                  borderRadius: "50%",
                  marginTop: 6,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <p style={{
                    margin: 0,
                    fontWeight: 700,
                    color: PALETTE.text,
                    fontSize: 14,
                  }}>
                    {notice.title}
                  </p>
                  <p style={{
                    margin: "4px 0 8px",
                    fontSize: 13,
                    color: PALETTE.muted,
                  }}>
                    {notice.description}
                  </p>
                  <p style={{
                    margin: 0,
                    fontSize: 12,
                    color: notice.color,
                    fontWeight: 600,
                  }}>
                    {notice.date}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ────── MIS HIJOS ──────
  if (tab === "hijos") {
    return (
      <div style={{ padding: "40px 28px" }}>
        <Header
          title="Mis Hijos"
          subtitle="Seguimiento académico y asistencia"
          logo={schoolLogo}
        />

        {mockStudents.map(student => (
          <Card
            key={student.id}
            style={{ marginBottom: 16 }}
            hover={true}
          >
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: student.color,
                  color: PALETTE.white,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 800,
                }}>
                  {student.avatar}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: PALETTE.text }}>
                    {student.name}
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: PALETTE.muted }}>
                    {student.grade}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 12, background: PALETTE.lightGreen, borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: PALETTE.muted, fontWeight: 600 }}>
                    Asistencia
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: PALETTE.emerald }}>
                    {student.attendance}%
                  </p>
                </div>
                <div style={{ padding: 12, background: PALETTE.lightOrange, borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: PALETTE.muted, fontWeight: 600 }}>
                    Promedio
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: PALETTE.orange }}>
                    {student.average}
                  </p>
                </div>
              </div>

              <Button label="Ver detalle completo" fullWidth variant="secondary" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // ────── MENSAJES ──────
  if (tab === "mensajes") {
    return (
      <div style={{ padding: "40px 28px" }}>
        <Header
          title="Mensajes"
          subtitle="Comunicación con docentes"
          logo={schoolLogo}
        />

        {mockMessages.map(msg => (
          <Card key={msg.id} style={{ marginBottom: 12 }} hover={true}>
            <div style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: msg.color,
                color: PALETTE.white,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                flexShrink: 0,
              }}>
                {msg.from[0]}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={{ margin: 0, fontWeight: 700, color: PALETTE.text }}>
                    {msg.from}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: PALETTE.muted }}>
                    {msg.time}
                  </p>
                </div>
                <p style={{
                  margin: "2px 0 6px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: msg.color,
                }}>
                  {msg.subject}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  color: PALETTE.muted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {msg.preview}
                </p>
              </div>
              {msg.unread && (
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: msg.color,
                  flexShrink: 0,
                }} />
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // ────── DOCUMENTOS ──────
  if (tab === "documentos") {
    return (
      <div style={{ padding: "40px 28px" }}>
        <Header
          title="Documentos"
          subtitle="Boletines, permiso de retiro, constancias"
          logo={schoolLogo}
        />

        {[
          { name: "Boletín Mayo 2025", date: "25 May", type: "Calificaciones" },
          { name: "Autorización de Retiro - Valentina", date: "20 May", type: "Permiso" },
          { name: "Constancia de Alumno Regular", date: "15 May", type: "Certificado" },
        ].map((doc, i) => (
          <Card key={i} style={{ marginBottom: 12 }} hover={true}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: PALETTE.lightBlue,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: PALETTE.blue,
              }}>
                <Icon name="file" size={22} color={PALETTE.blue} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, color: PALETTE.text }}>
                  {doc.name}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: PALETTE.muted }}>
                  {doc.type} • {doc.date}
                </p>
              </div>
              <Button variant="outline" size="sm" label="Descargar" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // ────── CONFIGURACIÓN ──────
  if (tab === "configuracion") {
    return (
      <div style={{ padding: "40px 28px" }}>
        <Header title="Configuración" subtitle="Personaliza tu experiencia" logo={schoolLogo} />

        <Card style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: PALETTE.navy }}>
            Logo de tu Escuela
          </h3>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: PALETTE.muted }}>
            Ingresa un emoji o carácter que represente tu institución
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              maxLength="2"
              placeholder="📚"
              value={logoInput}
              onChange={(e) => setLogoInput(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 14px",
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 10,
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
              }}
            />
            <Button
              label="Actualizar"
              onClick={handleLogoUpload}
              variant="primary"
              icon={<Icon name="check" size={16} color={PALETTE.white} />}
            />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: PALETTE.muted }}>
            Logo actual: <strong>{schoolLogo}</strong>
          </p>
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: PALETTE.navy }}>
            Opciones generales
          </h3>
          {[
            { label: "Notificaciones push", enabled: true },
            { label: "Email semanal", enabled: true },
            { label: "Alertas de asistencia", enabled: false },
          ].map((option, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              borderBottom: i < 2 ? `1px solid ${PALETTE.border}` : "none",
            }}>
              <p style={{ margin: 0, fontWeight: 600, color: PALETTE.text }}>
                {option.label}
              </p>
              <input type="checkbox" defaultChecked={option.enabled} style={{
                width: 20,
                height: 20,
                cursor: "pointer",
              }} />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DIRECTIVO & DOCENTE MODULES (Simplified)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DirectivoModule() {
  return (
    <div style={{ padding: "40px 28px" }}>
      <Header title="Panel Directivo" subtitle="Control de la institución" />
      <Card style={{
        background: `linear-gradient(135deg, ${PALETTE.blue} 0%, ${PALETTE.purple} 100%)`,
        color: PALETTE.white,
        marginBottom: 24,
      }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Módulo en desarrollo</h2>
        <p style={{ margin: 0, opacity: 0.9 }}>Funcionalidades completas en la plataforma principal</p>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <StatBox label="Docentes" value="18" color={PALETTE.blue} />
        <StatBox label="Alumnos" value="245" color={PALETTE.emerald} />
        <StatBox label="Cursos" value="12" color={PALETTE.purple} />
        <StatBox label="Asistencia Hoy" value="94" unit="%" color={PALETTE.orange} />
      </div>
    </div>
  );
}

function DocenteModule() {
  return (
    <div style={{ padding: "40px 28px" }}>
      <Header title="Panel Docente" subtitle="Gestión de clase" />
      <Card style={{
        background: `linear-gradient(135deg, ${PALETTE.emerald} 0%, ${PALETTE.teal} 100%)`,
        color: PALETTE.white,
        marginBottom: 24,
      }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>5°A Matemáticas</h2>
        <p style={{ margin: 0, opacity: 0.9 }}>Prof. Ana López</p>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <StatBox label="Total Alumnos" value="28" color={PALETTE.purple} />
        <StatBox label="Presentes Hoy" value="26" color={PALETTE.emerald} />
        <StatBox label="Ausentes" value="2" color={PALETTE.rose} />
        <StatBox label="Promedio" value="7.9" color={PALETTE.orange} />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN APP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function App() {
  const [role, setRole] = useState(null);
  const [tab, setTab] = useState("inicio");

  if (!role) {
    return (
      <div style={{
        fontFamily: "'Inter', sans-serif",
        background: `linear-gradient(135deg, ${PALETTE.surface} 0%, ${PALETTE.lightBlue} 100%)`,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}>
        <style>{FONTS}{ANIMATIONS}</style>
        <div style={{ maxWidth: 500, width: "100%" }}>
          <div style={{ marginBottom: 40, textAlign: "center" }}>
            <div style={{
              fontSize: 60,
              marginBottom: 16,
              animation: "slideIn 0.6s ease 0.2s both",
            }}>
              📚
            </div>
            <h1 style={{
              margin: "0 0 8px",
              fontSize: 40,
              fontWeight: 800,
              fontFamily: "'Sora', sans-serif",
              color: PALETTE.navy,
              animation: "slideIn 0.6s ease 0.3s both",
            }}>
              EduPlop
            </h1>
            <p style={{
              margin: 0,
              fontSize: 16,
              color: PALETTE.muted,
              fontWeight: 500,
              animation: "slideIn 0.6s ease 0.4s both",
            }}>
              Tu escuela en la palma de tu mano
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Button
              label="Acceso Familia"
              onClick={() => { setRole("familia"); setTab("inicio"); }}
              variant="primary"
              fullWidth
              size="lg"
              icon={<Icon name="home" size={18} color={PALETTE.white} />}
              style={{
                animation: "slideIn 0.6s ease 0.5s both",
              }}
            />
            <Button
              label="Acceso Docente"
              onClick={() => { setRole("docente"); setTab("inicio"); }}
              variant="secondary"
              fullWidth
              size="lg"
              icon={<Icon name="calendar" size={18} color={PALETTE.blue} />}
              style={{
                animation: "slideIn 0.6s ease 0.6s both",
              }}
            />
            <Button
              label="Acceso Directivo"
              onClick={() => { setRole("directivo"); setTab("inicio"); }}
              variant="outline"
              fullWidth
              size="lg"
              icon={<Icon name="settings" size={18} color={PALETTE.navy} />}
              style={{
                animation: "slideIn 0.6s ease 0.7s both",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const tabs = role === "familia"
    ? [
        { id: "inicio", label: "Inicio", icon: "home" },
        { id: "hijos", label: "Mis Hijos", icon: "users" },
        { id: "mensajes", label: "Mensajes", icon: "message" },
        { id: "documentos", label: "Documentos", icon: "file" },
        { id: "configuracion", label: "Config", icon: "settings" },
      ]
    : [];

  return (
    <div style={{
      fontFamily: "'Inter', sans-serif",
      background: PALETTE.surface,
      minHeight: "100vh",
      maxWidth: role === "familia" ? "100%" : 1400,
      margin: "0 auto",
    }}>
      <style>{FONTS}{ANIMATIONS}</style>

      <div style={{ display: "flex" }}>
        {/* Sidebar */}
        {role === "familia" && (
          <div style={{
            width: 280,
            background: PALETTE.white,
            borderRight: `1px solid ${PALETTE.border}`,
            padding: "28px 20px",
            position: "fixed",
            height: "100vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}>
            <h2 style={{
              margin: "0 0 28px",
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "'Sora', sans-serif",
              color: PALETTE.navy,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ fontSize: 28 }}>📚</span>
              EduPlop
            </h2>

            <div style={{ flex: 1 }}>
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    width: "100%",
                    background: tab === t.id ? `linear-gradient(135deg, ${PALETTE.blue}20 0%, ${PALETTE.purple}20 100%)` : "transparent",
                    border: "none",
                    padding: "12px 14px",
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    marginBottom: 8,
                    color: tab === t.id ? PALETTE.navy : PALETTE.muted,
                    fontSize: 14,
                    fontWeight: tab === t.id ? 700 : 500,
                    transition: "all 0.3s ease",
                    borderLeft: tab === t.id ? `4px solid ${PALETTE.blue}` : "4px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = tab === t.id ? `linear-gradient(135deg, ${PALETTE.blue}20 0%, ${PALETTE.purple}20 100%)` : PALETTE.lightBlue;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = tab === t.id ? `linear-gradient(135deg, ${PALETTE.blue}20 0%, ${PALETTE.purple}20 100%)` : "transparent";
                  }}
                >
                  <Icon name={t.icon} size={18} color={tab === t.id ? PALETTE.blue : PALETTE.muted} />
                  {t.label}
                </button>
              ))}
            </div>

            <Button
              label="Salir"
              onClick={() => setRole(null)}
              variant="outline"
              fullWidth
              icon={<Icon name="logout" size={16} color={PALETTE.navy} />}
            />
          </div>
        )}

        {/* Main Content */}
        <div style={{
          marginLeft: role === "familia" ? 280 : 0,
          flex: 1,
          overflow: "auto",
          minHeight: "100vh",
        }}>
          {role === "familia" && <FamiliasModule />}
          {role === "docente" && <DocenteModule />}
          {role === "directivo" && <DirectivoModule />}
        </div>
      </div>
    </div>
  );
}

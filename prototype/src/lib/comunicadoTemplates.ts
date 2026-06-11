/**
 * Asistente de redacción (local) para comunicados de Dirección y avisos de
 * docentes: modelos por motivo + sugeridor predictivo según lo que se escribe.
 * Pensado para luego poder delegarse a un LLM (Claude) conservando la interfaz.
 */
export interface ComTemplate {
  id: string;
  emoji: string;
  label: string;
  keywords: string[];
  role?: "family" | "teacher" | "director"; // para sesgar sugerencias
  title: string;
  body: string;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const COM_TEMPLATES: ComTemplate[] = [
  {
    id: "reunion", emoji: "👥", label: "Reunión de familias",
    keywords: ["reunion", "reunión", "padres", "familias", "encuentro"],
    title: "Reunión de familias",
    body: "Estimadas familias:\n\nLos invitamos a la reunión de [sala/curso] que se realizará el [día] a las [hora] en [lugar]. Compartiremos el seguimiento del período y los próximos proyectos.\n\nAgradecemos la confirmación de asistencia.\n\nSaludos cordiales,\nEquipo del Colegio San Martín.",
  },
  {
    id: "acto", emoji: "🎉", label: "Acto escolar",
    keywords: ["acto", "efemeride", "efeméride", "patrio", "celebracion", "fiesta"],
    title: "Acto escolar",
    body: "Estimadas familias:\n\nLos esperamos en el acto en conmemoración de [fecha/efeméride], el [día] a las [hora] en [lugar]. Los niños/as participarán con [actividad].\n\n¡Los esperamos para compartir este momento!\n\nSaludos,\nColegio San Martín.",
  },
  {
    id: "suspension", emoji: "⛔", label: "Suspensión de clases",
    keywords: ["suspension", "suspensión", "sin clases", "paro", "clima", "feriado", "asueto"],
    title: "Suspensión de actividades",
    body: "Estimadas familias:\n\nLes informamos que el día [día] no habrá actividades por [motivo]. Las clases se retomarán con normalidad el [día].\n\nDisculpen las molestias.\n\nDirección.",
  },
  {
    id: "salida", emoji: "🚌", label: "Salida didáctica",
    keywords: ["salida", "excursion", "excursión", "paseo", "visita", "museo"],
    title: "Salida didáctica",
    body: "Estimadas familias:\n\nEl [día] realizaremos una salida didáctica a [lugar]. Salimos a las [hora] y regresamos aproximadamente a las [hora].\n\nPor favor enviar: autorización firmada, vianda y [otros]. El costo es de [monto].\n\n¡Gracias!\n[Docente/Sala].",
  },
  {
    id: "materiales", emoji: "🎒", label: "Pedido de materiales",
    keywords: ["materiales", "utiles", "útiles", "traer", "lista", "elementos"],
    role: "teacher",
    title: "Materiales para la semana",
    body: "Hola familias:\n\nPara las actividades de esta semana, les pedimos que [nombre] traiga: [materiales]. Lo necesitamos para el día [día].\n\n¡Muchas gracias por acompañar!\n[Docente].",
  },
  {
    id: "salud", emoji: "🩺", label: "Aviso de salud",
    keywords: ["salud", "vacuna", "vacunacion", "vacunación", "pediculosis", "control", "certificado", "alergia"],
    title: "Aviso de salud",
    body: "Estimadas familias:\n\nLes recordamos la importancia de [tema de salud]. Solicitamos presentar [documentación] antes del [día].\n\nAnte cualquier consulta, estamos a disposición.\n\nEquipo del Colegio.",
  },
  {
    id: "administrativo", emoji: "🧾", label: "Recordatorio administrativo",
    keywords: ["cuota", "pago", "arancel", "administrativo", "documentacion", "documentación", "recordatorio", "vencimiento"],
    title: "Recordatorio administrativo",
    body: "Estimadas familias:\n\nLes recordamos que el [día] vence [concepto]. Pueden regularizarlo a través de [medio].\n\nMuchas gracias.\nAdministración.",
  },
  {
    id: "felicitacion", emoji: "💛", label: "Agradecimiento / felicitación",
    keywords: ["gracias", "agradecimiento", "felicitaciones", "logro", "orgullo"],
    title: "¡Gracias por acompañar!",
    body: "Estimadas familias:\n\nQueremos agradecerles por [motivo]. Fue un éxito gracias al compromiso de todos.\n\n¡Seguimos construyendo comunidad!\nColegio San Martín.",
  },
];

/**
 * Sugiere modelos ordenados por afinidad con el texto escrito (motivo/título).
 * Si no hay texto, devuelve los más comunes (sesgados por rol).
 */
export function suggestComTemplates(query: string, role?: string, limit = 4): ComTemplate[] {
  const q = norm(query.trim());
  const scored = COM_TEMPLATES.map((t) => {
    let score = 0;
    if (q) {
      for (const k of t.keywords) if (q.includes(norm(k)) || norm(k).includes(q)) score += 2;
      if (norm(t.label).includes(q)) score += 1;
    }
    if (t.role && t.role === role) score += 0.5; // leve preferencia por rol
    return { t, score };
  });
  const anyMatch = scored.some((s) => s.score >= 2);
  return scored
    .filter((s) => (anyMatch ? s.score >= 2 : true))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.t);
}

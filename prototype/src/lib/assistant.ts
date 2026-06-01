import { store } from "./store";
import { STUDENTS, GUARDIANS, GUARDIANSHIPS } from "./seed";
import type { User } from "./types";

export interface AssistantReply {
  text: string;
  suggestions?: string[];
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function has(q: string, ...kw: string[]) {
  return kw.some((k) => q.includes(k));
}

function familyStudents(user: User) {
  if (user.role === "family" && user.guardianId) {
    const ids = GUARDIANSHIPS.filter((g) => g.guardianId === user.guardianId).map((g) => g.studentId);
    return STUDENTS.filter((s) => ids.includes(s.id));
  }
  return STUDENTS;
}

function nextEventText(user: User) {
  const ev = store.agendaFor(user).find((e) => e.date >= new Date().toISOString().slice(0, 10));
  if (!ev) return "No hay eventos próximos en la agenda.";
  return `El próximo evento es **${ev.title}** el ${ev.date}${ev.time ? " a las " + ev.time : ""}. ${ev.description}`;
}

/**
 * Asistente contextual. Hoy resuelve intenciones localmente con los datos de la app.
 * En producción se conectaría a la Claude API (ver docs/08) conservando esta misma
 * interfaz y pasando el contexto del usuario como herramientas/datos.
 */
export function askAssistant(question: string, user: User): AssistantReply {
  const q = norm(question);

  if (has(q, "hola", "buenas", "buen dia", "buenos dias")) {
    return {
      text: `¡Hola ${user.name.split(" ")[0]}! Soy el asistente de EduPlop. ¿En qué te ayudo?`,
      suggestions: defaultSuggestions(user),
    };
  }

  if (has(q, "ayuda", "que pod", "que sab", "que hac", "opciones")) {
    return { text: capabilities(user), suggestions: defaultSuggestions(user) };
  }

  // quién puede retirar
  if (has(q, "quien", "quienes") && has(q, "retir", "buscar", "pasar a buscar")) {
    if (user.role === "family") {
      const studs = familyStudents(user);
      const lines = studs.map((s) => {
        const ids = GUARDIANSHIPS.filter((g) => g.studentId === s.id).map((g) => g.guardianId);
        const people = GUARDIANS.filter((g) => ids.includes(g.id) && g.status === "active");
        return `• ${s.emoji} ${s.name}: ${people.map((p) => `${p.name} (${p.relation})`).join(", ")}`;
      });
      return { text: `Personas autorizadas a retirar:\n${lines.join("\n")}\n\nPodés agregar o quitar autorizados desde el módulo Familias.` };
    }
    return { text: "Cada familia gestiona sus autorizados. En Dirección podés ver y revocar personas en la lista de revocación." };
  }

  // generar pase / autorizar retiro
  if (has(q, "autoriz", "generar", "pase", "qr") && has(q, "retir", "salida", "pase", "qr")) {
    return {
      text: "Para autorizar un retiro: entrá a **Familias → Autorizar un retiro**, elegí al alumno/a y quién lo retira, y tocá *Generar pase*. Se crea un QR válido por unos minutos que se escanea en la puerta. ¿Querés que te lleve?",
      suggestions: ["¿Quién puede retirar?", "¿Es seguro el QR?"],
    };
  }

  // ¿lo retiraron hoy?
  if (has(q, "retir", "salio", "salida", "busc") && has(q, "hoy", "ya", "mi hij")) {
    const studs = familyStudents(user).map((s) => s.id);
    const today = store.getSnapshot().receipts.filter(
      (r) => studs.includes(r.studentId) && new Date(r.timestamp).toDateString() === new Date().toDateString()
    );
    if (today.length === 0) return { text: "Todavía no se registró ningún retiro hoy. Te avisaré apenas suceda. 🔔" };
    const lines = today.map((r) => {
      const s = STUDENTS.find((x) => x.id === r.studentId);
      const g = GUARDIANS.find((x) => x.id === r.authorizedId);
      return `• ${s?.name} fue retirado por ${g?.name} a las ${new Date(r.timestamp).toLocaleTimeString()}`;
    });
    return { text: `Retiros de hoy:\n${lines.join("\n")}` };
  }

  // agenda / próximo evento
  if (has(q, "agenda", "evento", "reunion", "acto", "cuando", "proxim", "calendario")) {
    return {
      text: nextEventText(user) + "\n\nVe toda la agenda en la sección **Agenda** y confirmá tu asistencia ahí.",
      suggestions: ["Justificar una falta", "Enviar mensaje al colegio"],
    };
  }

  // justificar falta / ausencia
  if (has(q, "falta", "ausen", "no va", "no ira", "enfermo", "justific")) {
    return {
      text: "Podés justificar una ausencia desde **Mensajes → Nuevo mensaje**, eligiendo la categoría *Justificar ausencia*. El colegio lo recibe al instante y te responde por el mismo hilo.",
      suggestions: ["Enviar mensaje al colegio", "¿Cuándo es la próxima reunión?"],
    };
  }

  // mensaje / hablar con el colegio
  if (has(q, "mensaje", "hablar", "contact", "escribir", "consulta", "permiso")) {
    return {
      text: "Para escribirle al colegio entrá a **Mensajes**, tocá *Nuevo mensaje*, elegí la categoría (consulta, permiso o ausencia) y enviá. Recibís la respuesta como notificación. 💬",
      suggestions: ["Justificar una falta", "¿Quién puede retirar?"],
    };
  }

  // seguridad del QR
  if (has(q, "segur", "seguro", "funciona el qr", "como funciona", "datos", "privac")) {
    return {
      text: "El pase es un código firmado digitalmente (Ed25519) que **no contiene datos personales** y **vence solo** en pocos minutos. En la puerta, el docente ve la foto y datos de quien retira para confirmar. Cada salida queda registrada de forma inalterable. 🔒",
    };
  }

  // resumen para colegio (docente/dirección)
  if (user.role !== "family" && has(q, "resumen", "cuanto", "hoy", "pendiente", "estado", "mensajes")) {
    const st = store.getSnapshot();
    const pickups = st.receipts.length;
    const openMsgs = store.conversationsFor(user).filter((c) => c.status === "open").length;
    const pendingSync = st.receipts.filter((r) => r.pendingSync).length;
    return {
      text: `Resumen de hoy:\n• Retiros registrados: ${pickups}\n• Mensajes de familias sin responder: ${openMsgs}\n• Salidas pendientes de sincronizar: ${pendingSync}\n• Incidentes abiertos: ${st.incidents.filter((i) => i.status === "open").length}`,
    };
  }

  return {
    text: "No estoy seguro de eso 🤔, pero puedo ayudarte con retiros, autorizados, agenda, faltas y mensajes con el colegio. Probá una de estas:",
    suggestions: defaultSuggestions(user),
  };
}

function defaultSuggestions(user: User): string[] {
  if (user.role === "family")
    return ["¿Quién puede retirar a mi hijo/a?", "¿Cuándo es la próxima reunión?", "Justificar una falta", "¿Lo retiraron hoy?"];
  return ["Resumen de hoy", "Mensajes pendientes", "¿Cómo creo un evento?", "¿Cómo registro un retiro manual?"];
}

function capabilities(user: User): string {
  if (user.role === "family")
    return "Puedo ayudarte a: autorizar retiros y entender el pase QR, decirte quién puede retirar a tus hijos, ver la agenda y próximas reuniones, justificar faltas y escribirle al colegio. 😊";
  return "Puedo darte un resumen del día, mostrarte mensajes pendientes de familias, y guiarte para crear eventos de agenda o registrar retiros manuales.";
}

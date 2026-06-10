/**
 * Análisis asistido de nóminas/matrículas: toma texto libre (pegado de una
 * planilla, lista de WhatsApp, etc.) y lo estructura en filas de alumnos o
 * docentes, infiriendo DNI, sala y rol. Es heurístico y 100% local (sin enviar
 * datos a ningún servidor); pensado para que Dirección revise antes de dar de
 * alta. La misma interfaz puede delegarse a un LLM (Claude) vía proxy.
 */

export interface ParsedRow {
  id: string;
  type: "student" | "teacher";
  name: string;
  document: string;
  salaId: string;
  emoji: string;
  notes: string[]; // avisos: "sin DNI", "sala no reconocida", "posible duplicado"
}

export interface SalaRef { id: string; name: string }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const TEACHER_HINTS = ["docente", "docentes", "profe", "profesor", "profesora", "prof", "maestro", "maestra", "seño", "señorita", "nomina", "nómina", "personal"];
const STUDENT_HINTS = ["alumno", "alumnos", "alumna", "alumnas", "estudiante", "estudiantes", "matricula", "matrícula", "chicos", "niños", "nenes"];
const LABEL_WORDS = ["dni", "documento", "doc", "sala", "turno", "curso", "grado", "nombre", "apellido", "alumno", "alumna", "docente", "profe", "profesor", "profesora", "maestro", "maestra", "seño", "prof"];

/** Formatea 7-8 dígitos como 12.345.678 */
function fmtDoc(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 7 || d.length > 8) return d;
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Detecta y extrae un DNI del texto; devuelve [docFormateado, textoSinDoc]. */
function extractDoc(line: string): [string, string] {
  // secuencias de 7-8 dígitos con o sin puntos/espacios
  const m = line.match(/\b\d{1,3}[.\s]?\d{3}[.\s]?\d{3}\b/);
  if (m) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 8) {
      return [fmtDoc(digits), line.replace(m[0], " ")];
    }
  }
  return ["", line];
}

/** Empareja una sala por nombre dentro del texto. */
function matchSala(line: string, salas: SalaRef[]): [string, string] {
  const nl = norm(line);
  for (const s of salas) {
    const ns = norm(s.name);
    if (ns && nl.includes(ns)) {
      // saca el nombre de la sala del texto (para no dejarlo en el nombre)
      const re = new RegExp(s.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      return [s.id, line.replace(re, " ")];
    }
  }
  return ["", line];
}

function guessEmoji(name: string): string {
  const first = norm(name).split(/\s+/)[0] ?? "";
  if (/a$/.test(first)) return "👧";
  if (/[oe]$/.test(first)) return "👦";
  return "🧒";
}

function cleanName(line: string): string {
  let t = line;
  // saca etiquetas tipo "DNI:", "Sala:", "Docente:", etc.
  for (const w of LABEL_WORDS) {
    t = t.replace(new RegExp(`\\b${w}\\b\\s*:?`, "gi"), " ");
  }
  t = t.replace(/turno\s+(mañana|manana|tarde)/gi, " ");
  t = t.replace(/[•\-–·|;:,.]+/g, " ").replace(/\s+/g, " ").trim();
  // Title Case suave
  return t.split(" ").filter(Boolean).map((w) => w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(" ");
}

/** ¿La línea es solo un encabezado de sección? Devuelve el modo o null. */
function headerMode(line: string): "student" | "teacher" | null {
  const n = norm(line).replace(/[:#\-\s]+$/g, "").trim();
  if (TEACHER_HINTS.includes(n)) return "teacher";
  if (STUDENT_HINTS.includes(n)) return "student";
  return null;
}

let counter = 0;
const rowId = () => `row_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export function parseRoster(text: string, salas: SalaRef[], existingDocs: string[] = []): ParsedRow[] {
  const docs = new Set(existingDocs.map((d) => d.replace(/\D/g, "")));
  const rows: ParsedRow[] = [];
  let mode: "student" | "teacher" = "student";

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const hm = headerMode(line);
    if (hm) { mode = hm; continue; }

    const nl = norm(line);
    // rol por línea: si menciona explícitamente docente/profe/seño
    let type: "student" | "teacher" = mode;
    if (TEACHER_HINTS.some((h) => nl.includes(h))) type = "teacher";
    else if (STUDENT_HINTS.some((h) => nl.includes(h))) type = "student";

    const notes: string[] = [];
    let rest = line;
    const [doc, afterDoc] = extractDoc(rest); rest = afterDoc;
    const [salaId, afterSala] = matchSala(rest, salas); rest = afterSala;
    const name = cleanName(rest);
    if (!name) continue; // línea sin nombre aprovechable

    if (type === "student") {
      if (!doc) notes.push("sin DNI");
      else if (docs.has(doc.replace(/\D/g, ""))) notes.push("posible duplicado");
      if (!salaId) notes.push("sala sin reconocer");
      docs.add(doc.replace(/\D/g, ""));
    }

    rows.push({
      id: rowId(), type, name, document: type === "teacher" ? "" : doc,
      salaId: type === "teacher" ? "" : salaId, emoji: guessEmoji(name), notes,
    });
  }
  return rows;
}

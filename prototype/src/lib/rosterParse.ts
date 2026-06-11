/**
 * Análisis asistido de nóminas/matrículas: toma texto libre, CSV/TSV (de una
 * planilla exportada) o el contenido de un Excel, y lo estructura en filas de
 * salas, alumnos o docentes, infiriendo DNI, sala y rol. Heurístico y 100%
 * local (no envía datos a ningún servidor). La misma interfaz puede delegarse
 * a un LLM (Claude) vía proxy.
 */

export type RowType = "student" | "teacher" | "sala";
export type Turno = "mañana" | "tarde";

export interface ParsedRow {
  id: string;
  type: RowType;
  name: string;        // persona o nombre de sala
  document: string;    // alumnos
  salaId: string;      // sala existente emparejada (alumnos)
  salaName: string;    // texto de sala detectado (para crear si no existe)
  turno: Turno;        // salas
  emoji: string;       // alumnos
  notes: string[];
}

export interface SalaRef { id: string; name: string }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const TEACHER_HINTS = ["docente", "docentes", "profe", "profesor", "profesora", "prof", "maestro", "maestra", "seño", "señorita", "nomina", "nómina", "personal", "plantel"];
const STUDENT_HINTS = ["alumno", "alumnos", "alumna", "alumnas", "estudiante", "estudiantes", "matricula", "matrícula", "chicos", "ninos", "niños", "nenes"];
const SALA_HINTS = ["sala", "salas", "curso", "cursos", "grado", "grados", "division", "divisiones", "seccion", "secciones", "aula", "aulas"];
const LABEL_WORDS = ["dni", "documento", "doc", "sala", "turno", "curso", "grado", "nombre", "apellido", "alumno", "alumna", "docente", "profe", "profesor", "profesora", "maestro", "maestra", "seño", "prof"];

function fmtDoc(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 7 || d.length > 8) return d;
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function extractDoc(line: string): [string, string] {
  const m = line.match(/\b\d{1,3}[.\s]?\d{3}[.\s]?\d{3}\b/);
  if (m) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 8) return [fmtDoc(digits), line.replace(m[0], " ")];
  }
  return ["", line];
}
function matchSala(text: string, salas: SalaRef[]): { id: string; name: string; rest: string } {
  const nl = norm(text);
  for (const s of salas) {
    const ns = norm(s.name);
    if (ns && nl.includes(ns)) {
      const re = new RegExp(s.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      return { id: s.id, name: s.name, rest: text.replace(re, " ") };
    }
  }
  return { id: "", name: "", rest: text };
}
function guessEmoji(name: string): string {
  const first = norm(name).split(/\s+/)[0] ?? "";
  if (/a$/.test(first)) return "👧";
  if (/[oe]$/.test(first)) return "👦";
  return "🧒";
}
function cleanName(line: string): string {
  let t = line;
  for (const w of LABEL_WORDS) t = t.replace(new RegExp(`\\b${w}\\b\\s*:?`, "gi"), " ");
  t = t.replace(/turno\s+(mañana|manana|tarde)/gi, " ");
  t = t.replace(/[•\-–·|;:,.]+/g, " ").replace(/\s+/g, " ").trim();
  return t.split(" ").filter(Boolean).map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ");
}
function parseTurno(text: string): Turno { return /tarde/i.test(norm(text)) ? "tarde" : "mañana"; }
function headerMode(line: string): RowType | null {
  const n = norm(line).replace(/[:#\-\s]+$/g, "").trim();
  if (TEACHER_HINTS.includes(n)) return "teacher";
  if (STUDENT_HINTS.includes(n)) return "student";
  if (SALA_HINTS.includes(n)) return "sala";
  return null;
}

// --- CSV / delimitado ---
function detectDelimiter(line: string): string | null {
  for (const d of [";", "\t", ","]) if (line.split(d).length >= 2) return d;
  return null;
}
function splitCells(line: string, delim: string): string[] {
  return line.split(delim).map((c) => c.replace(/^["']|["']$/g, "").trim());
}
interface ColMap { nombre?: number; apellido?: number; name?: number; doc?: number; sala?: number; turno?: number; type?: number; emoji?: number }
function parseHeader(cells: string[]): ColMap | null {
  const map: ColMap = {};
  cells.forEach((c, i) => {
    const n = norm(c);
    if (/apellido/.test(n)) map.apellido = i;
    else if (/nombre|alumno|alumna|estudiante|completo|docente|persona/.test(n) && map.name === undefined) map.name = i;
    if (/dni|documento|^doc\b|matricula/.test(n)) map.doc = i;
    if (/sala|curso|grado|divisi|secci|aula/.test(n)) map.sala = i;
    if (/turno/.test(n)) map.turno = i;
    if (/tipo|rol/.test(n)) map.type = i;
    if (/emoji|icono/.test(n)) map.emoji = i;
  });
  const hasName = map.name !== undefined || map.apellido !== undefined || map.nombre !== undefined;
  const hasOther = map.doc !== undefined || map.sala !== undefined || map.turno !== undefined || map.type !== undefined;
  return hasName && hasOther ? map : null;
}
function typeFromCell(v: string, fallback: RowType): RowType {
  const n = norm(v);
  if (TEACHER_HINTS.some((h) => n.includes(h))) return "teacher";
  if (SALA_HINTS.some((h) => n.includes(h))) return "sala";
  if (STUDENT_HINTS.some((h) => n.includes(h))) return "student";
  return fallback;
}

let counter = 0;
const rowId = () => `row_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export function parseRoster(text: string, salas: SalaRef[], existingDocs: string[] = []): ParsedRow[] {
  const docs = new Set(existingDocs.map((d) => d.replace(/\D/g, "")));
  const rows: ParsedRow[] = [];
  let mode: RowType = "student";
  let col: ColMap | null = null;
  let delim: string | null = null;

  const pushStudent = (name: string, document: string, salaId: string, salaName: string, emoji?: string) => {
    const notes: string[] = [];
    const digits = document.replace(/\D/g, "");
    if (!document) notes.push("sin DNI");
    else if (docs.has(digits)) notes.push("posible duplicado");
    if (!salaId && !salaName) notes.push("sala sin reconocer");
    docs.add(digits);
    rows.push({ id: rowId(), type: "student", name, document, salaId, salaName, turno: "mañana", emoji: emoji || guessEmoji(name), notes });
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const hm = headerMode(line);
    if (hm) { mode = hm; col = null; delim = null; continue; }

    // ¿encabezado de columnas CSV?
    const d = detectDelimiter(line);
    if (d) {
      const cells = splitCells(line, d);
      const maybe = parseHeader(cells);
      if (maybe) { col = maybe; delim = d; continue; }
    }

    // fila CSV con columnas mapeadas
    if (col && delim && line.includes(delim)) {
      const c = splitCells(line, delim);
      const get = (i?: number) => (i !== undefined ? (c[i] ?? "").trim() : "");
      let name = get(col.name);
      if (col.apellido !== undefined) name = `${get(col.name)} ${get(col.apellido)}`.trim();
      if (!name) name = c.find((x) => x && !/^\d/.test(x)) ?? "";
      const type = col.type !== undefined ? typeFromCell(get(col.type), mode) : mode;
      if (!name.trim()) continue;
      if (type === "teacher") { rows.push({ id: rowId(), type: "teacher", name: name.trim(), document: "", salaId: "", salaName: "", turno: "mañana", emoji: "", notes: [] }); continue; }
      if (type === "sala") {
        const sname = get(col.sala) || name;
        rows.push({ id: rowId(), type: "sala", name: sname.trim(), document: "", salaId: "", salaName: "", turno: parseTurno(get(col.turno)), emoji: "", notes: [] });
        continue;
      }
      const salaRaw = get(col.sala);
      const sm = salaRaw ? matchSala(salaRaw, salas) : { id: "", name: "" };
      pushStudent(name.trim(), fmtDoc(get(col.doc)), sm.id, sm.id ? "" : salaRaw, get(col.emoji));
      continue;
    }

    // --- texto libre (heurístico) ---
    const nl = norm(line);
    let type: RowType = mode;
    if (TEACHER_HINTS.some((h) => nl.includes(h))) type = "teacher";
    else if (mode !== "sala" && STUDENT_HINTS.some((h) => nl.includes(h))) type = "student";

    if (type === "sala") {
      const turno = parseTurno(line);
      const name = cleanName(line.replace(/turno/gi, " ").replace(/\b(ma[ñn]ana|tarde)\b/gi, " "));
      if (name) rows.push({ id: rowId(), type: "sala", name, document: "", salaId: "", salaName: "", turno, emoji: "", notes: [] });
      continue;
    }
    if (type === "teacher") {
      const name = cleanName(line);
      if (name) rows.push({ id: rowId(), type: "teacher", name, document: "", salaId: "", salaName: "", turno: "mañana", emoji: "", notes: [] });
      continue;
    }
    // alumno
    let rest = line;
    const [doc, afterDoc] = extractDoc(rest); rest = afterDoc;
    const sm = matchSala(rest, salas); rest = sm.rest;
    const name = cleanName(rest);
    if (!name) continue;
    pushStudent(name, doc, sm.id, "");
  }
  return rows;
}

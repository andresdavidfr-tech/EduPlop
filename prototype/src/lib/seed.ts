import type { Student, Guardian, Guardianship, User, Sala, MuralPost, Teacher } from "./types";

export const INSTITUTION = { id: "inst_8842", name: "Colegio San Martín" };

export const STUDENTS: Student[] = [
  { id: "stu_001", name: "Mía Fernández", document: "55.120.331", classroom: "Sala Verde", emoji: "👧" },
  { id: "stu_002", name: "Lucas Gómez", document: "55.880.114", classroom: "Sala Verde", emoji: "👦" },
  { id: "stu_003", name: "Valentina Ruiz", document: "56.001.902", classroom: "1° A", emoji: "👧🏽" },
  { id: "stu_004", name: "Benjamín Sosa", document: "56.210.477", classroom: "1° A", emoji: "🧒" },
];

export const GUARDIANS: Guardian[] = [
  { id: "guar_010", name: "Laura Fernández", document: "30.111.222", relation: "Madre", emoji: "👩", status: "active" },
  { id: "guar_011", name: "Marta Díaz", document: "12.345.678", relation: "Abuela", emoji: "👵", status: "active" },
  { id: "guar_020", name: "Diego Gómez", document: "28.900.555", relation: "Padre", emoji: "👨", status: "active" },
  { id: "guar_030", name: "Sofía Ruiz", document: "31.444.777", relation: "Madre", emoji: "👩🏽", status: "active" },
];

export const GUARDIANSHIPS: Guardianship[] = [
  { guardianId: "guar_010", studentId: "stu_001", role: "primary_guardian" },
  { guardianId: "guar_011", studentId: "stu_001", role: "authorized" },
  { guardianId: "guar_020", studentId: "stu_002", role: "primary_guardian" },
  { guardianId: "guar_030", studentId: "stu_003", role: "primary_guardian" },
  { guardianId: "guar_030", studentId: "stu_004", role: "primary_guardian" },
];

export const TEACHERS: Teacher[] = [
  { id: "teacher_119", name: "Doc. Pérez", classroom: "Sala Verde" },
  { id: "teacher_204", name: "Doc. Acosta", classroom: "1° A" },
];

// --- Estructura del establecimiento (editable por Dirección) ---
export const SALAS: Sala[] = [
  { id: "sala_verde", name: "Sala Verde", turno: "mañana", teacherId: "teacher_119" },
  { id: "sala_1a", name: "1° A", turno: "tarde", teacherId: "teacher_204" },
];
export const STUDENT_SALA: Record<string, string> = {
  stu_001: "sala_verde",
  stu_002: "sala_verde",
  stu_003: "sala_1a",
  stu_004: "sala_1a",
};
export const TEACHER_TASKS: Record<string, string> = {
  teacher_119: "Maestra de sala",
  teacher_204: "Maestra de sala",
};

export const DEVICE_ID = "dev_door_03";

// Cuentas de demostración (en producción: hash + backend de identidad / OIDC)
export const USERS: User[] = [
  { username: "familia", password: "familia123", role: "family", name: "Laura Fernández", guardianId: "guar_010" },
  { username: "docente", password: "docente123", role: "teacher", name: "Doc. Pérez", teacherId: "teacher_119" },
  { username: "direccion", password: "direccion123", role: "director", name: "Dirección — Colegio San Martín" },
];

/**
 * Cuentas demo para Supabase Auth (auth real). La primera vez se autoaprovisionan
 * (signup + perfil); luego es solo login. En producción las crea la escuela.
 */
export interface DemoAccount {
  email: string;
  username: string; // username estable que usa la app (coincide con los datos semilla)
  password: string;
  role: User["role"];
  name: string;
  guardianId?: string;
  teacherId?: string;
}
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "familia@eduplop.demo", username: "familia", password: "familia123", role: "family", name: "Laura Fernández", guardianId: "guar_010" },
  { email: "docente@eduplop.demo", username: "docente", password: "docente123", role: "teacher", name: "Doc. Pérez", teacherId: "teacher_119" },
  { email: "direccion@eduplop.demo", username: "direccion", password: "direccion123", role: "director", name: "Dirección — Colegio San Martín" },
];

export const ROLE_MODULES: Record<string, ("familias" | "docentes" | "directivo")[]> = {
  family: ["familias"],
  teacher: ["docentes"],
  director: ["familias", "docentes", "directivo"], // dirección supervisa todo
};

export const ROLE_LABEL: Record<string, string> = {
  family: "Familia",
  teacher: "Docente",
  director: "Dirección",
};

// Fotos de muestra para el Mural (placeholders estables de Picsum).
const photo = (seed: string, n = 1) =>
  Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/eduplop-${seed}-${i}/640/640`);

const HOUR = 3600000;

// Feed inicial del Mural: novedades publicadas por los docentes.
export const MURAL_POSTS: MuralPost[] = [
  {
    id: "post_001", authorName: "Seño Carla", authorAvatar: "👩‍🏫", salaId: "sala_verde", salaName: "Sala Verde",
    text: "¡Hoy plantamos en la huerta! 🌱 Cada peque cuidó su semillita. Gracias por mandar los delantales.",
    images: photo("huerta", 5), ts: Date.now() - 2 * HOUR,
    likedBy: ["direccion"],
    comments: [
      { id: "cm_1", fromUser: "direccion", fromName: "Dirección", body: "¡Hermosa actividad! 👏", ts: Date.now() - 1.5 * HOUR },
    ],
  },
  {
    id: "post_002", authorName: "Profe Martín", authorAvatar: "🧑‍🏫", salaId: "sala_1a", salaName: "1° A",
    text: "Cierre del proyecto de animales 🦁🐘. Quedaron geniales las maquetas. ¡Aplausos para todos!",
    images: photo("animales", 3), ts: Date.now() - 26 * HOUR,
    likedBy: [],
    comments: [],
  },
  {
    id: "post_003", authorName: "Dirección — Colegio San Martín", authorAvatar: "🏫",
    text: "📢 Reunión general de familias el próximo jueves a las 18 h en el SUM. ¡Los esperamos a todos!",
    images: photo("reunion", 1), ts: Date.now() - 3 * 24 * HOUR,
    likedBy: ["direccion"],
    comments: [],
  },
];

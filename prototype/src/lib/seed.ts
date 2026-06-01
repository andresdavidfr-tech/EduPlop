import type { Student, Guardian, Guardianship } from "./types";

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

export const TEACHERS = [
  { id: "teacher_119", name: "Doc. Pérez", classroom: "Sala Verde" },
  { id: "teacher_204", name: "Doc. Acosta", classroom: "1° A" },
];

export const DEVICE_ID = "dev_door_03";

/**
 * Plantillas descargables para la carga asistida. El formato coincide con lo
 * que entiende el parser (rosterParse): secciones Salas/Alumnos/Docentes con
 * encabezados de columnas.
 */

const SALAS = [["nombre", "turno"], ["2° B", "tarde"], ["3° A", "mañana"]];
const ALUMNOS = [
  ["apellido", "nombre", "dni", "sala"],
  ["Fernández", "Mía", "55.120.331", "Sala Verde"],
  ["Gómez", "Lucas", "55.880.114", "2° B"],
];
const DOCENTES = [["nombre"], ["Ana Gómez"], ["Martín Acosta"]];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvLine = (row: string[]) =>
  row.map((c) => (/[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",");

/** Plantilla CSV con secciones (un solo archivo). */
export function downloadCsvTemplate() {
  const lines = [
    "Salas:", ...SALAS.map(csvLine), "",
    "Alumnos:", ...ALUMNOS.map(csvLine), "",
    "Docentes:", ...DOCENTES.map(csvLine),
  ];
  // BOM para que Excel respete los acentos
  downloadBlob(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), "plantilla-eduplop.csv");
}

/** Plantilla Excel con una hoja por tipo (Salas / Alumnos / Docentes). */
export async function downloadXlsxTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(SALAS), "Salas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ALUMNOS), "Alumnos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(DOCENTES), "Docentes");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "plantilla-eduplop.xlsx"
  );
}

/**
 * Lee un archivo subido por Dirección y lo convierte a texto para el parser.
 * - CSV / TSV / TXT: se leen directo.
 * - Excel (.xlsx/.xls): se carga SheetJS de forma diferida y cada hoja se
 *   vuelca a CSV, anteponiendo el nombre de la hoja como encabezado de sección
 *   (así "Salas"/"Alumnos"/"Docentes" guían la clasificación).
 */
export async function readImportFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const parts: string[] = [];
    for (const sheet of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet]);
      if (!csv.trim()) continue;
      parts.push(sheet);   // encabezado de sección
      parts.push(csv);
    }
    return parts.join("\n");
  }
  return await file.text();
}

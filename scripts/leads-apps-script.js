/**
 * Google Apps Script — EduPlop Lead Capture
 *
 * Instrucciones de despliegue:
 * 1. Abrí la planilla: https://docs.google.com/spreadsheets/d/1dLHQEy7MOIY771-83u4F3heZQFYORQpGCCNfTfx85d0
 * 2. Extensiones → Apps Script → pegá este código
 * 3. Guardá el proyecto (ctrl+S)
 * 4. Implementar → Nueva implementación
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Quién tiene acceso: Cualquier usuario
 * 5. Copiá la URL de implementación (termina en /exec)
 * 6. En el proyecto EduPlop, creá el archivo prototype/.env.local con:
 *    VITE_LEADS_ENDPOINT=https://script.google.com/macros/s/TU_ID_AQUI/exec
 * 7. Redesplegá en Vercel (o ponela también en las variables de entorno del proyecto Vercel)
 */

const SHEET_NAME = "Prospectos"; // nombre de la hoja dentro de la planilla

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Crea la hoja con encabezados si no existe
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(["Timestamp", "Nombre", "Email", "Institución", "Rol"]);
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      data.ts ?? new Date().toISOString(),
      data.nombre ?? "",
      data.email ?? "",
      data.institucion ?? "",
      data.rol ?? "",
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Prueba manual desde el editor de Apps Script
function test_doPost() {
  const fake = { postData: { contents: JSON.stringify({ nombre: "Test", email: "test@test.com", institucion: "Colegio X", rol: "Director/a", ts: new Date().toISOString() }) } };
  const result = doPost(fake);
  Logger.log(result.getContent());
}

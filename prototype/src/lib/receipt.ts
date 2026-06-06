import type { PickupReceipt, Guardian } from "./types";
import { store } from "./store";
import { STUDENTS, TEACHERS, USERS, INSTITUTION } from "./seed";

/**
 * Genera un comprobante de retiro formal (documento HTML autocontenido,
 * imprimible a PDF) para el establecimiento educativo. Tono sobrio, con los
 * datos de la operación y su huella criptográfica.
 */

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const MODE_LABEL: Record<string, string> = {
  online: "En línea (validación autoritativa)",
  offline: "Diferida — sin conexión (reconciliada al sincronizar)",
  manual: "Manual — contingencia (sin QR)",
};

export function buildReceiptHtml(r: PickupReceipt, actorOverride?: Guardian, photoSrc?: string): string {
  const stu = STUDENTS.find((s) => s.id === r.studentId);
  const local = store.guardianById(r.authorizedId);
  const g = local ?? actorOverride;
  const photo = photoSrc ?? local?.photo ?? actorOverride?.photo;
  const teacher = TEACHERS.find((t) => t.id === r.validatedBy);
  const teacherUser = USERS.find((u) => u.teacherId === r.validatedBy);
  const teacherName = teacher?.name ?? teacherUser?.name ?? r.validatedBy;
  const dt = new Date(r.timestamp);
  const fecha = dt.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  const hora = dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const row = (label: string, value: string) =>
    `<tr><th>${esc(label)}</th><td>${value}</td></tr>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Comprobante de retiro ${esc(r.receiptId)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 32px; background: #f8fafc; }
  .doc { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 36px 40px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 16px; margin-bottom: 8px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -.5px; }
  .brand small { display: block; font-weight: 500; font-size: 12.5px; color: #64748b; letter-spacing: 0; }
  .doc h1 { font-size: 16px; text-transform: uppercase; letter-spacing: 1px; color: #334155; margin: 22px 0 4px; }
  .rid { text-align: right; font-size: 12px; color: #64748b; }
  .rid b { display: block; font-size: 13px; color: #1e293b; font-family: ui-monospace, monospace; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 18px; }
  th, td { text-align: left; padding: 9px 10px; font-size: 13.5px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
  th { width: 38%; color: #64748b; font-weight: 600; }
  td { color: #0f172a; }
  .mono { font-family: ui-monospace, "SF Mono", monospace; font-size: 11.5px; color: #475569; word-break: break-all; }
  .chip { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; background: #dcfce7; color: #166534; }
  .foot { margin-top: 22px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b; line-height: 1.55; }
  .sign { display: flex; justify-content: space-between; gap: 24px; margin-top: 40px; }
  .sign div { flex: 1; border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center; font-size: 12px; color: #64748b; }
  .photo-box { margin-top: 24px; text-align: center; }
  .photo-box img { width: 150px; height: 150px; object-fit: cover; border-radius: 12px; border: 2px solid #cbd5e1; }
  .photo-box small { display: block; margin-top: 8px; font-size: 11.5px; color: #64748b; }
  @media print { body { background: #fff; padding: 0; } .doc { border: none; } }
</style></head>
<body><div class="doc">
  <div class="head">
    <div class="brand">EduPlop<small>${esc(INSTITUTION.name)}</small></div>
    <div class="rid">Comprobante N.º<b>${esc(r.receiptId)}</b></div>
  </div>

  <h1>Comprobante de retiro</h1>
  <p style="margin:0 0 10px;font-size:13px;color:#475569">Constancia del retiro de un/a estudiante validado en el acceso del establecimiento.</p>

  <table>
    ${row("Fecha", esc(fecha))}
    ${row("Hora", esc(hora) + " hs")}
    ${row("Estudiante", `${esc(stu?.name ?? r.studentId)} — Doc. ${esc(stu?.document ?? "—")} · ${esc(stu?.classroom ?? "")}`)}
    ${row("Persona autorizada", `${esc(g?.name ?? r.authorizedId)} — Doc. ${esc(g?.document ?? "—")} · ${esc(g?.relation ?? "")}`)}
    ${row("Validado por", esc(teacherName))}
    ${row("Modalidad", esc(MODE_LABEL[r.mode] ?? r.mode))}
    ${row("Confirmación visual de identidad", r.visualConfirmed ? '<span class="chip">Sí</span>' : "No")}
    ${row("Dispositivo de validación", `<span class="mono">${esc(r.deviceId)}</span>`)}
  </table>

  <h1>Verificación criptográfica</h1>
  <table>
    ${row("Pase (token)", `<span class="mono">${esc(r.tokenJti)}</span>`)}
    ${row("Huella del comprobante", `<span class="mono">${esc(r.payloadHash)}</span>`)}
    ${row("Encadenamiento (prev_hash)", `<span class="mono">${esc(r.prevHash)}</span>`)}
    ${row("Firma del dispositivo (Ed25519)", `<span class="mono">${esc(r.deviceSignature)}</span>`)}
    ${r.serverSignature ? row("Co-firma de la institución (Ed25519)", `<span class="mono">${esc(r.serverSignature)}</span>`) : ""}
  </table>

  ${photo ? `<div class="photo-box">
    <img src="${esc(photo)}" alt="Foto de la persona autorizada" />
    <small>Foto de la persona autorizada registrada por la familia (${esc(g?.name ?? "")})</small>
  </div>` : ""}

  <div class="sign">
    <div>Firma del personal validante</div>
    <div>Firma de la persona autorizada</div>
  </div>

  <div class="foot">
    Documento generado por EduPlop el ${esc(fecha)} a las ${esc(hora)} hs. El retiro fue validado mediante firma digital Ed25519 y registrado en un libro de auditoría encadenado (SHA-256). Este comprobante constituye constancia del acto de retiro y su integridad puede verificarse contra el registro del establecimiento.
  </div>
</div></body></html>`;
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

export async function downloadReceipt(r: PickupReceipt, actorOverride?: Guardian): Promise<void> {
  // Si la foto es una URL (Storage), la incrustamos para que el comprobante
  // quede autocontenido y nítido (funciona incluso sin conexión al abrirlo).
  const g = store.guardianById(r.authorizedId) ?? actorOverride;
  let photoSrc = g?.photo;
  if (photoSrc && /^https?:/.test(photoSrc)) {
    try { photoSrc = await urlToDataUrl(photoSrc); } catch { /* deja la URL como fallback */ }
  }
  const html = buildReceiptHtml(r, actorOverride, photoSrc);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comprobante-retiro-${r.receiptId}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

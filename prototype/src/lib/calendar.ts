import type { AgendaEvent } from "./types";

/**
 * Utilidades para vincular un evento de la agenda con servicios externos:
 * Google Calendar, Outlook, archivo .ics (Apple Calendar y otros) y Google Maps.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Convierte fecha (YYYY-MM-DD) + hora (HH:MM) a inicio/fin (duración por defecto 1h). */
function range(event: AgendaEvent): { start: Date; end: Date } {
  const [y, m, d] = event.date.split("-").map(Number);
  const [hh, mm] = (event.time ?? "09:00").split(":").map(Number);
  const start = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 9, mm ?? 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hora
  return { start, end };
}

/** Formato local "flotante" para calendarios: YYYYMMDDTHHMMSS. */
function fmtLocal(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/** Formato UTC con Z (para el sello DTSTAMP del .ics). */
function fmtUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** URL para "Añadir a Google Calendar". */
export function googleCalendarUrl(event: AgendaEvent): string {
  const { start, end } = range(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${fmtLocal(start)}/${fmtLocal(end)}`,
    details: event.description || "",
    location: event.location || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** URL para "Añadir a Outlook" (Office 365 / Outlook.com). */
export function outlookCalendarUrl(event: AgendaEvent): string {
  const { start, end } = range(event);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    body: event.description || "",
    location: event.location || "",
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function escapeICS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Contenido de un archivo .ics (estándar; sirve para Apple Calendar y otros). */
export function icsContent(event: AgendaEvent): string {
  const { start, end } = range(event);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EduPlop//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@eduplop`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtLocal(start)}`,
    `DTEND:${fmtLocal(end)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description || "")}`,
    event.location ? `LOCATION:${escapeICS(event.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

/** Descarga el evento como archivo .ics. */
export function downloadIcs(event: AgendaEvent): void {
  const blob = new Blob([icsContent(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^\w\-]+/g, "_") || "evento"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** URL de Google Maps para una ubicación (texto libre). */
export function googleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

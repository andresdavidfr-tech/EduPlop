# 08 — Comunicación, Agenda, Push e IA

Diseño de las capacidades que convierten a EduPlop de una herramienta de logística de
retiros en un **hub de organización y comunicación** familia ↔ colegio. Las cuatro piezas
están implementadas en el prototipo (`prototype/`) y aquí se documenta el modelo y la
evolución a producción.

---

## 1. Notificaciones y mensajería bidireccional

### Modelo
- **Notification** (aviso unidireccional): retiro confirmado, comunicado, alerta, evento de agenda.
  Dirigido por `audienceRole` (todas las familias / docentes) o `audienceUser` (puntual).
- **Conversation** (hilo bidireccional): la familia inicia un hilo con una **categoría**
  (`absence` justificar ausencia · `permission` pedido de permiso · `general` consulta),
  el colegio responde en el mismo hilo. Estados: `open` → `answered` → `closed`.

### Flujos
- **Colegio → familias:** comunicados (Dirección) y avisos automáticos (retiro concretado).
- **Familia → colegio:** justificar faltas, pedir permisos, consultas. Cada mensaje genera
  una notificación al destinatario y queda trazado en el hilo.
- Cada parte ve solo lo que le corresponde (la familia, sus hilos; el colegio, todos).

### Producción
- Persistencia en backend con websockets para tiempo real.
- Plantillas de comunicados, adjuntos, acuse de lectura, segmentación por curso/sala.
- Moderación y retención según normativa de datos de menores.

---

## 2. Agenda interactiva vinculada

### Modelo
- **AgendaEvent**: `title`, `description`, `date`, `time`, `type`
  (reunión · acto · evaluación · feriado · salida · otro), `audienceRole` y `rsvps`
  (`{ usuario → yes | no | maybe }`).

### Interacción
- El colegio (Dirección/Docente) **publica** eventos segmentados (familias, docentes o todos);
  se notifica automáticamente a la audiencia.
- Las familias **confirman asistencia** (RSVP) con un toque; el colegio ve el conteo de
  confirmaciones por evento.
- "Vinculada" = una sola fuente de eventos, proyectada a cada audiencia, con respuesta de ida y vuelta.

### Producción
- Sincronización con calendarios externos (iCal/Google Calendar) por suscripción.
- Recordatorios automáticos (T-24h / T-1h) vía push.
- Vinculación con otros módulos: una "salida didáctica" puede requerir autorización de retiro.

---

## 3. Notificaciones push

### En el prototipo
- **Web Notifications API**: la persona **activa** las notificaciones (solicitud de permiso),
  elige **preferencias por tipo** (retiros, mensajes, agenda, comunicados) y recibe avisos
  del sistema operativo. Requiere contexto seguro (https://) — funciona en el deploy de Vercel.

### En producción (arquitectura objetivo)
- **Web Push** con **Service Worker** + **VAPID** para entrega aunque la pestaña esté cerrada.
- **Apps móviles**: **FCM** (Android) / **APNs** (iOS) vía el Notification Service (ver `docs/07`).
- Backend gestiona suscripciones por dispositivo, preferencias y reintentos; respeta el
  silencio nocturno y la prioridad (un retiro es prioritario; un comunicado, no).

```
Evento (retiro/mensaje/agenda) → Notification Svc → fan-out:
   ├─ Web Push (Service Worker + VAPID)
   ├─ FCM / APNs (apps móviles)
   └─ Centro de notificaciones in-app (campana)
```

---

## 4. Asistente de IA

### En el prototipo
- Asistente **contextual por rol** que responde con los **datos reales** de la app: quién puede
  retirar a un alumno, próxima reunión, si hubo retiro hoy, cómo justificar una falta, seguridad
  del QR, y —para el colegio— un resumen operativo del día. Resuelve intenciones localmente y
  sugiere próximas acciones.

### En producción (arquitectura objetivo)
- Se conecta a la **Claude API** conservando la interfaz `askAssistant(question, user)`.
- **Tool use / function calling**: el asistente ejecuta acciones reales con permisos del rol
  (generar un pase de retiro, enviar un mensaje, confirmar asistencia a un evento, consultar el
  historial), siempre acotado por RBAC.
- **Contexto acotado y seguro**: se le pasa solo el contexto del usuario autenticado; sin
  exponer datos de otras familias. Prompt-caching del contexto institucional para eficiencia.
- Casos de alto valor: redacción asistida de comunicados (Dirección), respuestas sugeridas a
  familias (Docentes), resúmenes de actividad y detección de patrones (ausentismo, picos de retiro).

---

## Resumen de impacto por módulo

| Módulo | Comunicación | Agenda | Push | IA |
|---|---|---|---|---|
| **Familias** | Inicia hilos (faltas/permisos/consultas), recibe avisos | Ve eventos y confirma asistencia | Activa y configura por tipo | Consultas y guía de acciones |
| **Docentes** | Bandeja de familias, responde | Ve y publica eventos del aula | Avisos de su curso | Resumen y respuestas sugeridas |
| **Dirección** | Comunicados masivos + bandeja | Publica agenda institucional | Configuración y prioridades | Resumen operativo, redacción asistida |

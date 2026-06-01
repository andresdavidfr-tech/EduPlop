# 01 — Desglose de Funcionalidades (MVP)

Este documento define el **conjunto mínimo viable** de funcionalidades por módulo.
El criterio de inclusión en el MVP es estricto: solo features que habilitan el
**ciclo completo de retiro seguro auditable** y la operación diaria mínima.
Todo lo demás se marca explícitamente como **Fase 2 (post-MVP)**.

Leyenda de prioridad: **P0** = bloqueante para el lanzamiento · **P1** = necesario para operación real · **P2** = deseable.

---

## 1. Módulo para Familias

> Eje: autogestión, identidad confiable y emisión de autorizaciones.

### Identidad y cuenta
- **(P0) Onboarding y vinculación familia–alumno:** alta de cuenta validada por la institución (la familia no se auto-vincula sin aprobación administrativa, para evitar suplantación).
- **(P0) Gestión de tutores y autorizados:** registro de personas habilitadas para retirar, con nombre, documento, vínculo, foto y estado (activo/suspendido). Cada autorizado puede o no tener app propia.
- **(P1) Roles dentro del grupo familiar:** tutor principal (puede administrar autorizados) vs. autorizado simple (solo retira).

### Emisión de autorizaciones de retiro
- **(P0) Generación de QR temporal de retiro:** el tutor selecciona alumno(s), quién retira y, opcionalmente, un motivo. El sistema emite un QR con TTL configurado por la institución.
- **(P0) Autorización de último momento ("retiro express"):** flujo de 2–3 toques optimizado para emitir un QR válido de inmediato (ej. urgencia médica, cambio de planes).
- **(P0) Delegación a un tercero:** el tutor genera un QR/credencial para una persona ya registrada como autorizada (el QR vive en la app del tutor o se envía como credencial al autorizado).
- **(P1) Visualización del estado del QR:** activo / por vencer / vencido / **ya utilizado** (consumido), en tiempo real.
- **(P1) Retiro recurrente / anticipado programado:** autorización con ventana futura (ej. "todos los martes lo retira la abuela 12:00–12:30").

### Comunicación y transparencia
- **(P0) Notificación push de salida confirmada:** al validarse el retiro, la familia recibe confirmación con sello de tiempo, quién retiró y quién validó.
- **(P1) Historial de retiros del alumno:** línea de tiempo consultable con comprobantes.
- **(P2) Canal de comunicación institución→familia:** comunicados/avisos (no es el core, pero refuerza el "Hub").

---

## 2. Módulo para Docentes

> Eje: validación rápida en el aula y registro de salida con responsabilidad nominal.

### Visualización del aula
- **(P0) Lista del aula en tiempo real:** alumnos presentes, con estado (presente / retirado / ausente).
- **(P1) Vista de autorizaciones vigentes:** qué alumnos tienen un retiro autorizado pendiente para hoy, sin tener que escanear primero.

### Validación y registro de salida
- **(P0) Escáner de QR integrado:** apertura de cámara y validación del QR del tutor/autorizado directamente desde el dispositivo del docente.
- **(P0) Pantalla de confirmación de identidad:** tras escanear, se muestra **foto + nombre + documento del autorizado** y **foto + nombre del alumno** para el cotejo visual humano (defensa contra suplantación, no se confía solo en el QR).
- **(P0) Confirmación explícita de entrega ("Confirmo entrega"):** el docente debe presionar para sellar el evento; ese acto lo vincula nominalmente como responsable de la salida.
- **(P0) Operación offline:** el escaneo y la validación funcionan sin conectividad (ver `02` y `03`); el comprobante se firma localmente y se sincroniza al recuperar red.
- **(P1) Registro de retiro manual / contingencia:** si el QR no puede generarse/escanearse, el docente registra el retiro seleccionando un autorizado verificado, dejando constancia del modo "manual" (siempre auditable y marcado como excepción).

### Trazabilidad del docente
- **(P0) Bitácora personal de salidas:** registro propio de cada retiro que el docente validó (su "huella" de responsabilidad), espejo del registro central.

---

## 3. Módulo Administrativo / Directivo

> Eje: control central, auditoría y configuración de seguridad institucional.

### Dashboard operativo
- **(P0) Tablero de retiros en vivo:** quién está saliendo, por qué puerta/aula, validado por quién, con semáforo de estado.
- **(P1) Métricas de salida:** picos horarios, tiempo promedio de validación, % de retiros de último momento, % offline.

### Gestión institucional
- **(P0) ABM de cursos, aulas, docentes y alumnos:** estructura base de la institución.
- **(P0) Aprobación de vínculos familia–alumno y de autorizados:** control administrativo de quién puede retirar a quién (capa anti-suplantación).
- **(P0) Parámetros de seguridad configurables:** **TTL del QR**, ventana de tolerancia de reloj, política offline (permitir/limitar), y reglas de re-uso.

### Auditoría y cumplimiento
- **(P0) Libro de auditoría inmutable de retiros:** todos los comprobantes tokenizados, consultables y exportables (ver `03`).
- **(P0) Gestión de disputas/incidentes:** marcar un retiro como impugnado, adjuntar evidencia y dejar traza (el comprobante original **nunca** se borra ni edita).
- **(P1) Exportación legal (PDF/CSV firmado):** comprobante con sello de tiempo y firma verificable para respaldo ante familias o autoridades.
- **(P1) Gestión de roles y permisos del personal (RBAC):** dirección, secretaría, preceptoría, docente.

---

## 4. Resumen de alcance MVP

| Capacidad | Familias | Docentes | Directivo |
|---|---|---|---|
| Emitir QR temporal | ✅ | — | (config TTL) |
| Validar / escanear | — | ✅ | (monitoreo) |
| Operación offline | (genera) | ✅ | (consolida) |
| Comprobante tokenizado | recibe | firma | custodia/audita |
| Anti-suplantación (foto+doc) | provee datos | coteja | aprueba autorizados |
| Auditoría inmutable | ve su historial | ve su bitácora | libro central |

### Fuera del MVP (Fase 2)
Pagos/cuotas, mensajería bidireccional rica, calendario académico, asistencia
biométrica, integración con SIS/ERP escolar de terceros, app dedicada para
autorizados ocasionales sin cuenta, y analítica predictiva de congestión.

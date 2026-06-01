# EduPlop — Hub de Experiencia Familiar

> Plataforma SaaS B2B2C para instituciones educativas de nivel inicial y primario.
> Cierra brechas de comunicación, optimiza la gestión operativa y garantiza
> **trazabilidad absoluta** en la logística escolar, con foco en el **retiro seguro de alumnos**.

---

## 1. Visión del producto

EduPlop es un **Hub de Experiencia Familiar** organizado en tres módulos
interdependientes que comparten un núcleo transaccional común:

| Módulo | Actor principal | Propósito |
|---|---|---|
| **Familias** | Padres / tutores / autorizados | Autogestión, comunicación y emisión de autorizaciones de retiro (QR temporal). |
| **Docentes** | Docente a cargo del aula | Gestión del aula, validación de autorizaciones y registro de salidas. |
| **Directivo / Admin** | Dirección, secretaría, preceptoría | Dashboard de control, auditoría, configuración institucional y supervisión operativa. |

El caso de uso crítico es el **retiro de último momento mediante código QR temporal**,
con validación **offline/online** y generación de un **comprobante tokenizado e inmodificable**
con valor probatorio institucional.

---

## 2. Documentación de diseño

| Documento | Contenido |
|---|---|
| [`docs/01-funcionalidades-mvp.md`](docs/01-funcionalidades-mvp.md) | Desglose de features indispensables (MVP) por módulo. |
| [`docs/02-user-journey-data-flow.md`](docs/02-user-journey-data-flow.md) | User journey del retiro QR y flujo de validación offline/online entre módulos. |
| [`docs/03-arquitectura-token-auditoria.md`](docs/03-arquitectura-token-auditoria.md) | Arquitectura de la huella digital inmodificable y cadena de auditoría. |
| [`docs/04-manejo-excepciones.md`](docs/04-manejo-excepciones.md) | Casos extremos críticos y respuesta del sistema. |
| [`docs/05-modelo-de-datos.md`](docs/05-modelo-de-datos.md) | Modelo de datos y esquema de entidades. |
| [`docs/06-api-spec.md`](docs/06-api-spec.md) | Especificación de la API (REST + WebSocket). |
| [`docs/07-arquitectura-c4.md`](docs/07-arquitectura-c4.md) | Arquitectura C4 (contexto, contenedores, componentes). |
| [`docs/08-comunicacion-agenda-push-ia.md`](docs/08-comunicacion-agenda-push-ia.md) | Mensajería bidireccional, agenda interactiva, push y asistente de IA. |

---

## 4. Prototipo funcional (demo)

En [`prototype/`](prototype/) hay una **demo navegable** (React + Vite) que implementa el flujo
real de retiro con **criptografía verdadera** (firmas Ed25519 vía `@noble/curves`, cadena de
hash SHA-256) sobre un backend simulado en el navegador. Demuestra los tres módulos, el modo
**offline/online**, el **comprobante tokenizado encadenado** y la **verificación de integridad**.

```bash
cd prototype
npm install
npm run dev      # abre http://localhost:5173
```

---

## 3. Principios rectores

1. **Seguridad por diseño:** todo retiro es un evento criptográficamente verificable y no repudiable.
2. **Disponibilidad en el momento crítico:** la salida nunca puede bloquearse por falta de conectividad.
3. **Trazabilidad legal:** cada escaneo exitoso es un comprobante auditable e inalterable.
4. **Usabilidad en alta demanda:** el flujo de puerta debe resolverse en segundos durante el pico de salida.

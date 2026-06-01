# EduPlop — Prototipo funcional

Demo navegable de los tres módulos y del flujo de **retiro seguro con QR**, con
**criptografía real** ejecutándose en el navegador:

- **Alta de autorizados** por la familia (nombre, DNI, foto opcional) y **retiro programado** (día y hora), además del express.
- **Compartir el pase por WhatsApp** (Web Share API con la imagen del QR; fallback a `wa.me`).
- **Mensajería bidireccional** familia ↔ colegio (justificar faltas, permisos, consultas + respuestas en hilo).
- **Agenda interactiva vinculada**: el colegio publica eventos segmentados y las familias confirman asistencia (RSVP).
- **Notificaciones push** del navegador (permiso + preferencias por tipo) y centro de notificaciones in-app.
- **Asistente de IA** contextual por rol (responde con datos reales y guía acciones; en producción se conecta a la Claude API).
- **Login por rol** (familia / docente / dirección): cada usuario entra a su módulo. Cuentas demo en la pantalla de inicio.
- **Escaneo con cámara real** (`@zxing/browser`) con **sonido** y un **modal claro** que muestra la persona autorizada y el alumno/a. Fallback de simulación si no hay cámara.
- **Centro de notificaciones** y **comunicados** colegio ↔ familias (la familia recibe aviso cuando se concreta el retiro).
- **Firmas Ed25519** (`@noble/curves`) para el token del QR y la doble atestación de los comprobantes.
- **Cadena de auditoría SHA-256** (`@noble/hashes`) append-only, *tamper-evident*.
- **Backend simulado** en `localStorage` (sin servidor), para probar el flujo completo offline.

## Ejecutar

```bash
npm install
npm run dev      # http://localhost:5173
```

> La cámara requiere contexto seguro (https:// o localhost). El `EduPlop-demo.html`
> abierto desde `file://` usa el modo "simular escaneo"; en el deploy de Vercel (https)
> se abre la cámara real.

### Cuentas de demostración
| Rol | Usuario | Contraseña |
|---|---|---|
| Familia | `familia` | `familia123` |
| Docente | `docente` | `docente123` |
| Dirección | `direccion` | `direccion123` |

## Qué demuestra (mapeo con la documentación de diseño)

| En la demo | Documento |
|---|---|
| Familias → "Retiro express" genera un QR firmado con TTL y cuenta regresiva | `docs/01`, `docs/02` |
| Docentes → escaneo, verificación local de **firma + TTL**, cotejo visual (foto+doc) y "Confirmo entrega" | `docs/02`, `docs/03` |
| Toggle **Online/Offline** del dispositivo: offline encola el comprobante firmado y luego **sincroniza** | `docs/02`, `docs/04` |
| Comprobante con `payload_hash` + `prev_hash` (encadenado) y doble firma (dispositivo + servidor) | `docs/03` |
| **Retiro manual / contingencia** (`mode=manual`) cuando el QR no puede usarse | `docs/04` (Caso 3) |
| **Revocación de autorizados** (lista de revocación) aplicada en validación, también offline | `docs/01`, `docs/06` |
| **Resolución de disputas** con evento compensatorio (el comprobante original no se altera) | `docs/04` (Caso 2) |
| Directivo → KPIs, libro de auditoría encadenado, **verificación de integridad** y **simulación de alteración** | `docs/03` |
| Detección de **doble uso** en la reconciliación → incidente | `docs/04` (Caso 1) |

## Capturas

En [`screenshots/`](screenshots/) hay capturas de cada etapa del flujo.

> Nota: es un **prototipo de demostración**. En producción, las claves privadas viven en
> HSM/KMS y secure enclave del dispositivo (ver `docs/03` y `docs/07`), no en el navegador.

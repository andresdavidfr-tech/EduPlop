# EduPlop — Prototipo funcional

Demo navegable de los tres módulos y del flujo de **retiro seguro con QR**, con
**criptografía real** ejecutándose en el navegador:

- **Firmas Ed25519** (`@noble/curves`) para el token del QR y la doble atestación de los comprobantes.
- **Cadena de auditoría SHA-256** (`@noble/hashes`) append-only, *tamper-evident*.
- **Backend simulado** en `localStorage` (sin servidor), para poder probar el flujo completo offline.

## Ejecutar

```bash
npm install
npm run dev      # http://localhost:5173
```

## Qué demuestra (mapeo con la documentación de diseño)

| En la demo | Documento |
|---|---|
| Familias → "Retiro express" genera un QR firmado con TTL y cuenta regresiva | `docs/01`, `docs/02` |
| Docentes → escaneo, verificación local de **firma + TTL**, cotejo visual (foto+doc) y "Confirmo entrega" | `docs/02`, `docs/03` |
| Toggle **Online/Offline** del dispositivo: offline encola el comprobante firmado y luego **sincroniza** | `docs/02`, `docs/04` |
| Comprobante con `payload_hash` + `prev_hash` (encadenado) y doble firma (dispositivo + servidor) | `docs/03` |
| Directivo → KPIs, libro de auditoría encadenado, **verificación de integridad** y **simulación de alteración** | `docs/03` |
| Detección de **doble uso** en la reconciliación → incidente | `docs/04` |

## Capturas

En [`screenshots/`](screenshots/) hay capturas de cada etapa del flujo.

> Nota: es un **prototipo de demostración**. En producción, las claves privadas viven en
> HSM/KMS y secure enclave del dispositivo (ver `docs/03` y `docs/07`), no en el navegador.

# 06 — Especificación de API

API REST/JSON (con WebSocket para tiempo real). Autenticación: OAuth2/OIDC + JWT de
sesión; autorización por RBAC. Todos los endpoints son multi-tenant (scoping por `institution_id`
derivado del token de sesión). Versionado por path: `/v1`.

Convenciones: `401` no autenticado · `403` sin permiso · `409` conflicto (p. ej. jti consumido)
· `410` recurso expirado (QR vencido) · `422` validación.

---

## 1. Familias

### `POST /v1/authorizations`  — emitir QR de retiro (incluye "express")
Crea un `authorization_token` firmado.
```jsonc
// request
{ "student_id": "stu_00917", "authorized_id": "guar_0231", "ttl_seconds": 300, "reason": "turno médico" }
// 201 response
{
  "jti": "01J9Z...K7",
  "qr_payload": "v4.public.eyJpc3MiOi...<token firmado>",   // lo que se renderiza en el QR
  "exp": "2026-06-01T11:55:00Z",
  "status": "active"
}
```

### `GET /v1/authorizations/{jti}` — estado del QR
`active | expiring | expired | consumed | revoked` + metadatos.

### `POST /v1/authorizations/{jti}/revoke` — anular un QR emitido

### `GET /v1/students/{id}/pickups` — historial de retiros del alumno (comprobantes)

### `GET /v1/me/guardianships` — vínculos y autorizados del grupo familiar
### `POST /v1/guardianships/{id}/authorized` — proponer autorizado (queda `pending` hasta aprobación admin)

---

## 2. Docentes / Validación

### `GET /v1/provisioning/bundle` — **aprovisionamiento offline** (clave del modo autónomo)
Devuelve el paquete cacheable para operar sin red:
```jsonc
{
  "institution_pubkey": "...",
  "key_id": "fam_key_2026_05",
  "roster": [ { "student_id": "...", "name": "...", "photo_url": "...", "authorized": [ {"id":"...","name":"...","document":"...","photo_url":"..."} ] } ],
  "revocation_list": ["guar_9001", "01J9X...JTI"],
  "policy": { "ttl_default": 300, "clock_skew": 60, "offline_max_window_min": 240 },
  "issued_at": "2026-06-01T07:00:00Z"
}
```

### `POST /v1/pickups/validate` — **validación ONLINE (autoritativa)**
```jsonc
// request
{ "qr_payload": "v4.public.eyJ...", "device_id": "dev_door_03", "validated_by": "teacher_0119", "visual_confirmed": true }
// 201 → comprobante sellado por el servidor
{ "receipt_id": "01J9ZB...Q2", "status": "authorized", "mode": "online",
  "prev_hash": "9af2c1...", "payload_hash": "e1b0d9...", "server_signature": "..." }
// 410 → { "error": "qr_expired", "exp": "..." }
// 409 → { "error": "jti_already_consumed", "consumed_at": "...", "by_receipt": "..." }
```

### `POST /v1/pickups/sync` — **reconciliación offline (batch)**
Sube la cola de comprobantes firmados por dispositivo; el servidor co-firma, consolida en el
ledger y devuelve conflictos detectados.
```jsonc
// request
{ "device_id": "dev_door_03", "receipts": [ { ...comprobante firmado localmente... } ] }
// 200
{ "accepted": ["01J9ZB...Q2"], "conflicts": [ { "jti": "01J9Z...K7", "type": "double_use", "incident_id": "inc_77" } ] }
```

### `POST /v1/pickups/manual` — registro de contingencia (`mode=manual`, marcado como excepción)

### `GET /v1/me/pickup-log` — bitácora del docente (proyección por `validated_by`)

> Nota de diseño: la verificación de **firma + TTL** del QR ocurre **en el cliente** antes de
> llamar a la API; `validate` solo aporta la capa autoritativa (anti-reuso/revocación en vivo).

---

## 3. Directivo / Administración

### `GET /v1/dashboard/live` — tablero en vivo (+ `WS /v1/stream/pickups`)
### `GET /v1/audit/events` — libro de auditoría (filtros: fecha, alumno, docente, tipo)
### `GET /v1/audit/verify` — **verificación de integridad de la cadena hash**
```jsonc
{ "valid": true, "events_checked": 1284, "root_hash": "merkle:7c2a...", "last_timestamp_anchor": "2026-06-01T00:00:00Z" }
// si se detecta alteración:
{ "valid": false, "broken_at_seq": 842, "expected_prev": "...", "found_prev": "..." }
```

### `GET /v1/audit/receipts/{id}/export` — comprobante legal firmado (PDF/CSV)
### `POST /v1/incidents` / `PATCH /v1/incidents/{id}` — abrir / resolver disputa (evento compensatorio)
### `PUT /v1/settings/security` — TTL, skew, política offline
### CRUD institucional: `/v1/students`, `/v1/classrooms`, `/v1/staff`, `/v1/devices`
### `POST /v1/devices/{id}/revoke` · `POST /v1/guardians/{id}/revoke`
### `PATCH /v1/guardianships/{id}/approval` — aprobar/rechazar vínculo o autorizado

---

## 4. Errores transversales
| Código | Significado |
|---|---|
| `qr_expired` (410) | TTL vencido |
| `qr_invalid_signature` (422) | firma no verifica |
| `jti_already_consumed` (409) | reuso/replay |
| `authorized_revoked` (403) | autorizado suspendido/revocado |
| `device_revoked` (403) | validador no confiable |
| `chain_integrity_error` (500) | inconsistencia del ledger (incidente crítico) |

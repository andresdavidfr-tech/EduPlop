# 05 — Modelo de Datos / Esquema de Entidades

Modelo lógico de la plataforma. Notación: PK (clave primaria), FK (foránea).
El núcleo transaccional gira en torno a tres entidades inmutables —
`authorization_token`, `pickup_receipt` y `audit_event` — que materializan la
trazabilidad descrita en `03`.

---

## 1. Diagrama Entidad-Relación (resumen)

```
institution 1───∞ campus 1───∞ grade 1───∞ classroom 1───∞ enrollment ∞───1 student
     │                                                                          │
     │ 1                                                                        │ ∞
     ∞                                                                          │
   staff (RBAC)                                              guardianship ∞─────┘
     │                                                          │
     │ validates                                                ∞
     │                                            guardian / authorized_person
     ▼                                                          │ emits
 pickup_receipt ∞───1 authorization_token  ◄───────────────────┘
     │ 1
     │ produces
     ∞
 audit_event   (ledger append-only, hash-encadenado)
```

---

## 2. Entidades

### institution
| Campo | Tipo | Notas |
|---|---|---|
| id | PK (ULID) | `inst_*` |
| name | string | |
| timezone | string | para TTL/skew |
| signing_key_id | string | `kid` activo (HSM/KMS) |
| settings | jsonb | TTL default, skew, política offline |

### campus / grade / classroom
Jerarquía organizativa. `classroom` referencia `grade` → `campus` → `institution`,
y tiene un `homeroom_teacher_id` (FK staff).

### student
| Campo | Tipo | Notas |
|---|---|---|
| id | PK | `stu_*` |
| institution_id | FK | |
| full_name | string | |
| document_id | string | cifrado en reposo |
| photo_url | string | para cotejo visual |
| status | enum | active / inactive |

### enrollment
Relaciona `student` ↔ `classroom` por ciclo lectivo (`school_year`).

### guardian / authorized_person
| Campo | Tipo | Notas |
|---|---|---|
| id | PK | `guar_*` |
| institution_id | FK | |
| full_name, document_id, photo_url | | identidad para cotejo |
| has_app_account | bool | autorizado con o sin app |
| status | enum | active / suspended / revoked |

### guardianship (vínculo familia–alumno) — **aprobado por administración**
| Campo | Tipo | Notas |
|---|---|---|
| id | PK | |
| guardian_id | FK | |
| student_id | FK | |
| role | enum | primary_guardian / authorized |
| can_manage_authorized | bool | solo primary |
| approval_status | enum | pending / approved / rejected |
| approved_by | FK staff | capa anti-suplantación |

### staff (RBAC)
| Campo | Tipo | Notas |
|---|---|---|
| id | PK | `teacher_*`, `admin_*` |
| role | enum | director / secretary / preceptor / teacher |
| permissions | jsonb | derivadas del rol |

### device (validadores aprovisionados)
| Campo | Tipo | Notas |
|---|---|---|
| id | PK | `dev_*` |
| institution_id | FK | |
| device_pubkey | string | Ed25519 (firma offline) |
| provisioned_at / last_sync_at | ts | estado de caché |
| status | enum | active / revoked |

### authorization_token (efímero, inmutable) — el QR
| Campo | Tipo | Notas |
|---|---|---|
| jti | PK (ULID) | id único, anti-reuso |
| institution_id | FK | `iss` |
| student_id | FK | `sub` |
| authorized_id | FK | `act` |
| issued_by | FK guardian | quién emitió |
| iat / nbf / exp | ts | TTL |
| nonce | string | anti-replay |
| signature | bytes | firma de emisión |
| status | enum | active / consumed / expired / revoked |

### pickup_receipt (comprobante permanente, inmutable)
| Campo | Tipo | Notas |
|---|---|---|
| receipt_id | PK (ULID) | |
| token_jti | FK | autorización consumida |
| student_id / authorized_id | FK | |
| validated_by | FK staff | responsabilidad nominal |
| device_id | FK | |
| mode | enum | online / offline / manual |
| visual_confirmed | bool | cotejo humano |
| timestamp | ts | sello del evento |
| prev_hash | string | encadenamiento |
| payload_hash | string | hash del contenido |
| device_signature / server_signature | bytes | doble atestación |

### audit_event (ledger append-only)
| Campo | Tipo | Notas |
|---|---|---|
| seq | PK (bigserial) | orden total |
| institution_id | FK | |
| event_type | enum | token_issued / pickup_validated / pickup_failed / dispute_opened / dispute_resolved / device_revoked / guardian_revoked |
| ref_id | string | id del objeto referido |
| actor_id | string | quién originó |
| payload | jsonb | datos del evento |
| prev_hash / hash | string | cadena hash (tamper-evident) |
| created_at | ts | append-only, sin UPDATE/DELETE |

### incident (disputas y conflictos)
| Campo | Tipo | Notas |
|---|---|---|
| id | PK | |
| type | enum | dispute / double_use / offline_conflict |
| ref_receipt_id | FK | comprobante referido (no se altera) |
| status | enum | open / investigating / resolved |
| resolution | jsonb | conclusión + evento compensatorio |

---

## 3. Reglas de integridad clave
- `authorization_token` y `pickup_receipt` son **insert-only**; los cambios de estado válidos
  (consumed/expired/revoked) se modelan, idealmente, como nuevos `audit_event`.
- `audit_event` es **estrictamente append-only** (WORM): sin UPDATE ni DELETE a nivel de aplicación y de almacenamiento.
- La **bitácora del docente** y la **vista directiva** son *proyecciones* de `audit_event` /
  `pickup_receipt`, no tablas independientes → una sola fuente de verdad.
- Un `jti` solo puede asociarse a un `pickup_receipt` "ganador"; colisiones offline generan `incident`.

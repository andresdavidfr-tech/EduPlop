# 07 — Arquitectura C4

Vista de arquitectura siguiendo el modelo C4 (Contexto → Contenedores → Componentes).
Diagramas en texto/Mermaid para versionado en repositorio.

---

## Nivel 1 — Contexto del Sistema

```mermaid
graph TB
    Fam([👨‍👩‍👧 Familia / Tutor / Autorizado])
    Doc([🧑‍🏫 Docente / Preceptor])
    Dir([🏫 Directivo / Secretaría])

    Sys[["EduPlop — Hub de Experiencia Familiar"]]

    KMS[(KMS / HSM<br/>firma institucional)]
    TSA[(Autoridad de Sellado<br/>de Tiempo · RFC 3161)]
    Push[(Proveedor Push<br/>FCM / APNs)]

    Fam -->|emite QR, recibe avisos| Sys
    Doc -->|escanea, valida, registra| Sys
    Dir -->|supervisa, audita, configura| Sys
    Sys --> KMS
    Sys --> TSA
    Sys --> Push
```

El sistema es **B2B2C**: la institución (B) contrata; familias y personal (C) operan.

---

## Nivel 2 — Contenedores

```mermaid
graph TB
    subgraph Clientes
      FamApp[App Familias<br/>iOS/Android · React Native]
      DocApp[App Docentes<br/>móvil · offline-first + cola local]
      DirWeb[Dashboard Directivo<br/>SPA web · React]
    end

    GW[API Gateway / BFF<br/>OIDC · rate-limit · multi-tenant]

    subgraph Backend
      AuthSvc[Auth & Identity Svc<br/>RBAC · OIDC]
      TokenSvc[Authorization Svc<br/>emite/verifica tokens QR]
      PickupSvc[Pickup & Validation Svc<br/>validate · sync · manual]
      LedgerSvc[Audit Ledger Svc<br/>append-only · hash chain · timestamping]
      NotifSvc[Notification Svc]
      AdminSvc[Institution & Config Svc]
    end

    DB[(PostgreSQL<br/>transaccional + WORM/Object-Lock)]
    Cache[(Redis<br/>jti consumidos · sesiones)]
    Bus{{Event Bus<br/>Kafka/NATS}}
    Obj[(Object Storage<br/>fotos · exports firmados)]

    FamApp --> GW
    DocApp --> GW
    DirWeb --> GW
    GW --> AuthSvc & TokenSvc & PickupSvc & LedgerSvc & AdminSvc

    TokenSvc --> KMS[(KMS/HSM)]
    PickupSvc --> Cache
    PickupSvc --> Bus
    Bus --> LedgerSvc
    Bus --> NotifSvc
    LedgerSvc --> DB
    LedgerSvc --> TSA[(TSA)]
    AdminSvc --> DB
    NotifSvc --> Push[(FCM/APNs)]
    AdminSvc --> Obj
```

**Decisiones clave de contenedores**
- **App Docentes offline-first:** mantiene `provisioning bundle` (clave pública, roster, CRL) y
  **cola local firmada**; verifica firma+TTL sin red (ver `02`/`03`).
- **Pickup Svc** publica eventos al **Event Bus**; el **Ledger Svc** los consume y los asienta de
  forma append-only → desacople y orden total.
- **KMS/HSM** custodia la clave privada institucional; los dispositivos solo portan la **pública**.

---

## Nivel 3 — Componentes (Pickup & Validation Service)

```mermaid
graph LR
    API[REST Controller<br/>/pickups/validate · /sync · /manual]
    Verify[Token Verifier<br/>firma + exp + nbf + skew]
    Replay[Replay Guard<br/>jti store · Redis]
    Revoke[Revocation Checker<br/>CRL en vivo]
    Receipt[Receipt Builder<br/>payload_hash · prev_hash]
    Sign[Co-Signer<br/>server_signature vía KMS]
    Recon[Offline Reconciler<br/>detección de double_use]
    Pub[Event Publisher → Bus]

    API --> Verify --> Replay --> Revoke --> Receipt --> Sign --> Pub
    API --> Recon --> Replay
    Recon --> Pub
```

---

## Atributos de calidad (cómo la arquitectura los soporta)

| Atributo | Mecanismo arquitectónico |
|---|---|
| **Disponibilidad en el pico** | App docente offline-first + validador autónomo; backend stateless escalable horizontal. |
| **Integridad / no repudio** | Firma KMS + doble atestación dispositivo/servidor + hash chain + TSA + WORM. |
| **Escalabilidad** | Event bus desacopla validación de auditoría; lecturas servidas por proyecciones (CQRS). |
| **Multi-tenancy** | Scoping por `institution_id` en gateway; aislamiento lógico de datos. |
| **Seguridad** | OIDC + RBAC, PII cifrada en reposo, claves de dispositivo revocables, sin PII en el QR. |
| **Auditabilidad** | Ledger append-only consultable + verificación de cadena + export legal firmado. |

---

## Estrategia de despliegue (resumen)
- **Contenedores** (Docker) sobre **Kubernetes**; servicios stateless con autoscaling.
- **PostgreSQL** gestionado con réplicas de lectura + bucket con **Object Lock** para WORM.
- **CDN** para assets/fotos; **observabilidad** con OpenTelemetry (trazas del flujo de retiro).
- **Entornos**: dev → staging → prod, con datos sintéticos en no-prod (sin PII real).

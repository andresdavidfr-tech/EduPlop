# 03 — Arquitectura del Token y Auditoría

Objetivo: estructurar la **huella digital inmodificable** de cada retiro para que sea
**a prueba de alteraciones (tamper-evident)**, **no repudiable** y sirva como **respaldo
institucional legal**, impactando simultáneamente en el Módulo Directivo (libro central)
y en el Módulo Docente (bitácora individual).

Es importante distinguir **dos artefactos criptográficos** que la gente suele confundir:

1. **Token del QR** (efímero): la *autorización* que emite la familia y se escanea.
2. **Comprobante de retiro** (permanente): la *prueba* que se genera al validar la salida.

---

## 1. Token del QR (autorización efímera)

### Formato
Se recomienda **PASETO v4.public** (Ed25519) sobre JWT/JWS, por evitar las trampas
clásicas de JWT (`alg=none`, confusión de algoritmo). Si se exige JWT por interoperabilidad,
fijar `alg=EdDSA` y rechazar cualquier otro.

### Estructura de claims
```jsonc
{
  "iss": "eduplop:inst_8842",        // institución emisora
  "sub": "stu_00917",                // alumno a retirar
  "act": "guar_0231",                // autorizado que retira
  "jti": "01J9Z...K7",               // ID único (ULID) → clave anti-reuso
  "iat": 1764594600,                 // emisión (epoch)
  "exp": 1764594900,                 // vencimiento = iat + TTL (ej. 300 s)
  "nbf": 1764594600,                 // no válido antes (retiro programado)
  "scope": "pickup",
  "nonce": "b7f3...",                // aleatorio, anti-replay
  "kid": "fam_key_2026_05"           // id de clave para verificar firma
}
```

### Propiedades de seguridad
- **TTL / vencimiento (`exp`):** corto y configurable por institución (default 5 min). Limita la ventana de captura/foto del QR.
- **Un solo uso (`jti`):** el backend mantiene un set de `jti` consumidos; el segundo intento se rechaza (online) o se detecta en reconciliación (offline).
- **Firma asimétrica:** la clave **privada** vive en HSM/KMS (o, en modelo familia-firma, en el secure enclave del dispositivo aprovisionado); el dispositivo de puerta solo tiene la **pública** → puede verificar pero **no falsificar** QRs.
- **Sin PII en claro:** el QR transporta IDs opacos, no nombres ni documentos. El cotejo de identidad (foto/doc) se resuelve contra el **roster cacheado**, no contra el contenido del QR.
- **Tolerancia de reloj (clock skew):** ±N segundos configurable, para no rechazar QRs válidos por desfasaje horario de dispositivos offline.

---

## 2. Comprobante de retiro (huella digital inmodificable)

Cuando el docente presiona **"Confirmo entrega"**, se genera el comprobante permanente.
Aquí está el corazón del valor probatorio.

### 2.1 Contenido del comprobante
```jsonc
{
  "receipt_id": "01J9ZB...Q2",
  "token_jti": "01J9Z...K7",         // vincula a la autorización consumida
  "institution_id": "inst_8842",
  "student_id": "stu_00917",
  "guardian_id": "guar_0231",
  "validated_by": "teacher_0119",    // responsabilidad nominal del docente
  "device_id": "dev_door_03",
  "mode": "offline",                 // offline | online
  "timestamp": "2026-06-01T11:52:14Z",
  "geo": "opcional / puerta-principal",
  "visual_confirmed": true,          // el docente cotejó foto+doc
  "prev_hash": "9af2c1...",          // hash del comprobante anterior (encadenamiento)
  "payload_hash": "e1b0d9..."        // hash del contenido de este comprobante
}
```

### 2.2 Tres capas que lo hacen inmodificable

**Capa 1 — Firma digital del evento.**
El comprobante se **firma** en el momento de la confirmación:
- En **online**, lo firma el backend con la clave institucional (HSM/KMS).
- En **offline**, lo firma el **dispositivo del docente** con su clave de dispositivo
  aprovisionada (Ed25519 en secure storage). Al reconciliar, el backend **co-firma**,
  produciendo doble atestación (dispositivo + servidor).

→ Garantiza **autenticidad y no repudio**: se sabe *quién* lo selló y que *no fue alterado*.

**Capa 2 — Encadenamiento hash (hash chain / ledger append-only).**
Cada comprobante incluye `prev_hash` = hash del comprobante inmediatamente anterior de
esa institución (estilo blockchain ligero / Merkle log). Alterar o eliminar un registro
intermedio **rompe la cadena** y se detecta de inmediato.

```
   R(n-1).hash ──► R(n).prev_hash
   R(n).hash    ──► R(n+1).prev_hash
   ...
   Periódicamente: raíz Merkle del lote → "sellado de tiempo"
```

**Capa 3 — Anclaje temporal y almacenamiento append-only.**
- **Sellado de tiempo (timestamping):** la raíz del lote diario se sella con un TSA
  (RFC 3161) o se ancla externamente, dando prueba de existencia *en o antes de* una fecha.
- **Persistencia WORM:** el libro de auditoría usa almacenamiento *append-only*
  (ej. tabla inmutable + bucket con Object Lock / retención legal). **No existe operación
  de UPDATE ni DELETE** sobre comprobantes; las correcciones se modelan como **eventos
  compensatorios** que referencian el original.

### 2.3 Doble impacto simultáneo (Directivo + Docente)
El comprobante es **un único registro canónico** en el libro central (Directivo). La
"bitácora del docente" **no es una copia editable**, sino una **vista/proyección filtrada**
del mismo ledger por `validated_by`. Así se elimina el riesgo de divergencia entre módulos:
**una sola fuente de verdad, múltiples vistas.**

```
            ┌──────────────────────────────┐
            │  LIBRO DE AUDITORÍA (ledger)  │  ← append-only, firmado, encadenado
            │  fuente única de verdad        │
            └───────┬───────────────┬───────┘
                    │               │
        proyección  │               │  proyección
        por inst.   ▼               ▼  por validated_by
            ┌───────────────┐  ┌────────────────┐
            │ Vista Directivo│  │ Bitácora Docente│
            │ (todo el estab)│  │ (sus retiros)   │
            └───────────────┘  └────────────────┘
```

---

## 3. Gestión de claves (resumen)
- **Clave privada institucional:** HSM / KMS gestionado, rotación programada (`kid` versionado).
- **Claves de dispositivo (offline):** generadas en secure enclave, aprovisionadas tras
  autenticación, **revocables** desde el Módulo Directivo (un dispositivo robado se invalida).
- **Distribución de claves públicas + CRL:** se refrescan en cada ventana online del dispositivo.

---

## 4. Por qué resiste una impugnación
Ante una disputa ("yo no autoricé / nadie retiró a mi hijo"), la institución puede exhibir:
1. El **token de autorización** firmado por la familia (prueba de *quién autorizó*).
2. El **comprobante** firmado por el docente/dispositivo + servidor (prueba de *quién entregó y a quién*).
3. La **posición en la cadena hash** + sello de tiempo (prueba de *que no fue alterado ni insertado a posteriori*).
4. El flag `visual_confirmed` y los datos del autorizado cotejados (prueba de *control de identidad*).

Esta combinación (firma + encadenamiento + timestamping + WORM) es lo que convierte el
registro en **respaldo institucional a prueba de alteraciones**.

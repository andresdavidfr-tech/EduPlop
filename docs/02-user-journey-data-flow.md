# 02 — User Journey & Data Flow: Retiro de Último Momento con QR

Este documento describe la experiencia de usuario del caso crítico y, sobre todo,
**cómo fluye la validación de seguridad offline/online** entre los tres módulos.

---

## 1. Escenario

Día de semana, 11:50. La madre (tutora principal) debe retirar a su hija antes de
hora por un turno médico imprevisto. No avisó con anticipación. La conectividad en
la puerta del colegio es intermitente.

**Objetivo:** que la salida se resuelva en segundos, de forma segura y con un
comprobante legal, **funcione o no la red en ese instante.**

---

## 2. User Journey (mapa de experiencia)

### Etapa A — Emisión (Módulo Familias)
1. La tutora abre EduPlop → **"Retiro express"**.
2. Selecciona alumna y "Retira: yo" (o un autorizado registrado).
3. La app genera un **QR temporal** con un **TTL** (p. ej. 5 min) y muestra una cuenta regresiva.
4. *Estado emocional esperado:* control y rapidez. Fricción objetivo: **≤ 3 toques**.

> Punto de seguridad clave: el QR **no contiene datos sensibles en claro**; transporta un
> **token firmado** (ver `03`). Aunque alguien fotografíe la pantalla, el token caduca y es de un solo uso.

### Etapa B — Validación en puerta/aula (Módulo Docentes / Preceptoría)
5. El personal abre el **escáner** y lee el QR.
6. La app muestra **foto + nombre + documento del autorizado** y **foto + nombre de la alumna**.
7. El docente realiza el **cotejo visual humano** y presiona **"Confirmo entrega"**.
8. Se emite **feedback inmediato**: ✅ verde "Salida autorizada" / ❌ rojo con motivo.
9. *Estado emocional esperado:* confianza; resolución en **< 5 segundos**.

### Etapa C — Confirmación y cierre (los tres módulos)
10. **Familia:** push "Salida confirmada 11:52 — validó: Doc. Pérez".
11. **Docente:** la alumna pasa a estado *Retirada* y queda en su **bitácora personal**.
12. **Directivo:** el evento aparece en el **tablero en vivo** y se asienta en el **libro de auditoría**.

---

## 3. Modelo de validación: el núcleo offline/online

La seguridad no depende de que el dispositivo de puerta tenga red en el instante del
escaneo. Se logra desplazando la **confianza al token firmado** y al **dispositivo
validador previamente aprovisionado**.

### 3.1 Pre-requisito: aprovisionamiento (siempre online, periódico)
Mientras hay red, el dispositivo del docente/preceptoría descarga y mantiene en caché:
- La **clave pública institucional** (para verificar firmas de QR) y, opcionalmente, una
  clave simétrica de sesión rotada para el modo offline.
- El **roster del día**: alumnos del aula + autorizados aprobados (foto, nombre, documento, vínculo).
- La **lista de revocación** (autorizados suspendidos, QRs anulados) más reciente.

Esto convierte al dispositivo en un **validador autónomo** durante ventanas de corte.

### 3.2 El QR como aserción autocontenida y verificable
El QR codifica un **token firmado** (estructura tipo JWS/PASETO, detallada en `03`) que incluye:
`institución · alumno_id · autorizado_id · jti (id único) · iat (emisión) · exp (vencimiento) · nonce`.

Por estar **firmado por la institución/familia**, el validador puede verificar
**criptográficamente y sin red** que: (a) el token es auténtico, (b) no fue alterado,
(c) no está vencido (comparando contra su reloj con tolerancia de skew).

### 3.3 Decisión de validación — árbol offline/online

```
                 ┌─────────────────────────┐
                 │   Escaneo del QR         │
                 └───────────┬─────────────┘
                             ▼
              Verificar FIRMA + exp (TTL)  ← siempre local, sin red
                             │
              ┌──────────────┴───────────────┐
          inválida/vencida              válida y vigente
              │                               │
              ▼                               ▼
         ❌ Rechazo               ¿hay conectividad ahora?
       (motivo explícito)        ┌──────────┴──────────┐
                                SÍ (online)         NO (offline)
                                 │                     │
                                 ▼                     ▼
                    Validación AUTORITATIVA    Validación LOCAL
                    contra backend:            contra caché:
                    - jti no consumido         - jti no en cola local
                    - autorizado no revocado   - autorizado no en lista
                      (revocación en vivo)       de revocación cacheada
                                 │                     │
                                 ▼                     ▼
                    Comprobante sellado en      Comprobante firmado y
                    servidor (autoritativo)     ENCOLADO localmente,
                                 │              marcado "pendiente sync"
                                 │                     │
                                 └──────────┬──────────┘
                                            ▼
                                  ✅ Salida autorizada
                                  (cotejo visual humano)
```

### 3.4 Reconciliación al recuperar conectividad
- El dispositivo **sincroniza la cola** de comprobantes offline al backend.
- El backend **consolida** cada comprobante: verifica firma, marca el `jti` como consumido
  y lo asienta en el libro de auditoría central y en la bitácora del docente.
- **Detección de doble uso diferido:** si dos dispositivos validaron offline el mismo `jti`
  (escenario de fraude/duplicado), el backend lo detecta en la reconciliación, **conserva ambos
  registros** y **levanta una alerta de incidente** al Módulo Directivo (no se descarta evidencia).

> El modo offline **prioriza la disponibilidad** (la salida no se bloquea) y traslada la
> resolución de conflictos a la reconciliación, donde nada se pierde. Esto es deliberado:
> en nivel inicial/primario, retener a un menor por un corte de red es peor que resolver
> un conflicto poco frecuente *a posteriori* con evidencia completa.

---

## 4. Data Flow entre módulos (resumen)

| Paso | Origen | Destino | Dato | Canal |
|---|---|---|---|---|
| Emisión QR | Familias | (dispositivo) | Token firmado | Local / pantalla |
| Verificación | Dispositivo docente | — | Firma + TTL | **Local, sin red** |
| Validación autoritativa | Docente | Backend | jti, autorizado_id | Online (si hay red) |
| Comprobante | Docente | Backend (libro) + Bitácora docente | Token de retiro firmado | Online / cola offline |
| Confirmación | Backend | Familias | Push de salida | Online |
| Monitoreo | Backend | Directivo | Evento en vivo | Online / WebSocket |
| Reconciliación | Dispositivo | Backend | Cola de comprobantes offline | Online (al reconectar) |

---

## 5. SLAs de experiencia (objetivos)

- Emisión de QR: **< 2 s**, ≤ 3 toques.
- Validación en puerta (online u offline): **< 5 s** por alumno.
- Notificación a familia: **< 10 s** tras la confirmación (o al reconectar).
- Disponibilidad del flujo de salida: **funcional al 100% en modo offline** durante cortes.

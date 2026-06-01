# 04 — Manejo de Excepciones

Tres casos extremos críticos, con la respuesta esperada del sistema. El principio
transversal: **nunca bloquear indebidamente la salida de un menor, nunca perder evidencia,
y siempre dejar traza auditable de la excepción.**

---

## Caso 1 — Intento de uso de QR vencido o ya consumido (TTL / replay)

**Situación:** un autorizado presenta un QR cuyo `exp` ya pasó, o un QR cuyo `jti` ya fue
usado en un retiro anterior (foto reenviada, captura de pantalla, doble escaneo).

**Detección:**
- **Vencido:** la verificación **local** del dispositivo compara `exp` contra su reloj (con
  tolerancia de skew). No requiere red.
- **Ya consumido:** online → el backend rechaza el `jti` ya marcado; offline → se valida contra
  la cola local y se confirma en la reconciliación.

**Respuesta del sistema:**
1. Pantalla **roja inequívoca**: "QR vencido" o "QR ya utilizado a las HH:MM", sin ambigüedad.
2. **No** se genera comprobante de salida.
3. Camino de recuperación de **un toque**: "Pedir nuevo QR a la familia" (la familia reemite
   un retiro express) o "Registrar retiro manual" (contingencia, ver Caso 3).
4. Se registra un **evento de intento fallido** en auditoría (no es un retiro, pero queda traza:
   útil para detectar patrones de abuso).
5. **Doble uso offline detectado tarde:** si dos dispositivos consumieron el mismo `jti` sin red,
   la reconciliación **conserva ambos comprobantes** y dispara una **alerta de incidente** al
   Directivo para investigación (no se descarta ninguno).

---

## Caso 2 — Disputa de autorización ("yo no autoricé este retiro")

**Situación:** una familia impugna un retiro: niega haber autorizado, o cuestiona quién retiró.

**Respuesta del sistema:**
1. **El comprobante original es inmutable:** no se edita ni elimina. La disputa se modela como
   un **evento de incidente** que *referencia* el comprobante (ver `03`, eventos compensatorios).
2. **Expediente probatorio automático:** el Directivo abre el caso y el sistema arma el legajo:
   - Token de autorización firmado (con `kid`/dispositivo emisor y `iat` → *quién y cuándo autorizó*).
   - Comprobante firmado por docente + dispositivo/servidor, con `validated_by`, `timestamp`, `mode`.
   - Posición en la **cadena hash** + sello de tiempo (prueba de no alteración).
   - Flag `visual_confirmed` y datos del autorizado cotejados.
3. **Resolución con traza:** el Directivo registra la conclusión (válido / anómalo / fraude) como
   nuevo evento encadenado. El historial completo queda visible para auditoría.
4. **Mitigación a futuro:** si se confirma compromiso de cuenta, se **revoca** al autorizado y/o se
   fuerza re-credencialización; los QR emitidos por esa credencial se invalidan vía lista de revocación.

> Clave de diseño: la integridad probatoria (firma + encadenamiento + timestamping + WORM) es
> precisamente lo que permite **resolver la disputa con evidencia objetiva** en lugar de "palabra contra palabra".

---

## Caso 3 — Fallo prolongado de red en el pico de salida

**Situación:** corte de conectividad sostenido (minutos/horas) justo en el horario de salida
masiva. Los dispositivos de puerta/aula no alcanzan el backend.

**Respuesta del sistema:**
1. **Continuidad operativa (degradación elegante):** el dispositivo opera en **modo validador
   autónomo** con la caché aprovisionada (clave pública, roster del día, lista de revocación).
   La salida **no se detiene**.
2. **Validación offline completa:** verifica firma + TTL localmente, coteja identidad contra el
   roster cacheado (foto/doc), exige cotejo visual humano y **firma el comprobante con la clave
   del dispositivo**, encolándolo como "pendiente sync".
3. **Anti-doble-uso local:** el `jti` se marca consumido en la cola local para evitar reuso en
   el mismo dispositivo durante el corte.
4. **Indicador de modo offline visible** para el personal (banner), reforzando la verificación
   visual como capa primaria mientras dura el corte.
5. **Límites de seguridad configurables:** la institución puede definir, p. ej., ventana máxima
   de operación offline o exigir doble confirmación para retiros offline de alto riesgo.
6. **Reconciliación al reconectar:** la cola sube al backend, que co-firma, consolida en el ledger,
   marca `jti` consumidos, **detecta conflictos** (dobles usos entre dispositivos) y **notifica a las
   familias** las salidas que no pudieron avisarse en el momento.
7. **Fallback de contingencia (red Y app caídas):** procedimiento de **retiro manual** (el docente
   selecciona un autorizado verificado del roster, o registro en papel con foto), marcado
   explícitamente como `mode=manual` / excepción, para regularizar e ingresar al ledger luego.

---

## Principios transversales de manejo de excepciones

| Principio | Implicancia |
|---|---|
| **Fail-open operativo, fail-closed probatorio** | La salida no se bloquea por infraestructura; la evidencia sí se protege estrictamente. |
| **Nunca destruir evidencia** | Conflictos y disputas se resuelven conservando todos los registros, no borrando. |
| **Toda excepción deja traza** | Intentos fallidos, modo manual, offline y disputas son eventos auditables. |
| **El humano es la última capa** | El cotejo visual (foto+documento) respalda al sistema cuando la tecnología degrada. |
| **Recuperación de un toque** | Ante un rechazo, el personal siempre tiene una acción clara y rápida. |

# SISTEMA SIRENA · Mar de Plata Taxco
## Reporte final de funcionalidades · v.2026.06

> azxion / caso · mar_de_plata_taxco · Libia Zárate

---

# PARTE 1 · EL MOTOR CONVERSACIONAL

## 1.1 Webhook receptor (`/api/webhook/manychat`)

La puerta de entrada de todo. Cada mensaje que una clienta manda al WhatsApp del negocio llega aquí vía ManyChat.

**Qué hace, paso a paso:**
1. Recibe el POST con el body de ManyChat (texto, teléfono, subscriber_id, nombre, email, timezone, datos de atribución si vienen)
2. Detecta si es audio (`.ogg` en el texto) → lo transcribe con Whisper y sigue como si fuera texto
3. **Limpia y normaliza**: números mexicanos en formato largo (`521...`) se convierten al corto (`52...`) para que un mismo contacto nunca exista dos veces
4. **Captura identidad**: extrae el nombre del contacto (name / first_name / last_name) y lo guarda si el lead no tenía
5. **Captura el subscriber_id de ManyChat** automáticamente en `config_sistema` — es la llave para poder enviarle mensajes después (seguimientos, sandbox). Sin intervención humana, cada lead que escribe queda registrado para siempre
6. **Registra o encuentra el lead** (el trigger de Supabase crea su estado conversacional)
7. **Guardrails críticos**: si el texto contiene "asesora", "humano", "persona real", "profeco", "fraude" o "denunciar" → corta todo y va directo a handoff urgente con alerta para Mar
8. Persiste el webhook completo (body crudo, headers, resultado) en la tabla `webhook_log` para auditoría
9. Responde a ManyChat con un resumen del procesamiento

## 1.2 El Verificador (Haiku 4.5 vía OpenRouter)

El "cerebro rápido" que analiza cada mensaje antes de que Sirena responda.

- Recibe el contexto completo del lead (función SQL `obtener_contexto_lead`: lead + estado + últimos 5 mensajes + eventos + seguimientos pendientes) más metadata de horario hábil y live activo
- Clasifica la **intención primaria**: consultar_faq, comprar_mayoreo_catalogo, comprar_mayoreo_grupo, comprar_menudeo, visita_presencial, compras_en_vivo, reclamo, personalizado, solicitud_humano_directa, conversacional, ambiguo, fuera_de_scope
- Sugiere la **rama** (R1–R5 o HANDOFF), la **tool exacta con parámetros**, el tono, la longitud máxima, si mencionar el live
- Detecta **eventos de negocio** (se loguean en `eventos_negocio`) y **objeciones**
- Su salida completa **se persiste** en `estado_conversacion_actual` (`ultima_intencion`, `ultima_objecion`, `ultima_senal_compra`) — el sistema siempre sabe "qué quiere" cada lead sin recomputar

## 1.3 El Agente Madre Sirena (Opus 4.6-fast vía OpenRouter)

La personalidad que conversa. Recibe el brief del Verificador y **ejecuta exactamente lo que éste indica** (regla dura #9: no sustituye tools). Su texto pasa por el **Parse Loop** que lo fragmenta en mensajes ≤180 caracteres respetando párrafos, listas y URLs — para que en WhatsApp se vea orgánico, no robótico. Entre mensajes consecutivos espera 2.5s.

**Reglas inviolables cableadas**: nunca da datos bancarios, nunca cotiza mayoreo, nunca acepta diseños personalizados (handoff inmediato), nunca manda dos catálogos en un turno, nunca repite una FAQ ya respondida, nunca dice ser humana, nunca inventa información.

## 1.4 Las tools del agente

| Tool | Qué hace |
|---|---|
| **enviar_imagen_faq** | Manda la imagen oficial de la FAQ (mapeo fijo: material=1, mínimo=2, pagos=15, envíos=17/18, ubicaciones=23/24, live=26...) y registra qué FAQs ya se respondieron para nunca repetir |
| **enviar_catalogo** | Manda el **catálogo único** (`mardeplatataxco.my.canva.site`). Ya no hay Pandora/TOWS separados. Marca el lead como mayoreo y lo asciende a calificada |
| **invitar_grupo** | Manda **los 3 grupos** de WhatsApp con orden sugerido ("entra al 1, si está lleno el 2, si tampoco el 3") — rotación pasiva sin contadores |
| **handoff_asesora** | Modelo **pull**: crea la alerta SIN asignar y la deja en cola compartida. Si el lead ya tenía asesora habitual, va directo a ella. Etiqueta el lead con el motivo |
| **programar_seguimiento** | Agenda un seguimiento futuro **con snapshot completo del contexto** en ese momento (qué vio, qué preguntó, dónde quedó) |
| **enviar_sitio_menudeo** | R3: manda el link de la web para cierre autónomo |
| **agendar_visita_taxco** | R5: imagen del local + Google Maps correcto según día (entre semana vs sábado) |

## 1.5 Detección automática de señales

Sin LLM, por patrones sobre el texto de la clienta:
- **Revendedora**: 12 patrones ("para revender", "mi tienda", "mis clientes", "surtido", "volumen"...) → marca `es_revendedora=true` una sola vez y **arranca automáticamente su secuencia de restock**
- **Origen del mensaje**: tags `[src:codigo]` en links de campaña + keywords naturales ("vi su anuncio", "por instagram") → deduce canal de entrada
- **Pieza personalizada**: etiqueta el lead para que la asesora sepa revisar la imagen de referencia

---

# PARTE 2 · SEGUIMIENTOS (el corazón comercial)

## 2.1 Máquina de secuencias

Cada lead entra automáticamente a una **secuencia multi-paso** según lo que pasó:

| Secuencia | Disparador | Cadencia |
|---|---|---|
| **lead_frio** | Recibió catálogo/grupos/web y se quedó callada | 24h → 3d → 6d → 10d → 30d |
| **deposito_pendiente** | Apartó y no mandó los $300 | 24h → 48h |
| **post_pedido** | Cerró compra | 7d → 30d |
| **reactivacion** | Dormida | 30d → 60d |
| **restock_revendedora** | Detectada revendedora | cada 21d (su ritmo) |

**El principio de la cadencia**: frecuencia baja, valor sube, ángulo cambia. Paso 1 pregunta con detalle, paso 2 da valor sin pedir nada, paso 3 pregunta directo, paso 4 break-up amable, paso 5 reactivación.

**Cancelación automática**: en cuanto la clienta responde cualquier cosa, TODAS sus secuencias activas se cancelan (motivo "respondió"). Nunca se le insiste a alguien que ya volvió.

## 2.2 Plantillas contextuales

14 plantillas editables desde el dashboard. Soportan:

- **Variables**: `{nombre}` `{ciudad}` `{catalogo_visto}` `{ultima_faq}` `{ultima_objecion}` `{etapa}` `{compras_totales}` `{canal}` `{dias}` `{horas_inactiva}` `{dias_desde_compra}` `{contexto_libre}`
- **Bloques condicionales**: `{si:recurrente}...{/si}` `{si:nuevo}` `{si:vio_catalogo}` `{si:deposito}` `{si:objecion}` `{si:mayoreo}` `{si:revendedora}` `{si:ciudad}` — solo aparecen si la señal es real. **Si el sistema no lo notó, no lo inventa** (la línea que no se cruza)
- Si una variable no tiene valor, se limpia del texto — la clienta jamás ve `{ciudad}` crudo

## 2.3 Executor con skip rules

El cron que envía revisa antes de cada disparo:
- ¿Está en handoff con asesora? → salta (la asesora maneja)
- ¿Respondió después de programarse? → salta (ya no está fría)
- ¿La premisa cambió (post-compra sin compra)? → salta
- Reconstruye el snapshot fresco al momento de enviar para que el texto use datos actuales

Todo envío queda logueado: en `conversaciones` (con tool `seguimiento_automatico`) y en `seguimientos_programados` (con el texto exacto que se mandó y el resultado).

## 2.4 Sandbox de pruebas

En `/configuracion/seguimientos`:
- **Selector de número test** (Libia CEO precargada, ampliable)
- **Modo plantilla o texto libre**, con **previsualización** del render usando los datos reales del lead + el snapshot completo visible
- **Envío real por ManyChat** con diagnóstico transparente: si falla, te dice exactamente qué faltó (API key, subscriber_id, HTTP status de ManyChat)
- **Buscador de diagnóstico**: escribe nombre o cifras y ve bajo qué formato está guardado un contacto, qué etiquetas tiene y si tiene subscriber_id capturado
- Los envíos manuales **cuentan igual** que los automáticos en métricas y pipeline

---

# PARTE 3 · LAS PANTALLAS

## 3.1 Inicio (`/`)

- **3 KPIs grandes**: leads hoy (vs ayer), efectividad del bot (% sin handoff), conversión a venta con monto MXN
- **4 tarjetas operativas**: facturación hoy, pedidos cerrados, leads por canal, alertas activas
- **Embudo de 6 etapas** con detección automática del cuello de botella
- Bloques de tendencias, atribución y Meta Ads
- Rangos: hoy / 7d / 30d / total
- **Todo excluye los números de prueba** (etiqueta `test`) — Libia puede probar sin contaminar cifras

## 3.2 Efectividad (`/efectividad`)

El panel "ver el beneficio, no solo el dato":
- **Hero de 3 cifras**: conversaciones atendidas por Sirena, leads dormidos recuperados (con secuencia → respondieron o compraron), facturación del periodo
- **Las 7 métricas que mueven la aguja**: conversaciones, efectividad bot, cobertura de seguimiento, % de recuperación (respuesta o pedido en 48h post-seguimiento), conversión a pedido, pedidos por canal, tiempo de primera respuesta (mediana)
- **Bloque de seguimientos §03.2**: cuántos se hicieron / cobertura / % recuperación + distribución por tipo
- **ROAS por anuncio**: barras horizontales con código de color (verde ≥4× sube, azul 2–4× mantén, ámbar 1–2× revisa, rojo <1× apaga)
- **Embudo con cuello marcado** en rojo y la fuga en puntos porcentuales

## 3.3 Pipeline (`/pipeline`)

Kanban de **5 columnas**: Lead nueva → Calificada → **Seguimiento** (virtual: leads con seguimientos activos) → Esperando pago → Pagada. Perdidas ocultas en colapsable.

**Cada tarjeta muestra**: nombre, número, canal de entrada (color del borde), ciudad, anuncio de Meta de donde vino (con nombre real de la campaña), chips (Mayoreo/Menudeo, monto, 💎 personalizada, motivo de handoff, ⏰ contador de seguimientos), chip CEO si es Libia. Drag & drop entre columnas + botón de avance rápido.

**Click en tarjeta → drawer lateral** con:
- **Resumen automático en prosa**: "Libia entró por Meta desde CDMX. Es primera vez. Le mandamos el catálogo. Le hemos enviado 2 seguimientos (último hace 3 horas). Lleva 5 horas sin escribir."
- Chips semánticos (etapa, recurrencia, canal, depósito, handoff, objeción)
- Datos completos del lead
- **Programador de seguimientos inline**: atajos (+10min prueba, +2h, +24h) y form libre (tipo + cantidad + min/horas/días)
- Historial completo de seguimientos con estados (enviado/saltado/error/pendiente/atrasado) y el texto exacto que llegó
- Últimos 20 mensajes de la conversación como burbujas
- Acceso directo al chat de WhatsApp

## 3.4 Equipo (`/equipo`)

- **Selector "¿quién está aquí ahora?"** (persiste en el navegador)
- **Cola compartida de handoffs**: alertas sin asignar con chip de motivo, tiempo esperando, urgencia, contexto y botón "Tomar". Modelo pull: la asesora elige, no se le impone
- **Fallback automático**: si nadie toma una alerta en 5 minutos, el cron la asigna por round-robin (menos carga + asignación más antigua)
- **Pila personal**: lo que cada asesora tiene activo, con botón "Atendido" (pide nota opcional, cierra alerta, baja su carga)
- **Tarjetas por asesora** con métricas del día + **widget de cierres** donde Eli/Nat capturan cada pago al recibir comprobante (monto, canal, notas)
- Sin ranking, sin competencia (decisión de diseño)
- Refresh cada 15s

## 3.5 Configuración (`/configuracion`)

| Sub-pantalla | Funcionalidad |
|---|---|
| **Lives** | CRUD de eventos en vivo (fecha, red social, link, código de descuento, promo). Sirena los menciona cuando hay live activo o próximo |
| **Sistema** | CRUD de `config_sistema`: links de catálogo, los 3 grupos, ubicaciones Maps, montos sagrados ($1,500 mínimo, $300 depósito), WhatsApp de Mar |
| **Prompts** | Editor visual del Verificador y del Agente Sirena (protegidos: no se modifican sin autorización) |
| **Credenciales** | Estado de conexiones OpenRouter, ManyChat, Whisper |
| **Meta Ads** | Conexión a Meta Marketing API, ad accounts, tabla de campañas con spend/clicks/CTR/CPC cruzados con leads y facturación real → ROAS y CPL verdaderos |
| **Playground** | Chat de prueba contra el flujo completo con panel de debug (brief del Verificador + tools ejecutadas + outbound). No manda nada real |
| **Seguimientos** | Plantillas editables + sandbox + cola de pendientes + recientes + diagnóstico de números |
| **Webhook** | Inspector de webhooks recibidos en vivo |

---

# PARTE 4 · ATRIBUCIÓN Y OBSERVABILIDAD

## 4.1 Atribución de campañas
- Extracción multi-formato de `ad_id`, `campaign_id`, `adset_id`, `ctwa_clid` y `referral` del webhook (cualquier formato que ManyChat mande)
- Etiquetas automáticas en el lead: `campaign:X`, `adset:Y`, `ctwa:Z`
- Cruce con Meta Marketing API → ROAS y costo por lead **reales** por campaña y por anuncio
- **Diagnóstico automático** (`/api/dashboard/meta/atribucion-diagnostico`): analiza los últimos 100 leads y emite veredicto de si ManyChat propaga la atribución o no, con siguiente paso recomendado

## 4.2 Observabilidad
- **`webhook_log`**: cada webhook persiste completo (body crudo, headers, resultado del flow) — sobrevive a recycles de Vercel
- **`/api/dashboard/webhook-log`**: análisis de qué campos llegan (atribución e identidad) con veredicto humano
- **`/api/dashboard/listo-para-prod`**: checklist de 15+ verificaciones (env vars, modo, Supabase, tablas, Meta API, asesoras, catálogo) con veredicto "LISTO PARA PRENDER"
- **Logging completo por turno**: cada mensaje entrante y saliente en `conversaciones` con intención, confianza, rama, tool y parámetros

## 4.3 Crons (Vercel)

| Cron | Frecuencia | Qué hace |
|---|---|---|
| `/api/cron/seguimientos` | 15 min | Envía seguimientos vencidos con skip rules |
| `/api/cron/secuencias` | 15 min | Avanza la máquina de secuencias |
| `/api/cron/asignar-pendientes` | 5 min | Fallback de handoffs sin tomar |

---

# PARTE 5 · DATOS Y SEGURIDAD

## 5.1 Trazabilidad por lead (todo automático, nada manual)
De cada lead se sabe: de dónde vino (canal + anuncio), en qué etapa está **y desde cuándo** (trigger), qué fue lo último que se le envió y cuándo, cuántos seguimientos lleva, **qué quiere** (última intención/objeción/señal de compra del Verificador), en manos de quién está, si es revendedora, su tiempo de primera respuesta, y si se perdió, **por qué** (enum cerrado de 9 motivos — se pierde y se aprende).

## 5.2 Sistema de pruebas sin contaminación
Números con etiqueta `test` (Libia CEO): conversan normal con Sirena, aparecen en pipeline (con chip CEO), pero **se excluyen de todos los KPIs, embudo, alertas y métricas**.

## 5.3 Modos de operación
- `MODO_PRODUCCION=true` → mensajes reales por ManyChat
- Simulador → flujo completo (Supabase, LLMs, tools, alertas) pero sin enviar nada
- Kaizen → testing E2E con sesiones inyectadas

## 5.4 Schema (15 tablas)
`leads` · `conversaciones` · `estado_conversacion_actual` · `asesoras` · `alertas` · `eventos_negocio` · `eventos_live` · `imagenes_faq` · `cierres_diarios` · `depositos_primera_vez` · `config_sistema` · `seguimientos_programados` · `secuencias_seguimiento` · `secuencia_pasos_ejecutados` · `webhook_log` (+ `chat_memory`, `faqs_candidatas` auxiliares)

Todos los scripts SQL idempotentes en `scripts/sql/` con verificación incluida.

---

# LO QUE QUEDA PARA DESPUÉS (consciente, no olvidado)

1. **Extractor LLM de señales** → desbloquea `{pieza_vista}`, `{categoria_top}` en plantillas
2. **Inventario** → desbloquea `{pieza_apartada}`, `{pieza_comprada}`, avisos de disponibilidad
3. **Escalones de mayoreo** → `{pesos_faltantes}`, `{siguiente_escalon}` (falta la tabla de Mar)
4. **Textos "con qué accionar"** → cuando Libia afine su mente estratega
5. **Decisión de atribución fina** → esperando los primeros webhooks reales para ver qué propaga ManyChat
6. **Confirmación de mecánica de grupos** → con la clienta de Libia

---

**En una frase**: una clienta escribe → Sirena la entiende, la atiende, la clasifica y la empuja por su rama → si se enfría, la cadencia la recupera con mensajes que demuestran que el sistema se fijó → si necesita humano, la asesora correcta la toma de una cola → cada peso se registra → y Mar abre el dashboard y ve cuánto le está dando el sistema, de qué anuncio vino cada venta, y dónde se le está fugando la gente. Sin necesitar vacaciones.

---

*fin · reporte final de funcionalidades · v.2026.06 · azxion · mar_de_plata*

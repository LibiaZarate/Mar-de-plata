# SISTEMA SIRENA · Mar de Plata Taxco
## Reporte de costes operativos y eficiencia
### v.2026.06 · estimaciones mensuales y estrategia

> azxion / caso · mar_de_plata_taxco · Libia Zárate

---

# PARTE 1 · El modelo de costes de WhatsApp (México)

## 1.1 Cómo cobra Meta hoy

Desde **julio 2025** Meta migró de "per-conversation" a **"per-message pricing"**. Lo importante para entender los costes:

| Categoría del mensaje | Cuándo se usa | Precio aproximado MX |
|---|---|---|
| **Service** | Cualquier mensaje que mandas DENTRO de la ventana de 24h después de que la clienta te escribió | **Gratis** |
| **Utility** | Mensaje de plantilla aprobada con info transaccional (confirmaciones, recordatorios de algo que la clienta inició, actualizaciones de pedido) — FUERA de la ventana | ~$0.40 MXN por mensaje |
| **Marketing** | Mensaje de plantilla con intención promocional (promos, novedades, reactivación, recuperación de venta) — FUERA de la ventana | ~$1.25 MXN por mensaje |
| **Authentication** | OTPs y códigos | ~$0.30 MXN (no aplica para Mar) |

## 1.2 La ventana de 24 horas (lo más importante)

**Cada vez que una clienta te manda un mensaje, se abre una ventana de 24 horas durante la cual puedes mandarle CUALQUIER COSA gratis.** Sin plantilla, sin aprobación de Meta, sin costo.

Esta es la palanca más grande de optimización. Cada mensaje del bot dentro de esa ventana es gratis. Cada mensaje fuera **requiere plantilla aprobada y paga**.

## 1.3 Plantillas aprobadas (requisito fuera de la ventana)

Para mandar Marketing o Utility fuera de la ventana, **Meta tiene que aprobar la plantilla previamente**. Esto significa:
- Cada plantilla nueva pasa por revisión (horas a días)
- Meta puede rechazar plantillas que considere spam
- No puedes improvisar — solo mandas las plantillas pre-aprobadas
- ManyChat es quien sube las plantillas a Meta para su aprobación

---

# PARTE 2 · Mapeo: cada seguimiento → su categoría

Aquí está la clave del coste real. No todos los seguimientos cuestan lo mismo.

| Seguimiento | Cuándo dispara | Dentro de ventana 24h? | Categoría WhatsApp |
|---|---|---|---|
| **lead_frio paso 1** (+24h) | 24h después de catálogo | Justo en el límite | Marketing |
| **lead_frio paso 2** (+3d) | 3 días | Fuera | Marketing |
| **lead_frio paso 3** (+6d) | 6 días | Fuera | Marketing |
| **lead_frio paso 4** (+10d) | 10 días | Fuera | Marketing |
| **lead_frio paso 5** (+30d) | 30 días | Fuera | Marketing |
| **deposito_pendiente paso 1** (+24h) | 24h tras apartar | Límite o fuera | **Utility** (recordatorio de transacción pendiente) |
| **deposito_pendiente paso 2** (+48h) | 48h | Fuera | **Utility** |
| **post_pedido paso 1** (+7d) | 7 días tras compra | Fuera | **Utility** (seguimiento post-venta) o Marketing si menciona ofertas |
| **post_pedido paso 2** (+30d) | 30 días | Fuera | Marketing |
| **reactivacion paso 1** (+30d) | 30 días dormida | Fuera | Marketing |
| **reactivacion paso 2** (+60d) | 60 días | Fuera | Marketing |
| **restock_revendedora** | Cada 21 días | Fuera | Marketing |

**Nota crucial**: la diferencia de costo entre Utility y Marketing es **3×**. Reclasificar `deposito_pendiente` y el paso 1 de `post_pedido` como Utility puede ahorrar mucho.

---

# PARTE 3 · Escenario base de volumen

Para calcular costes necesitamos asumir volumen. Estos son los supuestos razonables basados en lo que Mar te ha contado (600–800 mensajes/día durante campañas):

| Métrica | Valor asumido |
|---|---|
| Mensajes entrantes / mes | ~21,000 |
| Leads nuevos / mes | ~4,000 |
| Leads que conversan más de un turno | ~3,000 |
| Leads que califican (R1/R2 efectivos) | ~1,800 (60%) |
| Leads que apartan pieza | ~200 |
| Cierres de venta / mes | ~200 |
| Revendedoras activas | ~50 |
| Leads que se vuelven fríos (cae en cadencia) | ~2,400 |

**Tasas de respuesta por paso de cadencia** (estimadas conservadoras):
- Paso 1 (+24h): 30% responden → 70% sigue al paso 2
- Paso 2 (+3d): 20% responden → 80% sigue al paso 3
- Paso 3 (+6d): 15% responden → 85% sigue al paso 4
- Paso 4 (+10d): 10% responden → 90% sigue al paso 5
- Paso 5 (+30d): mensaje final

---

# PARTE 4 · Cálculo mensual sin optimizar

## 4.1 Mensajes salientes por tipo

| Tipo | Volumen mensual | Categoría | Precio/msg | Subtotal |
|---|---|---|---|---|
| lead_frio paso 1 | 2,400 | Marketing | $1.25 | $3,000 |
| lead_frio paso 2 | 1,680 | Marketing | $1.25 | $2,100 |
| lead_frio paso 3 | 1,344 | Marketing | $1.25 | $1,680 |
| lead_frio paso 4 | 1,142 | Marketing | $1.25 | $1,428 |
| lead_frio paso 5 | 1,028 | Marketing | $1.25 | $1,285 |
| deposito_pendiente (2 pasos) | 400 | Utility | $0.40 | $160 |
| post_pedido paso 1 | 200 | Utility | $0.40 | $80 |
| post_pedido paso 2 | 200 | Marketing | $1.25 | $250 |
| reactivacion (2 pasos) | 400 | Marketing | $1.25 | $500 |
| restock_revendedora | 50 | Marketing | $1.25 | $63 |
| **Total WhatsApp** | **8,844 msg** | | | **$10,546 MXN** |

## 4.2 Otros costes del sistema

| Servicio | Cálculo | Subtotal MX |
|---|---|---|
| **OpenRouter** · Verificador Haiku (~21,000 turnos × ~$0.0008 USD) | $16.80 USD | $336 |
| **OpenRouter** · Agente Sirena Opus fast (~21,000 turnos × ~$0.012 USD) | $252 USD | $5,040 |
| **OpenAI Whisper** (~4,200 audios × 15s × $0.006/min) | $6.30 USD | $126 |
| **Vercel** Pro | $20 USD | $400 |
| **Supabase** Pro | $25 USD | $500 |
| **ManyChat** Pro (~3,000 contactos activos) | $45 USD | $900 |
| **Total infraestructura** | | **$7,302 MXN** |

## 4.3 Total mensual sin optimizar

| Categoría | Costo MX |
|---|---|
| WhatsApp templates | $10,546 |
| Infraestructura (LLMs, hosting, ManyChat) | $7,302 |
| **TOTAL** | **~$17,848 MXN/mes** |

---

# PARTE 5 · Estrategias de eficiencia

Cinco estrategias en orden de impacto. Las primeras dos son las que más bajan la cuenta sin sacrificar resultado comercial.

## Estrategia A · Aprovechar la ventana de 24h (ahorro ~20%)

**El insight**: cada vez que una clienta escribe, se abren 24h donde TODO es gratis. Si la respuesta de Sirena cae dentro de la ventana, no paga. Hoy ya lo hace bien — pero hay un caso a vigilar.

**Lo que ya está bien**:
- Las respuestas conversacionales de Sirena (catálogo, FAQ, grupos, web) siempre van dentro de la ventana que la clienta abrió al escribir. Cero costo.
- Los handoffs a asesora también van dentro de la ventana.

**Lo que se puede optimizar**:
- **Mover lead_frio paso 1 a las 23h en vez de 24h**. Si la clienta no respondió, el bot manda dentro de la ventana (gratis) en vez de fuera (Marketing $1.25). 
- Ahorro: 2,400 mensajes × $1.25 = **$3,000 MXN/mes**

**Riesgo**: si la clienta escribió a las 8pm y el bot dispara a las 7pm del día siguiente, técnicamente sigue dentro de la ventana de 24h. Pero hay que afinar al minuto, no a la hora.

## Estrategia B · Reclasificar como Utility lo que puede ser Utility (ahorro ~15%)

**El insight**: Meta acepta como Utility cualquier mensaje que sea sobre algo que la clienta inició (apartado, compra, pedido). Marketing es solo cuando empujas algo nuevo.

**Plantillas a recategorizar**:
- `deposito_pendiente` → ya está como Utility (es recordatorio de transacción)
- `post_pedido paso 1` → Utility (seguimiento post-venta, no promoción)
- `post_pedido paso 2` → si elimina mención de promociones, Utility

**Ahorro**: 200 mensajes pasan de $1.25 a $0.40 → **$170 MXN/mes**

Pequeño en pesos pero **establece la disciplina**: cuando redactes plantillas nuevas, pregúntate "¿esto es promoción o info?".

## Estrategia C · Capear la cadencia según valor del lead (ahorro ~35%)

**El insight**: no todos los leads merecen 5 pasos. Mandarle 5 mensajes de cadencia a alguien que pidió un dije de $80 no tiene retorno.

**Segmentación propuesta**:

| Tipo de lead | Cadencia |
|---|---|
| **Mayoreo + ciudad confirmada** | Cadencia completa (5 pasos) |
| **Mayoreo sin ciudad** | 3 pasos (24h, 6d, 30d) |
| **Menudeo** | 2 pasos (24h, 10d) |
| **Sin clasificar** | 2 pasos (24h, 30d) |

**Ahorro estimado**: ~35% menos mensajes salientes en lead_frio.
- Pasamos de 7,594 a ~4,900 mensajes lead_frio/mes
- Ahorro: 2,700 × $1.25 = **$3,375 MXN/mes**

## Estrategia D · Cancelar cadencia cuando el ROI esperado no compensa (ahorro ~10%)

**El insight**: si una clienta llevó 3 pasos sin responder, el paso 4 y 5 estadísticamente tienen tasa de respuesta <2%. Cada uno cuesta $1.25 a cambio de probabilidad casi nula.

**Regla propuesta**: si no respondió en pasos 1, 2 y 3 → no enviar 4 ni 5. Solo entrar a `reactivacion` a los 60 días.

**Ahorro**: ~1,000 mensajes/mes → **$1,250 MXN**.

## Estrategia E · Sub-batching para evitar saturación de Meta (operativo, no de costo)

**El problema**: si tienes una avalancha de seguimientos al mismo minuto, Meta puede penalizar tu rating de calidad y eventualmente cobrar más o limitarte.

**Mitigación**: el cron actual ya manda de forma escalonada (cada 15 min procesa los vencidos). Es suficiente para los volúmenes proyectados.

---

# PARTE 6 · Escenarios comparados

## 6.1 Escenario "sin tocar nada" (actual)

| Concepto | MX/mes |
|---|---|
| WhatsApp | $10,546 |
| Infraestructura | $7,302 |
| **Total** | **$17,848** |

## 6.2 Escenario "optimización razonable" (recomendado)

Aplicar A + B + C (cap por valor de lead):

| Concepto | MX/mes |
|---|---|
| WhatsApp optimizado | $4,000 |
| Infraestructura | $7,302 |
| **Total** | **$11,302** |

**Ahorro vs base: $6,546 MXN/mes (~37%)**

## 6.3 Escenario "optimización agresiva"

Aplicar A + B + C + D:

| Concepto | MX/mes |
|---|---|
| WhatsApp ultra-optimizado | $2,800 |
| Infraestructura | $7,302 |
| **Total** | **$10,102** |

**Ahorro vs base: $7,746 MXN/mes (~43%)**

**Trade-off**: pierdes ~5-8% de oportunidades de recuperación al cortar la cadencia más rápido.

## 6.4 Escenario "crecimiento" (2x volumen)

Si Mar duplica el tráfico (mayor pauta), los costes escalan así:

| Concepto | MX/mes |
|---|---|
| WhatsApp (optimización razonable, doble volumen) | $8,000 |
| OpenRouter (doble turnos) | $10,752 |
| Whisper, Vercel, Supabase, ManyChat | $2,100 |
| **Total** | **~$20,852** |

Punto importante: **la infraestructura (LLMs) escala más rápido que WhatsApp** porque cada conversación tiene varios turnos pero pocos seguimientos. A medida que creces, los LLMs se vuelven el costo dominante.

---

# PARTE 7 · Cómo se ve el coste por venta

Esta es la métrica que realmente importa para Mar: **¿cuánto le cuesta el sistema por cada venta cerrada?**

Con el escenario base optimizado:
- Costos mensuales: $11,302 MXN
- Ventas mensuales: ~200 cierres
- **Costo por venta: ~$56 MXN**

Si el ticket promedio de mayoreo es $1,500 MXN, el sistema le cuesta a Mar **3.7% del ticket** en operación tecnológica.

Eso es competitivo. Una asesora que cobre $8,000 MXN/mes hace ~50 ventas → costo por venta humana ~$160 MXN. **Sirena es 3× más eficiente por venta cerrada** (sin contar lo que aguanta para que las asesoras se enfoquen en cierres).

---

# PARTE 8 · Recomendaciones accionables

## 8.1 Inmediatas (antes de prender en producción)

1. **Mover lead_frio paso 1 a 23h** en vez de 24h. Cambio de una línea en `secuencias.ts`. Ahorra $3,000 MXN/mes.
2. **Etiquetar correctamente las plantillas en ManyChat** como Utility o Marketing antes de subirlas a Meta. Lo defines tú al cargarlas.
3. **Subir todas las plantillas a Meta para aprobación previa** — sin esto no puedes mandar nada fuera de la ventana de 24h. Es bloqueante de producción.

## 8.2 Mes 1 (con datos reales)

1. **Medir tasa de respuesta real por paso** con los primeros 1,000 leads. Si los datos confirman que el paso 4 y 5 tienen <2% respuesta, cortar la cadencia ahí.
2. **Implementar segmentación por valor de lead** (mayoreo vs menudeo). Cambios menores en la lógica de iniciar secuencia.
3. **Establecer cap mensual de mensajes** por lead (máx 8 mensajes / lead / mes). Hard límite para que un lead activo no consuma $10 en plantillas.

## 8.3 Trimestre 1

1. **A/B testing de plantillas**: dos variantes por paso, medir cuál genera más respuesta. Cancelar la perdedora.
2. **Detección de "lead morfo"**: si un lead lleva 3 meses sin responder a nada, marcarlo `perdida` automáticamente. Deja de entrar a reactivación.
3. **Migrar Opus a Sonnet en el agente** si la calidad lo permite. Sonnet cuesta 1/3 de Opus. Posible ahorro: $3,360 MXN/mes en LLMs.

## 8.4 La pregunta de oro para cada plantilla nueva

Antes de redactar cualquier mensaje, pregúntate:

> ¿Este mensaje puede vivir dentro de la ventana de 24h?

Si la respuesta es sí, redacta el flujo conversacional para que dispare dentro. Si no, redacta la plantilla y categorízala correctamente.

---

# PARTE 9 · Costes que NO están incluidos pero hay que mencionar

1. **Costos de Meta pauta**: el dinero que Mar gasta en anuncios. No es del sistema, es del negocio. El dashboard ya mide ROAS.
2. **Costos de inventario / hechura / envíos**: tampoco del sistema. Fase futura cuando registres costo por pieza.
3. **Plan de WhatsApp Business**: el número en sí. Suele ir incluido en ManyChat Pro.
4. **Soporte y mantenimiento de tu lado**: tus horas, mi tiempo, etc.

---

# PARTE 10 · Resumen ejecutivo en una tabla

| Escenario | Volumen | WhatsApp | Infra | **Total** | Costo/venta |
|---|---|---|---|---|---|
| Sin optimizar | 4,000 leads | $10,546 | $7,302 | **$17,848** | $89 |
| Optimización razonable | 4,000 leads | $4,000 | $7,302 | **$11,302** | $57 |
| Optimización agresiva | 4,000 leads | $2,800 | $7,302 | **$10,102** | $51 |
| Crecimiento 2× (optimizado) | 8,000 leads | $8,000 | $12,852 | **$20,852** | $52 |

**Recomendación**: arrancar con optimización razonable. Aplicar A + B + C antes de producción. Medir un mes con datos reales. Decidir si escalar a agresiva o no según los datos.

---

*fin · reporte de costes operativos · v.2026.06 · azxion · mar_de_plata*

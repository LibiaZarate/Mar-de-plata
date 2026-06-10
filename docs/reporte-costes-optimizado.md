# SISTEMA SIRENA · Reducción agresiva de costes
## v.2026.06 · escenarios reales para bajar de $17k a $4k–6k MXN/mes

> azxion / caso · mar_de_plata_taxco · Libia Zárate

---

# Diagnóstico honesto

El coste base de $17,848 MXN/mes está mal calibrado para una operación pequeña como Mar de Plata Taxco. Estaba dimensionado para "bot completo con todo". Pero el 80% de la recuperación de leads viene de los primeros 1–2 toques — los pasos 3–5 de cadencia son rendimientos decrecientes que no valen la pena.

**Dónde está realmente el dinero:**

| Concepto | $/mes | % del total | Palanca de ahorro |
|---|---|---|---|
| LLMs (Opus + Haiku) | $5,376 | 30% | Cambiar modelo |
| Lead_frio paso 1 (innecesariamente fuera de ventana) | $3,000 | 17% | Mover a 23h |
| Lead_frio pasos 4 y 5 (poca conversión) | $2,713 | 15% | Eliminar |
| Lead_frio paso 3 | $1,680 | 9% | Condicional |
| ManyChat + infra | $1,800 | 10% | Fijo |
| Resto seguimientos | $3,279 | 18% | Optimización menor |

**La cuenta**: 47% del coste está en LLMs y dos pasos de lead_frio que pueden eliminarse o moverse a gratis.

---

# Las 6 palancas reales (en orden de impacto)

## Palanca #1 · Migrar Opus → Sonnet en el agente

**Hoy**: el Agente Madre usa `claude-opus-4.6-fast` a ~$0.012/turno × 21,000 turnos = $5,040/mes.

**Cambio**: a `claude-sonnet-4.6` ~$0.004/turno = $1,680/mes.

**Ahorro**: **$3,360 MXN/mes** (mayor ahorro individual).

**Trade-off**: Sonnet es 70% del nivel de razonamiento de Opus. Para un bot que ejecuta tools predefinidas y conversa con personalidad, es más que suficiente. Si después de un mes ves que cae la calidad notable, lo reviertes. Es un cambio de una línea.

**Riesgo bajo. Implementación trivial.**

## Palanca #2 · Mover lead_frio paso 1 a 23h (entrar en ventana)

**Hoy**: dispara a las 24h, fuera de la ventana del cliente, requiere plantilla Marketing = $1.25/mensaje.

**Cambio**: dispara a las 23h. Cae dentro de la ventana de 24h que abrió la clienta cuando escribió. **Gratis**.

**Ahorro**: 2,400 mensajes × $1.25 = **$3,000 MXN/mes**.

**Trade-off**: ninguno real. La clienta recibe el mismo mensaje 1 hora antes.

**Riesgo cero. Implementación trivial (una línea en `secuencias.ts`).**

## Palanca #3 · Eliminar pasos 4 y 5 del lead_frio

**Hoy**: si los primeros 3 pasos no convirtieron, los pasos 4 (+10d) y 5 (+30d) tienen <2% de tasa de respuesta. Costan ~$2,713 MXN/mes combinados.

**Cambio**: el lead que llega al paso 3 sin responder pasa directo a estado `dormido`. Solo vuelve por `reactivacion_60d` (un solo mensaje).

**Ahorro**: **$2,713 MXN/mes**.

**Trade-off**: pierdes ~3-5% de recuperaciones marginales. Es menos del 1% del revenue total.

**Riesgo bajo. Decisión de producto.**

## Palanca #4 · Segmentación dura por valor de lead

**Hoy**: todos los leads reciben la misma cadencia.

**Cambio**:
- **Mayoreo confirmado** (mostró interés explícito en cotización): 2 pasos (23h + 7d)
- **Mayoreo sin confirmar**: 1 paso (23h, dentro de ventana = gratis)
- **Menudeo**: 0 seguimientos automáticos (la web cierra sola, no vale el costo)

**Ahorro**: ~50% del volumen de seguimientos = **~$1,500 MXN/mes adicionales**.

**Trade-off**: leads de menudeo no reciben recordatorio. Los que de verdad quieren comprar vuelven solos a la web; los que no, no iban a comprar.

**Riesgo medio. Requiere afinar la lógica de iniciar secuencia.**

## Palanca #5 · Migrar Verificador → reducir a llamadas críticas

**Hoy**: Verificador se ejecuta en cada turno (Haiku 4.5 = $336/mes).

**Cambio**: solo ejecutarlo cuando hay ambigüedad real (turnos 1-3 de la conversación y cuando la clienta cambia de tema). Después, usar el último brief cacheado y pasar directo al agente.

**Ahorro**: **~$200 MXN/mes** + un poco menos latencia.

**Trade-off**: el bot puede ser menos preciso si la clienta cambia de tema sin avisar. Mitigable con cache de 5-10 minutos.

**Riesgo medio. Implementación moderada.**

## Palanca #6 · Cron menos frecuente

**Hoy**: cron de seguimientos corre cada 15 min.

**Cambio**: cada 30 min. La clienta recibe el seguimiento 7-15 min después del momento ideal, lo que es invisible.

**Ahorro**: marginal en infra (~$100 MXN/mes).

**Trade-off**: ninguno perceptible.

**Riesgo cero.**

---

# Los 3 escenarios reales

## Escenario A · Optimización razonable

**Aplica**: Palancas #1, #2, #3.

| Concepto | $/mes |
|---|---|
| WhatsApp templates (4,884 msg) | $5,883 |
| LLMs (Sonnet + Haiku) | $2,016 |
| Whisper + Vercel + Supabase + ManyChat | $1,930 |
| **Total** | **$9,829** |

**Ahorro vs base**: $8,019 MXN/mes (45%).

## Escenario B · Optimización fuerte (mi recomendación)

**Aplica**: Palancas #1, #2, #3, #4.

| Concepto | $/mes |
|---|---|
| WhatsApp templates (2,800 msg) | $2,800 |
| LLMs (Sonnet + Haiku) | $2,016 |
| Whisper + Vercel + Supabase + ManyChat | $1,930 |
| **Total** | **$6,746** |

**Ahorro vs base**: $11,102 MXN/mes (62%).

**Costo por venta**: ~$34 MXN. Sigue siendo 4× más eficiente que una asesora humana.

## Escenario C · Optimización ultra-agresiva

**Aplica**: todas las palancas (#1 a #6).

| Concepto | $/mes |
|---|---|
| WhatsApp templates (2,500 msg) | $2,500 |
| LLMs (Sonnet + Verificador reducido) | $1,816 |
| Whisper + Vercel + Supabase + ManyChat | $1,830 |
| **Total** | **$6,146** |

**Ahorro vs base**: $11,702 MXN/mes (66%).

**Trade-off**: pierdes ~5-8% de recuperaciones, el verificador puede tener errores en cambios de tema, latencia ligeramente mayor.

---

# Tabla comparativa

| Escenario | Total $/mes | Ahorro | Costo/venta | Trade-off |
|---|---|---|---|---|
| Base actual | $17,848 | — | $89 | — |
| A · Razonable | $9,829 | 45% | $49 | Mínimo |
| **B · Fuerte (recomendado)** | **$6,746** | **62%** | **$34** | Bajo (~3% recuperación menos) |
| C · Ultra-agresivo | $6,146 | 66% | $31 | Medio (~7% recuperación menos) |

---

# Mi recomendación firme

**Escenario B**, sin titubear. Razones:

1. **Sonnet es suficiente** para la complejidad real del bot (conversación + tools). Opus es overkill.
2. **El cambio de 24h a 23h es gratis** — no hay razón para no hacerlo.
3. **Eliminar pasos 4-5 no duele**: pierdes <2% de recuperaciones por ~$2,713/mes. Mala relación.
4. **Segmentar por valor** es la disciplina correcta: no se le mete dinero a un lead que pidió un dije de $80.

Lo que **NO** recomiendo del C: reducir el Verificador. Es donde menos se ahorra y donde más riesgo introduces. Mejor mantenerlo como está.

---

# Implementación concreta del Escenario B

Te listo los cambios exactos:

## Cambio 1 · Modelo Sonnet en el agente

```typescript
// src/lib/agent/openrouter.ts o donde defines el modelo
const AGENTE_MODEL = "anthropic/claude-sonnet-4.6"; // antes: opus-4.6-fast
```

**Tiempo: 5 minutos.** Build + deploy y listo.

## Cambio 2 · Lead_frio paso 1 a 23h

```typescript
// src/lib/seguimientos/secuencias.ts
const SECUENCIAS_CONFIG = {
  lead_frio: {
    pasos: [
      { offset_horas: 23 }, // antes: 24
      { offset_horas: 72 },
      // pasos 3-5 eliminados (ver siguiente cambio)
    ],
  },
  // ...
};
```

**Tiempo: 5 minutos.**

## Cambio 3 · Eliminar pasos 4 y 5

Mismo archivo `secuencias.ts`. Eliminar los pasos +10d y +30d del `lead_frio`. El paso final pasa a ser el actual paso 3 (+6d).

Cuando un lead completa esos 3 pasos sin responder, la secuencia marca `finalizada_en = NOW()` y queda dormida. La `reactivacion_30d` cubre el ciclo largo.

**Tiempo: 15 minutos.**

## Cambio 4 · Segmentación por valor

```typescript
// src/lib/seguimientos/secuencias.ts
function decidirCadenciaSegunValor(lead: Lead): CadenciaConfig {
  const esConfirmadoMayoreo =
    lead.tipo === "mayoreo" &&
    (lead.intencion_compra_detectada || lead.compras_totales > 0);

  if (esConfirmadoMayoreo) return CADENCIAS.completa;
  if (lead.tipo === "mayoreo") return CADENCIAS.una_oportunidad;
  return CADENCIAS.ninguna; // menudeo
}
```

**Tiempo: 30 minutos** (incluye crear las 3 variantes de cadencia).

---

# Total de trabajo de implementación

**Aproximadamente 1 hora de código + 15 minutos de testing.**

Resultado: pasas de $17,848 a $6,746 MXN/mes. **62% menos.**

---

# Lo que NO recomiendo aunque salga en otros consultorios

1. **Quitar el verificador completo**: pierdes precisión en clasificación de rama. El Haiku cuesta centavos, vale lo que cuesta.
2. **Reemplazar todo por Haiku** (incluido el agente): para una conversación con cliente real es subdimensionado. El bot se siente más robot. Mejor Sonnet.
3. **Eliminar el sandbox de pruebas**: no consume nada y te ahorra muchos errores en producción.
4. **Recortar logging**: el coste de la tabla `webhook_log` es prácticamente cero y te salva la vida cuando hay que diagnosticar algo.

---

# Una nota sobre costo por venta

Con escenario B, el sistema le cuesta a Mar **$34 MXN por venta cerrada**. Si su ticket promedio de mayoreo es $1,500, eso es **2.3% del ticket**. Una asesora humana cobrando $8,000/mes y haciendo 50 ventas cuesta $160/venta = **10.7% del ticket**.

**Sirena en escenario B es 5× más eficiente que una asesora pura, sin contar lo que aguanta de pre-calificación para que las asesoras se enfoquen solo en cerrar.**

A ese costo, el sistema se justifica solo. La conversación con Mar puede ser: "$6,750 al mes te ahorra el equivalente de 2 asesoras y media en tareas mecánicas, mientras las dos que tienes cierran más porque no se queman con preguntas básicas".

---

*fin · reducción agresiva de costes · v.2026.06 · azxion · mar_de_plata*

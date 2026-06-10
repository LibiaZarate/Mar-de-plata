# SISTEMA SIRENA · Modo Ultra-Light
## v.2026.06 · escenario de máximo $40 USD/mes ($800 MXN)

> azxion / caso · mar_de_plata_taxco · Libia Zárate

---

# Planteamiento honesto

Llegar a $40 USD/mes con el sistema completo es imposible. Llegar con el sistema **reducido a lo esencial** sí. Este documento describe cómo, qué pierdes en el camino, y cuándo sí vale la pena.

**Lo importante**: no estamos optimizando. Estamos amputando. Lo digo para que entres con los ojos abiertos.

---

# Punto de partida

| Escenario | $/mes MXN | $/mes USD |
|---|---|---|
| Base actual | $17,848 | $890 |
| Escenario B (optimización fuerte) | $6,746 | $337 |
| **Meta (ultra-light)** | **$800** | **$40** |

Necesitamos cortar **$5,946 MXN adicionales** desde el escenario B. Vamos uno por uno.

---

# Las 5 amputaciones para llegar a $40 USD

## Amputación #1 · Sustituir Claude por Gemini 2.5 Flash

**Hoy (escenario B)**: Sonnet en agente + Haiku en verificador = $2,016 MXN/mes.

**Cambio**: Gemini 2.5 Flash para todo. Cuesta ~$0.00015 USD/1k tokens input, $0.0006/1k output.

**Cálculo**: 21,000 turnos × ~$0.0006 USD = $12.60 USD = **$252 MXN/mes**.

**Ahorro**: **$1,764 MXN/mes** (87% menos en LLMs).

**Trade-off real**:
- Gemini Flash es notablemente más robot en español neutro
- Le falta el "tono Sirena" cálido que Opus/Sonnet manejan bien
- En conversaciones complejas (objeciones, regateo) responde más plano
- Funciona bien para clasificación e intención. Funciona regular para personalidad

**Mitigación**: prompts más largos y específicos para forzar el tono. Vas a tener que iterar 2-3 veces el prompt para que se sienta menos genérico.

## Amputación #2 · Eliminar seguimientos automáticos fuera de ventana

**Hoy (escenario B)**: $2,800 MXN/mes en plantillas Marketing y Utility.

**Cambio**: solo mandar UN seguimiento crítico (depósito pendiente, Utility a $0.40).

**Cálculo**: 200 mensajes × $0.40 = **$80 MXN/mes**.

**Ahorro**: **$2,720 MXN/mes**.

**Trade-off brutal**:
- Pierdes la cadencia de lead_frio completa
- Pierdes reactivación a 30 días
- Pierdes restock automático a revendedoras
- La recuperación de leads dormidos cae de ~22% a ~5% (solo los que vuelven solos)
- En un mes con 4,000 leads, pierdes ~85 ventas potenciales (asumiendo 30% recovery rate de los 280 que recuperabas)

**Mitigación**: Eli y Nat hacen los seguimientos a mano desde el pipeline para los leads de mayor valor (mayoreo grande). El bot solo recupera los críticos.

## Amputación #3 · Free tiers de Vercel + Supabase

**Hoy**: Vercel Pro ($400 MXN) + Supabase Pro ($500 MXN) = $900 MXN/mes.

**Cambio**: ambos en Free tier = $0.

**Límites del free tier**:
- **Vercel Free**: 100GB bandwidth/mes, 100k invocaciones de funciones serverless, máximo 10s por función
- **Supabase Free**: 500MB DB, 5GB egress/mes, 500MB file storage, pausa después de 1 semana sin actividad

**Cálculo de holgura**:
- 21,000 mensajes/mes × ~3 invocaciones cada uno = 63,000 (debajo del límite de 100k)
- DB actual: <50MB. Crecimiento lento (~5MB/mes). Aguanta ~7 años en free tier.
- Egress: típicamente <1GB/mes. Holgura.

**Ahorro**: **$900 MXN/mes**.

**Trade-off**:
- Riesgo si Mar prende una campaña masiva: superas las 100k invocaciones y Vercel cobra por excedente
- Soporte cero por parte de Vercel/Supabase
- Si te quedas inactiva 7 días en Supabase Free, pausa la DB (recoverable pero molesto)

**Mitigación**: alerta en monitoring para saltar a Pro si te acercas al 80% de los límites.

## Amputación #4 · Eliminar Whisper (audio = handoff)

**Hoy**: Whisper $130 MXN/mes (~21% de mensajes son audio).

**Cambio**: si llega audio, el bot responde "Te paso con una asesora porque me funciona mejor con texto 💗" y dispara handoff.

**Ahorro**: **$130 MXN/mes**.

**Trade-off**:
- 21% del volumen pasa a handoff inmediato (más carga para asesoras)
- Más de 4,400 conversaciones/mes que antes resolvía el bot ahora son humanas

**Mitigación**: ninguna realmente. Pierdes esa eficiencia. Para Mar de Plata donde el voice mensaje es común, esto duele.

## Amputación #5 · ManyChat al plan mínimo o switch a Twilio

**Hoy**: ManyChat Pro $900 MXN/mes (~$45 USD).

**Cambio**:
- ManyChat Free plan = $0 (limitado a 1,000 contactos)
- Si superas 1,000 contactos: switch a Twilio WhatsApp API directo

**Twilio cobra**: $0.005 USD por sesión + costos de mensajes (que igual pagas a Meta).

**Cálculo Twilio**: 4,000 leads × $0.005 = $20 USD/mes (~$400 MXN).

**Ahorro**: $900 - $400 = **$500 MXN/mes** (con Twilio).
O **$900 MXN/mes completos** si te quedas en ManyChat Free durante el primer mes.

**Trade-off**:
- ManyChat Free es muy limitado para producción real (1,000 contactos)
- Migrar a Twilio es trabajo de ~15-20 horas (reescribir capa de WhatsApp)
- Pierdes el editor visual de flows de ManyChat (que aunque no usas para Sirena, sirve para flows manuales)

**Mitigación**: empezar con ManyChat Free para validar el modelo. Migrar a Twilio o pagar Pro cuando ganes tracción.

---

# Cuenta final modo ultra-light

| Concepto | $/mes MXN | $/mes USD |
|---|---|---|
| Gemini Flash (todos los turnos) | $252 | $12.60 |
| WhatsApp solo crítico (depósito) | $80 | $4.00 |
| Vercel Free | $0 | $0 |
| Supabase Free | $0 | $0 |
| ManyChat Free (o Twilio mínimo) | $0–400 | $0–20 |
| Sin Whisper | $0 | $0 |
| **Total** | **$332–732** | **$16.60–36.60** |

**Llegamos a $40 USD máximo. De hecho, con holgura.**

---

# Lo que de verdad pasa con el sistema en este modo

**Sirena reducida al núcleo conversacional**:
- Atiende cualquier mensaje entrante con personalidad (aunque más simple)
- Manda catálogo, grupos, web, FAQs según rama
- Hace handoff cuando aplica
- Solo recupera leads críticos (depósito pendiente)
- No transcribe audios
- No hace cadencia larga
- No restock automático

**Es un bot de primer contacto y triaje, no un sistema de recuperación.**

---

# Tres escenarios prácticos donde sí tiene sentido

## Cuándo el modo ultra-light es razonable

1. **Validación inicial**: prendes el sistema con tráfico bajo, mides 30 días con poco riesgo financiero, después decides escalar.

2. **Temporada baja**: meses sin campañas activas. El volumen baja a ~1,000 leads/mes. No vale la pena pagar el sistema completo.

3. **Después de un mes malo**: si la facturación cayó por razones externas, modo de supervivencia hasta que se recupere.

## Cuándo NO usar modo ultra-light

1. **Durante campaña Meta activa**: el costo del sistema es irrelevante comparado con lo que estás pagando en pauta. Mantente en escenario B y captura todo lo posible.

2. **Si Mar reportó "muchos audios"**: pierdes 21% del tráfico que pasa a handoff humano. Tus asesoras se queman.

3. **Si la tasa de recuperación con cadencia completa es alta (>20%)**: estás dejando dinero en la mesa cortándola.

---

# Configuración híbrida (mi recomendación real)

En vez de modo ultra-light fijo, **modo dinámico**:

```typescript
// src/lib/agent/config-dinamica.ts
export function getConfigSegunFecha(): SistemaConfig {
  if (hayCampañaActiva()) return ESCENARIO_B;       // ~$337/mes
  if (esTemporadaBaja()) return ESCENARIO_ULTRALIGHT; // ~$40/mes
  return ESCENARIO_A;                                // intermedio ~$130/mes
}
```

**Promedio anual**: si 3 meses al año son temporada baja, 6 meses son intermedios, y 3 son campaña fuerte:
- 3 × $40 + 6 × $130 + 3 × $337 = $1,911 USD/año = **$160 USD promedio mensual**

Comparado con $890/mes base: **82% de ahorro** sin amputar permanentemente nada. Solo activas/desactivas según necesidad real.

---

# Mi recomendación firme

**Para llegar a $40 USD/mes en escenario exagerado, sí se puede.** Las 5 amputaciones lo logran.

**Pero te recomiendo NO operar permanentemente en ese modo.** Es supervivencia, no estrategia.

Mejor: **deja el código preparado para alternar entre escenarios** (B, A, ultra-light) con una sola variable de configuración. Operas en B durante campañas, en A en intermedio, en ultra-light en bajadas extremas. Mantienes el sistema completo disponible cuando lo necesitas.

---

# Implementación concreta del modo dinámico

1. **Tabla `config_sistema`** con clave `modo_operacion`: valores `full | medio | ultralight`
2. **Endpoint admin** en `/configuracion/sistema` para que tú o Mar cambien el modo con un toggle
3. **Lógica en agente**: según el modo, elige modelo (Sonnet/Gemini), si activa seguimientos completos, si transcribe audios
4. **Alerta automática**: si el volumen sube de X mensajes/día, sugiere subir a modo full

**Tiempo de implementación**: 3-4 horas.

**Resultado**: control fino del costo según necesidad real del negocio, sin perder el sistema completo.

---

# El número que importa

| Modo | $/mes | Lo que pierdes |
|---|---|---|
| Escenario B (campaña) | $337 USD | Nada |
| Escenario A (intermedio) | $130 USD | 5% recuperaciones |
| **Ultra-light (mínimo)** | **$40 USD** | Cadencia, audio, calidad de bot |
| **Promedio anual dinámico** | **~$160 USD** | Casi nada (solo durante bajadas) |

A $160 USD promedio mensual ($3,200 MXN), Sirena cuesta **~1.6% del ticket de mayoreo**. Es 7× más barato que una asesora pura.

**Esa es la cifra que le presentas a Mar.**

---

*fin · modo ultra-light · v.2026.06 · azxion · mar_de_plata*

# SISTEMA SIRENA · Seguimientos · Detalle real para Meta Templates
## v.2026.06 · qué hay implementado HOY y cómo traducirlo a plantillas

> azxion / caso · mar_de_plata_taxco · Libia Zárate

---

# Aclaración honesta antes de empezar

En reportes previos hablé de "máquina de secuencias" multi-paso. **Eso es aspiracional, no está construido**. Lo que SÍ existe es un sistema de seguimientos one-shot: cada seguimiento es un mensaje único programado para una fecha futura. Tres pasos:

1. El agente decide que toca programar uno (vía tool `programar_seguimiento`)
2. El cron lo dispara a la fecha programada
3. Se cancela automáticamente si la clienta vuelve a escribir

No hay cadencia 24h → 3d → 6d → 10d → 30d todavía. Eso vendría después si se implementa la máquina de estados.

Te lo digo así para que las plantillas Meta que registres reflejen lo que tienes hoy, no lo que está en planes.

---

# Los 5 tipos de seguimientos implementados

## 1. `lead_frio_24h`

**Cuándo dispara**: 24 horas después de que el agente lo programa.

**Cuándo lo programa el agente**: el Verificador lo sugiere cuando detecta:
- La clienta recibió catálogo, grupos o web
- No mostró señal clara de compra inmediata
- La conversación cerró sin compromiso

**Plantilla actual (con bloques condicionales)**:
```
¡Hola {nombre}! 💗 

{si:vio_catalogo}
¿Pudiste ver el catálogo de {catalogo_visto}? Quedó pendiente lo de {ultima_faq} ✨
{/si}

{si:nuevo}
Te paso de vuelta por aquí 💗 ¿Sigues interesada o tienes alguna duda?
{/si}

{si:recurrente}
¿Sigues por aquí, linda? Sé que ya conoces nuestras piezas — ¿te dejo el catálogo nuevo?
{/si}
```

**Variables que usa**: `{nombre}`, `{catalogo_visto}`, `{ultima_faq}`.

**Categoría Meta**: **Marketing** (recupera lead, intención promocional).

---

## 2. `post_compra_7d`

**Cuándo dispara**: 7 días después de que el agente lo programa.

**Cuándo lo programa el agente**: después de un cierre de venta confirmado.

**Plantilla actual**:
```
¡Hola {nombre}! 💕 

Pasaron unos días desde tu pedido — ¿cómo te fueron tus piezas? 
Nos encantaría ver una foto si gustas etiquetarnos 💗

{si:recurrente}
Mil gracias por confiar otra vez 💎
{/si}
```

**Variables que usa**: `{nombre}`.

**Categoría Meta**: **Utility** (seguimiento post-venta, no promocional). 

---

## 3. `deposito_pendiente_24h`

**Cuándo dispara**: 24 horas después de que el agente lo programa.

**Cuándo lo programa el agente**: cuando la clienta apartó pieza en live/grupo pero no mandó los $300 del depósito.

**Plantilla actual**:
```
¡Hola {nombre}! 💗 

¿Pudiste hacer el depósito de las piezas que apartamos? 
Aviso para no soltarlas a alguien más ✨

{si:objecion}
Si tienes alguna duda dime y la resolvemos 💗
{/si}
```

**Variables que usa**: `{nombre}`.

**Categoría Meta**: **Utility** (recordatorio de transacción pendiente iniciada por la clienta).

---

## 4. `reactivacion_30d`

**Cuándo dispara**: 30 días después de que el agente lo programa.

**Cuándo lo programa el agente**: cuando la clienta no responde después de varios turnos o muestra desinterés.

**Plantilla actual**:
```
¡Hola {nombre}! 💎 

{si:recurrente}
Hace tiempo no nos vemos 💗 Tenemos piezas nuevas que te encantarían — 
¿quieres que te pase el catálogo de novedades?
{/si}

{si:nuevo}
Te recordamos que aún tenemos piezas hermosas esperándote 💗 
¿Te paso el catálogo de novedades?
{/si}
```

**Variables que usa**: `{nombre}`.

**Categoría Meta**: **Marketing** (reactivación con oferta).

---

## 5. `prueba_simulador`

Solo para sandbox. No se manda a clientas reales. No necesita plantilla Meta.

---

# Cómo se programan: el flujo real

```
Clienta escribe → Verificador (Haiku) analiza intención y contexto
                ↓
                Verificador decide: ¿necesita seguimiento futuro?
                ↓
                Si sí → sugiere: programar_seguimiento(tipo, dias_offset)
                ↓
                Agente ejecuta la tool → inserta fila en seguimientos_programados
                ↓
                Captura snapshot completo del contexto en ese momento
                ↓
                Cron cada 15 min revisa filas con ejecutar_en <= NOW()
                ↓
                Aplica skip rules → si pasa, manda mensaje + log
```

El **Verificador decide cuándo** según un prompt que dice (literal del código):

> *"Si tool_principal = programar_seguimiento → parametros DEBE incluir: {tipo: 'post_compra_7d' | 'reactivacion_fria', dias_offset: número}"*

**Importante**: el código del prompt actualmente solo menciona `post_compra_7d` y `reactivacion_fria` como tipos que el Verificador puede elegir. Los otros (`lead_frio_24h`, `deposito_pendiente_24h`) **se programan por flujo automático en el código**, no por decisión del Verificador. Esto es relevante porque cuando vayas a Meta Templates necesitas saber qué dispara qué.

---

# Las skip rules: cuándo NO se manda aunque toque

Antes de cada envío, el executor revisa:

1. **¿La clienta está en handoff con asesora?** → SALTA. (No le caemos encima de la conversación humana.)
2. **¿Es `post_compra_*` pero `compras_totales = 0`?** → SALTA. (Premisa rota.)
3. **¿Es de tipo lead_frio/reactivacion/deposito_pendiente/restock y la clienta respondió DESPUÉS de cuando se programó?** → SALTA. (Ya volvió a la conversación, no está "fría".)

Si pasa los tres filtros, se manda.

---

# Variables y bloques condicionales · explicación completa

## Variables (todas opcionales, si no hay valor se quita del texto)

| Variable | Qué inserta | Origen |
|---|---|---|
| `{nombre}` | "Libia" (o "linda" si no se conoce) | ManyChat name/first_name |
| `{ciudad}` | "CDMX", "Guadalajara"... | Lead.ciudad si Mar la registra |
| `{catalogo_visto}` | "mayoreo" (único catálogo) | Última vez que se envió `enviar_catalogo` |
| `{ultima_faq}` | "envíos", "material", "pagos" | Última FAQ respondida |
| `{rama}` | "R1", "R2", "R3", "R4", "R5" | Última rama activada |
| `{etapa}` | "Lead nueva", "Calificada", "Esperando pago" | leads.estado |
| `{compras_totales}` | número entero | leads.compras_totales |
| `{canal}` | "Meta CTWA", "Instagram", "TikTok" | leads.canal_origen |
| `{dias_desde_compra}` | entero | Cálculo desde fecha_ultima_compra |
| `{horas_inactiva}` | entero | Cálculo desde ultima_interaccion |
| `{contexto_libre}` | texto libre | El agente o asesora puede dejar nota |

## Bloques condicionales

Solo aparecen si la señal correspondiente es real. Si no, se eliminan completos.

| Bloque | Aparece cuando |
|---|---|
| `{si:recurrente}...{/si}` | `compras_totales > 0` |
| `{si:nuevo}...{/si}` | `compras_totales = 0` |
| `{si:vio_catalogo}...{/si}` | Se envió catálogo |
| `{si:deposito}...{/si}` | Hay depósito registrado |
| `{si:objecion}...{/si}` | Verificador detectó objeción |

**Importante**: nunca se anidan. Un mismo seguimiento puede activar varios bloques (ej. `{si:vio_catalogo}` y `{si:nuevo}` a la vez).

---

# 🚨 El problema crítico para Meta Templates

Meta **NO acepta bloques condicionales `{si:X}` en sus plantillas**. Solo acepta variables numeradas `{{1}}`, `{{2}}`, `{{3}}`.

Esto significa que las plantillas actuales del sistema **NO son enviables tal cual** vía template approval. Tienes 3 opciones:

## Opción A · Aplanar a versión genérica

Una sola plantilla por tipo, con texto genérico que funcione para todos los casos. Pierdes personalización pero es la más simple.

**Ejemplo lead_frio_24h aplanada**:
```
Hola {{1}}, ¿pudiste ver nuestro catálogo? 
Si tienes alguna duda sobre material, envíos o piezas, aquí estoy 💗

Variables: {{1}} = nombre
```

**Categoría**: Marketing.

## Opción B · Múltiples plantillas por tipo

Una plantilla por cada combinación de banderas. Más personal, mantenimiento más alto.

**Ejemplo lead_frio_24h en 3 variantes**:
- `lead_frio_nueva_vio_catalogo` → para clientes nuevos que vieron catálogo
- `lead_frio_nueva_sin_catalogo` → para clientes nuevos sin catálogo
- `lead_frio_recurrente` → para recurrentes

Y en el código, decides cuál mandar según las banderas del snapshot.

## Opción C · Híbrida (mi recomendación)

Para cada tipo de seguimiento, registra **2-3 plantillas** que cubran los casos más frecuentes. El código elige cuál mandar según las banderas. Es el balance entre simplicidad y personalización.

---

# Las plantillas que recomiendo registrar en Meta

Aquí van listas para copiar/pegar al cargarlas en ManyChat → WhatsApp Business → Templates.

## Plantilla 1 · `lead_frio_recurrente`

**Categoría**: Marketing  
**Idioma**: Español (México)  
**Body**:
```
Hola {{1}}, ¿sigues por aquí? 
Sé que ya conoces nuestras piezas — tenemos un catálogo nuevo 💗
¿Te lo paso?
```
**Variables**: `{{1}}` = nombre  
**Botones quick-reply sugeridos**: "Sí, mándamelo" / "Ahora no"

---

## Plantilla 2 · `lead_frio_nueva`

**Categoría**: Marketing  
**Body**:
```
Hola {{1}}, ¿pudiste ver nuestro catálogo? 💗
Si tienes alguna duda sobre material, envíos o piezas, aquí estoy.
```
**Variables**: `{{1}}` = nombre  
**Botones**: "Tengo dudas" / "Quiero comprar"

---

## Plantilla 3 · `deposito_pendiente`

**Categoría**: Utility  
**Body**:
```
Hola {{1}}, ¿pudiste hacer el depósito de las piezas que apartamos? 
Te recuerdo que solo las sostenemos por unas horas más ✨
Si tienes alguna duda, escríbeme.
```
**Variables**: `{{1}}` = nombre  
**Botones**: "Ya hice el depósito" / "Tengo una duda"

---

## Plantilla 4 · `post_pedido_7d`

**Categoría**: Utility  
**Body**:
```
Hola {{1}}, pasaron unos días desde tu pedido 💕
¿Cómo te fueron tus piezas? Si te gustaron, nos encantaría ver una foto.
```
**Variables**: `{{1}}` = nombre  
**Botones**: "Me encantaron" / "Tengo un comentario"

---

## Plantilla 5 · `reactivacion_recurrente`

**Categoría**: Marketing  
**Body**:
```
Hola {{1}}, hace tiempo no nos vemos 💎
Entraron piezas nuevas que sé que te van a encantar.
¿Quieres que te pase el catálogo de novedades?
```
**Variables**: `{{1}}` = nombre  
**Botones**: "Sí, mándamelo" / "Otro día"

---

## Plantilla 6 · `reactivacion_nueva`

**Categoría**: Marketing  
**Body**:
```
Hola {{1}}, te recordamos que aún tenemos piezas hermosas esperándote 💗
¿Te paso el catálogo de novedades?
```
**Variables**: `{{1}}` = nombre  
**Botones**: "Sí, mándamelo" / "Ya no me interesa"

---

# Decisiones que necesito de ti para mover esto a producción

## 1. ¿Aplicamos opción A, B o C de plantillas?

Mi voto firme: **C (híbrida)**. 6 plantillas registradas en Meta como las que te listé arriba. Cubre 90% de casos sin volverse inmanejable.

## 2. ¿Qué hacemos con los bloques condicionales del código?

**Mi recomendación**: simplificarlos. Cambiar el sistema interno para que cada `tipo` de seguimiento mapee 1:1 a una plantilla Meta registrada. Eso significa:

- `lead_frio_24h` → se subdivide en `lead_frio_nueva` o `lead_frio_recurrente` según banderas
- `deposito_pendiente_24h` → mapea a `deposito_pendiente` 1:1
- `post_compra_7d` → mapea a `post_pedido_7d` 1:1
- `reactivacion_30d` → se subdivide en `reactivacion_nueva` o `reactivacion_recurrente`

**Tiempo de implementación**: 2 horas (refactor de tipos + render).

## 3. ¿Qué hacemos con variables avanzadas como {ciudad} o {ultima_faq}?

**Mi recomendación**: NO usarlas en plantillas Meta inicialmente. Razones:
- Meta puede rechazar plantillas con muchas variables o variables muy genéricas
- Más variables = más riesgo de que el texto salga raro
- Las podemos usar en mensajes DENTRO de la ventana de 24h (donde no hay restricción)

## 4. ¿Botones de respuesta rápida?

Meta acepta hasta 3 botones quick-reply. Te lo sugerí en cada plantilla pero son opcionales. Sirven mucho porque:
- Reducen fricción para que la clienta responda
- Cada click reabre la ventana de 24h (futuras respuestas gratis)
- Mejoran tu calidad de plantilla a ojos de Meta

---

# Cuándo se cancelan los seguimientos automáticamente

El sistema cancela seguimientos en cuatro casos:

1. **La clienta responde**: cualquier mensaje entrante posterior cancela todos sus seguimientos activos
2. **La clienta cierra venta**: el cierre cancela las cadencias de lead_frio y depósito_pendiente
3. **Se activa handoff**: cuando una asesora toma la conversación, se cancelan las cadencias del bot
4. **El estado cambia** (ej. de calificada a esperando_pago): los pasos siguientes se reevalúan

---

# Resumen para tu trabajo en Meta

| Plantilla | Categoría | Cuándo dispara | Cuándo NO dispara |
|---|---|---|---|
| `lead_frio_nueva` | Marketing | +24h tras catálogo, primera vez | Si ya respondió |
| `lead_frio_recurrente` | Marketing | +24h tras catálogo, ya compró antes | Si ya respondió |
| `deposito_pendiente` | Utility | +24h tras apartar pieza | Si ya depositó o canceló |
| `post_pedido_7d` | Utility | +7d después de cierre | Si reportó problema |
| `reactivacion_nueva` | Marketing | +30d sin contacto, primera vez | Si volvió a escribir |
| `reactivacion_recurrente` | Marketing | +30d sin contacto, ya compró | Si volvió a escribir |

**6 plantillas para registrar en Meta**. Eso es todo lo que necesitas para el sistema actual.

---

# Lo que NO existe todavía y tendrías que decidir

1. **Cadencia multi-paso** (paso 1, 2, 3, 4, 5 en el tiempo): no está. Cada seguimiento es one-shot.
2. **Restock para revendedoras**: no implementado todavía.
3. **Seguimiento de pieza específica vista** (`{pieza_vista}`): requiere extractor LLM que no existe.
4. **A/B testing entre variantes**: no implementado.

Si quieres alguno de estos antes de prender en producción, dime y los hacemos.

---

# Mi recomendación inmediata para que avances

1. **Registra las 6 plantillas en Meta** (vía ManyChat) tal cual te las dejé. ManyChat las sube y Meta tarda horas/días en aprobarlas. Empieza ya.

2. **Mientras Meta las aprueba** te implemento el refactor para que el sistema interno mapee a esas 6 plantillas (2 horas de código).

3. **Cuando Meta apruebe** y tengamos el código listo, prendemos producción. Los seguimientos empiezan a fluir.

¿Le entras? Si me das luz verde, arranco con las 6 plantillas refactorizadas.

---

*fin · seguimientos detallados para Meta templates · v.2026.06 · azxion · mar_de_plata*

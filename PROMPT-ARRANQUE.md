# Prompt de arranque · Claude Code en proyecto nuevo

> Este es el texto que tu desarrollador pega al **primer turno** de Claude Code cuando inicia la migración de un proyecto n8n a Next.js. Va dentro de `[[ ]]` o como mensaje normal — Claude Code lo entiende sin marcadores especiales.
>
> Antes de pegarlo, completa los `[[CAMPOS]]` con info del cliente.

---

## Plantilla

```
Hola. Vas a migrar un sistema de [[NOMBRE DEL CLIENTE]] desde n8n a Next.js
14, siguiendo el SOP de Azxion (archivo SOP-N8N-CLAUDE-CODE.md que voy
a pasarte enseguida).

## Contexto del cliente en una línea

[[1-2 LÍNEAS DESCRIBIENDO EL NEGOCIO Y QUÉ HACE EL BOT.
Ejemplo: "Mar de Plata Taxco vende joyería de plata 925 vía WhatsApp.
El bot Sirena clasifica intenciones, dispara FAQs, conduce ventas y
hace handoff a asesoras humanas cuando hace falta."]]

## Lo que vas a recibir en los siguientes mensajes

1. SOP-N8N-CLAUDE-CODE.md — el procedimiento canónico de Azxion.
2. JSON de los workflows de n8n (uno por mensaje si son varios).
3. Schema completo de Supabase (tablas + funciones + triggers + RLS).
4. Los prompts oficiales del clasificador y del agente principal.
5. Un payload real de ejemplo del webhook entrante del proveedor.
6. Reglas duras inviolables del negocio.
7. Las pantallas que debe tener el dashboard y quién las usa.

## Cómo quiero que trabajes

- Lee SOP-N8N-CLAUDE-CODE.md de arriba a abajo antes de hacer
  cualquier cosa. Es la fuente de verdad de cómo trabajamos.
- Sigue el roadmap de 13 fases del SOP en orden estricto. No
  saltes fases. Entre cada una, párate y muéstrame el resultado.
- Aplica los 15 patterns canónicos del SOP religiosamente,
  especialmente:
    · P2: TODAS las queries del dashboard van por endpoints
      server-side con service_role, no desde el browser con anon.
      Esto evita 90% de bugs de "no aparece nada".
    · P3: modo demo cuando faltan API keys, para que la UI
      funcione sin OpenRouter.
    · P5: clasificador (cheap) → agente (smart) separados.
    · P6: defense in depth — cada regla en 4 capas.
    · P10: arma CLAUDE.md antes de la primera línea de código.
- Cuando llegues a la Fase 12 (Playground), asegúrate de que las
  imágenes se rendericen inline (no como links), el typing
  indicator sea visible y el historial cargue desde un endpoint
  server-side.
- Si algo es ambiguo o falta info, pregúntame ANTES de inventar.
- Si vas a hacer una decisión técnica grande (ej. cambiar el
  stack), pregúntame primero.
- No reemplaces n8n. Construye en paralelo. La Fase 13
  (corte real) es decisión del cliente.

## Lo que NO quiero que hagas

- No empieces escribiendo código antes de leer el SOP.
- No te saltes el CLAUDE.md como base de conocimiento.
- No leas tablas desde el browser con anon key (P2).
- No inventes columnas o funciones SQL que no existan.
- No simplifiques los prompts oficiales sin autorización.
- No metas todo en una sola fase.

## Stack confirmado (no cambiar sin justificación fuerte)

Next.js 14 App Router + TypeScript estricto + Tailwind +
@supabase/supabase-js + @supabase/ssr + SWR + Vercel.

## Tu primer paso ahora

1. Confirma que entiendes el SOP y el contexto.
2. Pregúntame los inputs del §2 del SOP que no te pasé todavía.
3. Cuando tengas todo, arma el CLAUDE.md siguiendo la estructura
   del §P10 del SOP y muéstramelo para review.
4. Solo después arrancas con la Fase 1.

Vamos.
```

---

## Cómo usar este prompt

1. **El desarrollador clona o crea el repo** del cliente nuevo en GitHub vacío.
2. **Conecta Claude Code** (web o CLI) a ese repo.
3. **Pega el SOP** (`SOP-N8N-CLAUDE-CODE.md`) en el repo, en la raíz.
4. **Pega también este prompt** ya completado con los datos del cliente.
5. **Primer mensaje a Claude Code:** el prompt completo arriba.
6. **Segundo mensaje:** los archivos del cliente uno por uno con `@archivo.json`.

A partir de ahí Claude Code conduce con el roadmap. El desarrollador valida en cada fase y pasa al cliente lo que entrega.

---

## Variantes según tipo de proyecto

### Si el cliente NO tiene Supabase aún

Agrega al prompt:
```
Antes de arrancar, voy a necesitar que crees el proyecto de Supabase y me
pases la URL + anon key + service_role. Yo voy a generar los CREATE TABLE
basado en lo que extraigamos del export de n8n.
```

### Si el cliente tiene Redis en n8n y quiere mantenerlo

Agrega:
```
El cliente quiere mantener Redis (Upstash). Sigue el patrón P1 del SOP
pero implementa el buffer de 5s con Upstash. Yo te paso REDIS_URL aparte.
```

### Si el cliente quiere multi-tenancy

Agrega:
```
Vamos a soportar múltiples clientes en el mismo deploy. Cada lead llevará
un `tenant_id`. RLS por tenant. Documenta esto en CLAUDE.md y diseña los
endpoints para que respeten el tenant del request.
```

---

## Plantilla del mensaje #2 (después del prompt inicial)

Una vez que Claude Code responde "OK leí el SOP, pásame los inputs", manda esto:

```
Aquí va lo que tengo. Los workflows de n8n primero:

@workflow-madre.json
@tool-faq.json
@tool-catalogo.json
[...]

Schema de Supabase (le pedí export a Libi):

@schema.sql

Prompts oficiales:

@verificador.md
@agente-sirena.md

Payload de ejemplo del webhook:

@manychat-payload-ejemplo.json

Credenciales (NO las pegues en el código, solo úsalas en .env.local
de tu lado y para que sepas con qué servicios estamos trabajando):

- OpenRouter: [[clave]]
- ManyChat API key: [[clave]]
- OpenAI Whisper: [[clave]]

Reglas duras inviolables que el cliente dejó claras:

1. [[REGLA 1, ej. "Nunca dar datos bancarios desde el bot"]]
2. [[REGLA 2]]
3. [[REGLA 3]]

Pantallas que el dashboard debe tener:

1. [[PANTALLA + QUIÉN LA USA]]
2. [[...]]

Con esto arma CLAUDE.md y muéstramelo antes de tocar más código.
```

---

## Notas finales para el dev

- **No te saltes la validación entre fases.** Es lo que separa una migración limpia de un descalabro.
- **Si el cliente cambia de opinión a mitad de fase, documenta la decisión en CLAUDE.md** (P13). Sirve para que la próxima sesión de Claude Code no la "redescubra" mal.
- **Si necesitas dar prioridad a algo urgente, dilo explícito.** Claude Code respeta órdenes claras de prioridad.
- **Recordatorio Vercel:** después de cualquier cambio de env var, hay que redeploy manual. Claude Code no lo hace solo.
- **Si el deploy falla con "output directory dist"**, es la config heredada de Vite. `vercel.json` con `framework: nextjs` lo arregla (P15 del SOP).

---

**Última actualización:** 2026.06 · v1.0 con caso piloto Mar de Plata Taxco

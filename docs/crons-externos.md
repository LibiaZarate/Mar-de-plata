# Crons externos (plan Hobby de Vercel)

El plan gratuito de Vercel solo permite crons de una vez al día, así que los
crons salieron de `vercel.json` y se disparan desde [cron-job.org](https://cron-job.org)
(gratuito, soporta intervalos de minutos). El resultado es idéntico: el
servicio externo llama a los mismos endpoints que llamaba Vercel Cron.

## 1. Variable de entorno en Vercel

En el proyecto de Vercel → **Settings → Environment Variables**, agregar:

```
CRON_SECRET=[una cadena larga aleatoria, ej. generada en 1password o passwordsgenerator.net]
```

Sin esto los endpoints de cron quedan abiertos a internet. Los tres endpoints
ya validan el header `Authorization: Bearer <CRON_SECRET>` cuando la variable
está definida.

Después de agregarla, hacer **Redeploy** para que tome efecto.

## 2. Crear los 3 jobs en cron-job.org

Crear cuenta gratuita en cron-job.org y dar de alta estos jobs
(reemplazar `TU-APP.vercel.app` por el dominio real del deploy):

| Job | URL | Frecuencia |
|---|---|---|
| Seguimientos | `https://TU-APP.vercel.app/api/cron/seguimientos` | cada 15 min |
| Asignar pendientes | `https://TU-APP.vercel.app/api/cron/asignar-pendientes` | cada 5 min |
| Secuencias | `https://TU-APP.vercel.app/api/cron/secuencias` | cada 15 min |

En cada job, en **Advanced → Headers**, agregar:

```
Authorization: Bearer [el mismo valor de CRON_SECRET]
```

Método: GET. Timeout: 30s o el máximo que permita el plan gratuito.

## 3. Verificar

- En cron-job.org, la columna de status debe mostrar 200 OK en cada ejecución
- En el dashboard, los seguimientos programados deben pasar a `ejecutado_en`
  lleno cuando llegue su hora (tolerancia de hasta ~15 min por el intervalo)

## Si algún día se paga Vercel Pro

Basta restaurar el bloque `crons` en `vercel.json` y borrar los jobs de
cron-job.org:

```json
"crons": [
  { "path": "/api/cron/seguimientos", "schedule": "*/15 * * * *" },
  { "path": "/api/cron/asignar-pendientes", "schedule": "*/5 * * * *" },
  { "path": "/api/cron/secuencias", "schedule": "*/15 * * * *" }
]
```

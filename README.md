# VerificaPay

Dashboard para comercios que reciben pagos por billeteras virtuales (Mercado Pago y otras). Permite a dueños y empleados verificar en un solo lugar los pagos acreditados, sin tener que mirar el celular o la app del proveedor en el mostrador.

## Cómo funciona

1. El dueño del comercio conecta su cuenta de Mercado Pago desde **Billeteras** con OAuth (Authorization Code) — o, para otras billeteras, cargando el `access_token` manualmente.
2. Mercado Pago manda un **webhook** a `/api/webhooks/mercadopago` cada vez que hay un movimiento de pago.
3. El webhook busca el pago completo en la API de MP, valida que sea un ingreso real (no una autotransferencia) y lo guarda en la tabla `payments` de Supabase.
4. El dashboard escucha esa tabla por **Supabase Realtime** y se actualiza solo apenas entra un pago nuevo. También hay un botón para actualizar manualmente.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions) + React 19 + TypeScript
- [Supabase](https://supabase.com) — Postgres, Auth y Realtime
- Tailwind CSS 4

> Este repo usa una versión de Next.js con cambios respecto a lo habitual (ver `AGENTS.md`). Antes de tocar código de routing/config, revisar `node_modules/next/dist/docs/`.

## Modelo de datos

- **organizations**: cada comercio. Tiene un `invite_code` para que los empleados se sumen.
- **profiles**: 1:1 con `auth.users`. Define `role` (`owner` | `employee`) y a qué organización pertenece.
- **wallets**: billeteras conectadas por organización (`provider`, `alias`, `status`, `collector_id`).
- **wallet_credentials**: `access_token` y `refresh_token` de cada billetera. Tiene RLS sin policies: solo el server la lee/escribe con la service key, nunca llega al navegador. `collector_id` es el `user_id` de Mercado Pago del dueño de la cuenta — se usa para matchear cada webhook con su organización.
- **payments**: pagos recibidos, alimentados exclusivamente por el webhook. Guarda el payload crudo (`raw`) además de los campos normalizados.

Todo el esquema (tablas, índices, RLS, función `current_organization_id()`, publicación de Realtime) está en [`supabase/schema.sql`](supabase/schema.sql) — es idempotente, se puede volver a correr entero en el SQL Editor de Supabase sin romper nada.

## Setup local

### 1. Variables de entorno

```bash
cp .env.local.example .env.local
```

Completá con los datos de tu proyecto Supabase (Project Settings → API):

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API (¡no exponer al cliente!) |
| `MP_WEBHOOK_SECRET` | Panel de Mercado Pago → Tu aplicación → Webhooks → Configurar notificaciones → Clave secreta |
| `MP_CLIENT_ID` / `MP_CLIENT_SECRET` | Panel de Mercado Pago → Tu aplicación → Detalles de aplicación (credenciales OAuth) |
| `NEXT_PUBLIC_SITE_URL` | URL pública de esta app (sin barra final), p. ej. `http://localhost:3000` |

### 2. Base de datos

Corré [`supabase/schema.sql`](supabase/schema.sql) completo en el SQL Editor de tu proyecto Supabase.

### 3. Instalar y correr

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). Te va a redirigir a `/login` si no tenés sesión.

### 4. Datos de prueba (opcional)

```bash
node scripts/seed-users.mjs
```

Crea un comercio de prueba con un usuario `owner` y uno `employee` (las credenciales quedan impresas en la consola al terminar).

### 5. Conectar Mercado Pago y probar el webhook

1. En el panel de Mercado Pago, en tu aplicación, cargá la **URL de redirect** de OAuth: `<NEXT_PUBLIC_SITE_URL>/api/mercadopago/oauth/callback` (p. ej. `http://localhost:3000/api/mercadopago/oauth/callback`).
2. Logueate como owner y entrá a **Billeteras** → **Conectar con Mercado Pago**. Te redirige a Mercado Pago para autorizar el acceso (flujo OAuth *Authorization Code*, sin PKCE porque el canje del `code` por el `access_token` se hace server-to-server) y vuelve a `/wallets` con la wallet ya creada, incluyendo `access_token`, `refresh_token` y `collector_id`.
3. Mercado Pago necesita poder pegarle a tu `/api/webhooks/mercadopago` desde internet. En local, exponé el puerto 3000 con un túnel (por ejemplo la pestaña **Ports** de VS Code, ngrok, o cloudflared).
4. Si accedés a la app por un dominio de túnel distinto de `localhost`, agregalo a `serverActions.allowedOrigins` en [`next.config.ts`](next.config.ts) y actualizá `NEXT_PUBLIC_SITE_URL` / la URL de redirect de OAuth en el panel de MP — si no, el login y otras Server Actions van a fallar con "Invalid Server Actions request".
5. Cargá esa URL pública (`https://.../api/webhooks/mercadopago`) en el panel de Mercado Pago, en Webhooks, para el evento **Pagos**.
6. Generá un pago real en la cuenta de test (Checkout Pro, transferencia/CVU, etc.). Debería aparecer solo en el dashboard.

> El simulador de notificaciones del panel de MP manda un `payment.id` que no existe de verdad — sirve para validar que la firma y la URL responden, pero no va a insertar un pago real en la tabla.

## Deploy en Vercel

1. Importá el repo en [vercel.com/new](https://vercel.com/new). Framework: **Next.js** (se detecta solo). Si el repo tiene la app en una subcarpeta, configurá **Root Directory** apuntando a ella.
2. En **Settings → Environment Variables** cargá las mismas variables que en `.env.local` (ver tabla de arriba). `NEXT_PUBLIC_SITE_URL` debe ser el dominio de producción, p. ej. `https://verificapay.vercel.app` — si no la cargás, se usa el dominio de producción que expone Vercel (`VERCEL_PROJECT_PRODUCTION_URL`). Las variables `NEXT_PUBLIC_*` se embeben en el build: si las cambiás, hay que redeployar.
3. Deployá.
4. En el panel de Mercado Pago, actualizá:
   - **URL de redirect** de OAuth: `https://<tu-dominio>/api/mercadopago/oauth/callback`
   - **Webhooks** (evento Pagos): `https://<tu-dominio>/api/webhooks/mercadopago`
5. En Supabase → **Authentication → URL Configuration**, poné tu dominio de Vercel como **Site URL** (y agregalo a Redirect URLs).

> Los *preview deployments* tienen otra URL, así que el flujo OAuth de Mercado Pago solo funciona en el dominio de producción (el que está registrado en MP).

## Estructura del proyecto

```
src/
  app/
    api/
      payments/            GET — pagos de la organización guardados por el webhook (vacío si no hay wallet conectada)
      mercadopago/payments/search/ GET — pagos consultados en vivo a Mercado Pago (los usa /pagos)
      webhooks/mercadopago/ POST — recibe notificaciones de Mercado Pago
      mercadopago/oauth/    GET start/callback — flujo OAuth Authorization Code para vincular la cuenta
    auth/actions.ts         Server Actions de login/logout y recuperación de contraseña
    auth/callback/          GET — canjea el código del mail de recuperación por una sesión
    auth/confirm/           GET — valida el token_hash del mail de recuperación (template en supabase/templates/)
    login/, recuperar/      Páginas públicas (login y pedido de recuperación)
    restablecer/            Nueva contraseña (llega desde el link del mail)
    wallets/                Alta/baja de billeteras (solo owner)
    pagos/                  Vista de pagos (pide asociar una billetera si no hay ninguna activa)
    page.tsx                Redirige a /pagos
  components/                UI (dashboard, lista de pagos, sidebar, etc.)
  lib/
    mercadopago.ts           Cliente de la API de MP + validación de firma del webhook
    supabase/                Clientes de Supabase: browser, server (cookies), service (webhook)
    database.types.ts        Tipos de las tablas
supabase/schema.sql          Esquema completo de la base
scripts/seed-users.mjs       Seed de comercio + usuarios de prueba
```

## Notas de seguridad

- Los tokens de `wallet_credentials` solo se acceden server-side (ver `src/lib/mercadopago-wallet.ts`); si Mercado Pago rechaza el `access_token`, se renueva solo con el `refresh_token`. Todavía se guardan en texto plano — para producción, cifrarlos o usar Supabase Vault (ver nota al final de `schema.sql`).
- El flujo OAuth valida el parámetro `state` contra una cookie `httpOnly` de un solo uso para evitar CSRF; `MP_CLIENT_SECRET` nunca se expone al cliente, el canje del `code` se hace server-to-server en `/api/mercadopago/oauth/callback`.
- El webhook valida la firma de Mercado Pago (`x-signature`) contra `MP_WEBHOOK_SECRET` si está configurada; sin ese secret, no rechaza nada.
- La `service_role` key solo se usa server-side (webhook), nunca se expone al cliente.

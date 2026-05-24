# FuelPlan Web App

Next.js app voor de FuelPlan MVP.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Structuur

```text
src/app       Next.js shell
src/components watch-integratie componenten
src/ui        visuele React componenten
src/state     React state en sessie-acties
src/engine    pure FuelPlan berekeningen en fueling-output
src/integrations/watch watch provider-contracten en demo/provider adapters
src/lib/push  Web Push, device-auth, rate limiting en subscription storage
src/utils     generieke formatting/parsing helpers
src/services  leeg in de MVP; alleen voor echte externe integraties
```

De centrale rekenlogica staat in `src/engine/energyEngine.ts`.
De watch-output mapping staat in `src/engine/fuelingEngine.ts`.
React componenten mogen alleen data tonen en user input doorgeven.

## Watch Integrations

De linkerkant van de app bevat vier opties:

```text
Demo      lokale simulatie zonder externe koppeling
Samsung   Wear OS / Health Services route
Garmin    Connect IQ Data Field route
COROS     sync mode; live watch app beperkt/pending
```

De providercontracten en stappenplannen staan in `src/integrations/watch`.
Demo blijft de standaard, zodat de MVP bruikbaar blijft zonder echte watch SDK.

## PWA Web Push

De PWA route staat op:

```text
/live-session
```

MVP-route:

```text
Niveau 1  Fueling timeline -> browser Notification API -> telefoon -> horloge
Niveau 2  Fueling timeline -> Web Push via Vercel -> telefoon -> horloge
```

De live session pagina houdt beide routes naast elkaar actief. De demo timeline
triggert op 10s, 30s, 60s, 90s en 120s en toont per event `N1` en `N2` status.
Op Android gebruikt Niveau 1 `registration.showNotification()` via de service
worker. Niveau 2 gebruikt een device-scoped PushSubscription met install-id,
device-id en install-secret headers. Vercel stuurt alleen vaste FuelPlan
event-types naar de subscription die bij die lokale install hoort.
De client synchroniseert de actieve browser subscription opnieuw bij page-load,
test push en elk demo-event, zodat de memory fallback ook na een cold start
herstelt.

Belangrijke bestanden:

```text
public/manifest.json
public/sw.js
src/components/PushNotificationManager.tsx
src/app/api/push/*
src/lib/push/auth.ts
src/lib/push/events.ts
src/lib/push/subscriptions.ts
src/lib/push/webpush.ts
```

Genereer VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Gebruik `.env.example` als template. Zet lokaal in `.env.local` en in Vercel:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:hello@example.com
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
PUSH_ADMIN_TOKEN=...
```

Production storage gebruikt Upstash Redis REST. Zonder Upstash-configuratie
valt lokale development terug op memory storage; die fallback is niet betrouwbaar
op Vercel serverless.

De service worker precachet de app shell, gebruikt cache-first voor statische
assets en network-first voor navigatie met `/offline` als fallback.

`/api/push/send` accepteert geen vrije publieke payloads. De route accepteert
alleen servergedefinieerde FuelPlan event-types zoals `drink-10`, `fuel-30` en
`fuel-120`.

`/api/push/status` toont voor de huidige install de actieve storage mode en of
de server-side subscription bestaat.

## Tests en CI

```bash
npx tsc --noEmit
npm run test:unit
npm run build
npm run test:e2e
```

De root workflow `.github/workflows/ci.yml` draait deze checks op GitHub.

## Vercel

Deploy deze map als project root:

```text
core/app
```

Gebruik het Next.js framework preset en de standaard Vercel output settings.

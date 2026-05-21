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
src/lib/push  Web Push VAPID-configuratie en tijdelijke subscription-store
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
Fueling timeline -> Web Push op telefoon -> telefoon spiegelt melding naar horloge
```

Belangrijke bestanden:

```text
public/manifest.json
public/sw.js
src/components/PushNotificationManager.tsx
src/app/api/push/*
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
```

De in-memory subscription-store is alleen voor de MVP. Vervang die later door
Supabase, Redis, Vercel KV, Upstash of een database.

## Vercel

Deploy deze map als project root:

```text
core/app
```

Gebruik het Next.js framework preset en de standaard Vercel output settings.

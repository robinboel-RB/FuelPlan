# FuelPlan

FuelPlan is een Next.js/PWA-app voor sport-fueling tijdens een training. De app
berekent energieverbruik, koolhydraatverbruik en carb-alerts vanuit athlete- en
sessiedata. De runtime-app staat volledig in `core/app`.

## Wat de app kan

- Athlete- en segmentinput normaliseren: gewicht, leeftijd, lengte, HR, VO2max,
  vetpercentage, tempo, duur, helling, hoogtemeters, temperatuur en terrein.
- Een Python fueling core draaien voor de sport-fueling berekeningen.
- Per minuut Keytel, Minetti, RER, carb burn, reservoir en totale kcal bepalen.
- Carb-triggers genereren zodra de sessie opnieuw 30g koolhydraatverbruik kruist.
- Een dashboard tonen met setup, live guidance, intake/skip-acties en watch UI.
- Een PWA live-session draaien via `/live-session`.
- Browsernotifications en servergestuurde Web Push sturen naar telefoon/horloge.
- Push-subscriptions opslaan via Vercel Blob, Upstash fallback of lokale memory.
- Server-side live sessie-events plannen met QStash delayed events.
- Offline fallback aanbieden via service worker.

## Structuur

```text
.
├── .github/workflows/ci.yml
├── docs/                         inhoudelijke referenties, geen runtime
└── core/app/
    ├── api/fueling_core.py        Vercel Python Function
    ├── fueling_core/              pure Python rekenkern
    ├── fueling_core_cli.py        lokale stdin/stdout adapter voor Next dev
    ├── public/                    PWA manifest, service worker en icons
    ├── src/
    │   ├── app/                   Next.js routes en API routes
    │   ├── components/            PWA/push/watch componenten
    │   ├── engine/                TS adapterlaag rond FuelPlan-planoutput
    │   ├── integrations/watch/    watch data-contracten
    │   ├── lib/fueling/           Next -> Python core bridge
    │   ├── lib/push/              Web Push, auth, storage, delivery
    │   ├── lib/session/           server-side live sessions + QStash
    │   ├── state/                 React sessie-state
    │   ├── types/                 gedeelde TS types
    │   ├── ui/                    setup- en guidance-panels
    │   └── utils/                 formatting helpers
    └── tests/
        ├── unit/                  Vitest
        ├── e2e/                   Playwright
        └── python/                Python core unit tests
```

`docs/` bevat alleen de sport-science referenties:

- `Fueling_plan.pdf`
- `FuelPlan_MVP_Wiskundige_Samenvatting.*`

De oude sample-activity exports en dubbele Python engines zijn verwijderd. Er is
nu één bron voor de Python core: `core/app/fueling_core`.

## Runtime-flow

De browser roept `src/app/api/fueling/calculate/route.ts` aan. Die route
valideert de input met `src/lib/fueling/coreApi.ts`.

Lokaal start Next de CLI:

```text
core/app/fueling_core_cli.py -> core/app/fueling_core/adapter.py -> engine.py
```

Op Vercel proxyt Next naar:

```text
core/app/api/fueling_core.py -> core/app/fueling_core/adapter.py -> engine.py
```

React toont alleen input, status en output. De sportformules blijven in de
Python core; de TypeScript engine vertaalt de core-output naar UI- en watch-data.

## PWA en push

`/live-session` ondersteunt twee notification-niveaus:

- Niveau 1: lokale browser/service-worker notification zolang de pagina actief is.
- Niveau 2: servergestuurde Web Push via Vercel, QStash en opgeslagen PushSubscription.

In development valt subscription- en sessiestorage terug op memory. In productie
vereist niveau 2 persistente storage via Vercel Blob of Upstash Redis REST.

Belangrijke environment variables:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
NEXT_PUBLIC_APP_URL
QSTASH_URL
QSTASH_TOKEN
QSTASH_CURRENT_SIGNING_KEY
QSTASH_NEXT_SIGNING_KEY
```

Persistente storage, minimaal één van:

```text
BLOB_READ_WRITE_TOKEN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Optioneel:

```text
CRON_SECRET
PUSH_ADMIN_TOKEN
FUELPLAN_FUELING_CORE_URL
FUELPLAN_FORCE_PYTHON_SERVICE
FUELPLAN_PYTHON_BIN
VERCEL_AUTOMATION_BYPASS_SECRET
```

## Lokaal draaien

Vereisten:

- Node.js 20
- Python 3.12

```powershell
cd core/app
npm install
Copy-Item .env.example .env.local
npm run dev
```

Vul voor Web Push minimaal de VAPID-waarden in `.env.local` in. Open daarna de
URL die Next toont, meestal `http://localhost:3000`.

## Checks

```bash
cd core/app
npx tsc --noEmit
npm run test:unit
npm run test:python
npm run build
npm run test:e2e
```

De GitHub Actions workflow gebruikt `npm ci` en draait TypeScript, unit tests,
Python core tests, build en Playwright e2e voor pull requests en pushes naar
`main`.

## Deployment

Vercel projectinstellingen:

```text
Root Directory: core/app
Framework Preset: Next.js
Build Command: npm run build
Output Directory: default / leeg
Install Command: npm install
```

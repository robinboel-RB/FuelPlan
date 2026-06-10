# FuelPlan App

Next.js app, PWA, Web Push routes en deploybare Python fueling core.

## Belangrijke scripts

```bash
npm run dev
npm run build
npm run test:unit
npm run test:python
npm run test:e2e
```

## Structuur

```text
api/fueling_core.py       Vercel Python Function
fueling_core/             Python rekenkern
fueling_core_cli.py       lokale CLI-adapter voor Next dev
src/app/                  Next routes en API routes
src/components/           PWA, push en watch componenten
src/engine/               TS mapping naar coach/watch output
src/integrations/watch/   gedeelde watch contracts
src/lib/fueling/          bridge tussen Next en Python core
src/lib/push/             Web Push auth, storage, rate limiting en delivery
src/lib/session/          server-side live sessions en QStash events
src/state/                React sessie-state
src/types/                Fueling core types
src/ui/                   setup- en guidance-panels
src/utils/                formatting helpers
tests/unit/               Vitest tests
tests/e2e/                Playwright tests
tests/python/             Python core tests
```

## Rekenkern

De centrale sportlogica staat in `fueling_core/engine.py`. De browser gebruikt
`src/app/api/fueling/calculate/route.ts`; lokaal draait die route
`fueling_core_cli.py`, op Vercel proxyt hij naar `api/fueling_core.py`.

React componenten mogen geen sportformules bevatten. Zij geven input door en
tonen de output uit de Python core en de TypeScript mappinglaag.

## PWA Web Push

De live coach staat op `/live-session`.

- Niveau 1 gebruikt browser/service-worker notifications.
- Niveau 2 gebruikt Web Push via server routes, device-scoped auth headers,
  QStash-delayed events en subscription storage.

Storagevolgorde:

```text
Vercel Blob -> Upstash Redis REST -> memory
```

Memory is alleen geschikt voor lokale development.

## Environment

Gebruik `.env.example` als startpunt. Minimaal voor echte Web Push:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Voor persistente push/session scheduling:

```text
BLOB_READ_WRITE_TOKEN
PUSH_ADMIN_TOKEN
QSTASH_TOKEN
QSTASH_CURRENT_SIGNING_KEY
QSTASH_NEXT_SIGNING_KEY
```

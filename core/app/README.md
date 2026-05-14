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
src/utils     generieke formatting/parsing helpers
src/services  leeg in de MVP; alleen voor echte externe integraties
```

De centrale rekenlogica staat in `src/engine/energyEngine.ts`.
De watch-output mapping staat in `src/engine/fuelingEngine.ts`.
React componenten mogen alleen data tonen en user input doorgeven.

## Vercel

Deploy deze map als project root:

```text
core/app
```

Gebruik het Next.js framework preset en de standaard Vercel output settings.

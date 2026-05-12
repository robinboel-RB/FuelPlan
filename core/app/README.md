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
src/ui        visuele React componenten
src/state     React state en sessie-acties
src/core      pure FuelPlan berekeningen en coachlogica
src/utils     generieke formatting/parsing helpers
src/services  leeg in de MVP; alleen voor echte externe integraties
```

De centrale rekenlogica staat in `src/core/trainingEnergyModel.ts`.
React componenten mogen alleen data tonen en user input doorgeven.

## Vercel

Deploy deze map als project root:

```text
core/app
```

Gebruik het Next.js framework preset en de standaard Vercel output settings.

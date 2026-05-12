# FuelPlan MVP

FuelPlan is een Next.js MVP voor sport-fueling en energy-output. De webapp staat in:

```text
core/app
```

De root bevat ook referentiedocumenten en lokale desktop-build artefacten. Alleen de broncode en kleine documentatiebestanden horen in Git; build-output, `node_modules`, `.next`, `out`, `dist` en losse binaries worden genegeerd.

## Lokaal draaien

```bash
cd core/app
npm install
npm run dev
```

Open daarna de lokale URL die Next.js toont, meestal `http://localhost:3000`.

## Build controleren

```bash
cd core/app
npm run build
```

## Vercel deployment

Gebruik deze projectinstellingen:

```text
Root Directory: core/app
Framework Preset: Next.js
Build Command: npm run build
Output Directory: default / leeg laten
Install Command: npm install
```

Na een push naar de gekoppelde GitHub repo deployt Vercel automatisch.

## Release maken

1. Werk de app bij in `core/app`.
2. Controleer lokaal:

   ```bash
   cd core/app
   npm run build
   ```

3. Commit en push naar GitHub.
4. Maak een tag, bijvoorbeeld `v0.1.0`.
5. Maak een GitHub Release op die tag.
6. Upload een zip met releasebestanden als asset.

Desktop-builds zijn optioneel en horen niet los in de Git repo. Voeg ze alleen als GitHub Release asset toe wanneer er bewust een desktop release gemaakt wordt.

# FuelPlan MVP

FuelPlan is een Next.js MVP voor sport-fueling en energy-output. De app rekent
energieverbruik, brandstofverdeling en fueling-reminders door voor een
training/run. De webapp staat in `core/app`.

De kernregel van deze codebase: React toont data en geeft user input door; de
rekenlogica staat centraal en onafhankelijk in `core/app/src/engine`.

## Mappenstructuur

```text
.
├── README.md
├── docs/
│   ├── Energy_calculator.xlsx
│   ├── Fueling_plan.pdf
│   └── FuelPlan_MVP_Wiskundige_Samenvatting.*
└── core/
    └── app/
        ├── desktop/
        ├── src/
        ├── package.json
        └── README.md
```

### Rootniveau

`docs/` bevat de inhoudelijke referenties voor de sport science basis:

- `Energy_calculator.xlsx`: Excel-bron voor de oorspronkelijke rekenlogica.
- `Fueling_plan.pdf`: methodiek en fueling-aanpak.
- `FuelPlan_MVP_Wiskundige_Samenvatting.*`: aanvullende wiskundige samenvatting.

Deze documenten zijn geen runtime dependency.

`core/app/` bevat de eigenlijke applicatie. Dit is de map die lokaal draait en
door Vercel wordt gedeployed.

Lokale build-output, `node_modules`, `.next`, `out`, `dist`, desktop binaries
en losse zip-bestanden horen niet in Git. Dit wordt afgedekt door `.gitignore`
en `.vercelignore`.

### Webapp

```text
core/app/src/
├── app/        Next.js routes, layout en globale styling
├── components/ watch integration componenten
├── engine/     kernberekeningen, fueling en FuelPlan watch-output
├── integrations/watch/
│               provider contracts en watch adapters
├── state/      React sessie-state, timer en intake-acties
├── ui/         setup- en guidance-componenten
├── utils/      generieke formatting/parsing helpers
└── services/   gereserveerd voor echte API/storage/integraties
```

`src/app` is bewust dun. De pagina composeert de UI en gebruikt de session hook.

`src/components` bevat de watch integration panel componenten. Deze tonen
providerkeuze, connection status, watch metrics en de FuelPlan prompt.

`src/ui` bevat de setup- en guidance panels. Deze laag mag geen sportformules
bevatten.

`src/state/useCoachSession.ts` beheert de interactieve sessie: setup/guidance
screen, elapsed time, pauze/hervat, intake-events en skip-events.

`src/engine` is de source of truth voor rekenlogica:

```text
src/engine/energyEngine.ts   Keytel, Minetti, RER en energy totals
src/engine/fuelingEngine.ts  coachplan, fueling-reminders en FuelPlanWatchOutput
```

`src/integrations/watch` bevat de providerlaag:

```text
types.ts                  gedeelde watch data-contracten
watchProviderRegistry.ts  centrale registry
samsungProvider.ts        Wear OS / Samsung placeholder
garminProvider.ts         Connect IQ placeholder
corosProvider.ts          COROS sync-mode placeholder
mockWatchProvider.ts      demo sensor samples voor de huidige simulatie
```

`src/utils` bevat alleen generieke helpers zoals pace parsing, duur-formatting
en signed number formatting.

`src/services` is leeg in de MVP. Voeg hier pas code toe wanneer er echte API,
storage, database of externe integratie nodig is.

## App-flow en invoer

De MVP heeft twee hoofdschermen:

```text
Setup       athlete input, run data en equation selector
Guidance    live trainingweergave, fueling acties en engine-output
```

### Setup input

De setup splitst input bewust op:

- `Athlete input`: profieldata zoals gewicht, leeftijd, lengte, rust-HR,
  max-HR, vetpercentage, VO2max en geplande koolhydraten per uur.
- `Run data deep dive`: segmentdata zoals tempo, segmenttijd, cumulatieve
  tijd, hartslag, helling, hoogtemeters, temperatuur en terrain factor.

Verplichte numerieke velden hebben een voorbeeldwaarde als placeholder en
vallen bij lege of ongeldige input terug naar de laatst geldige waarde. Zo kan
de UI geen `NaN` of lege verplichte waarden naar de rekenkern sturen.

Optionele velden mogen leeg blijven:

```text
Body fat (%)             lege waarde gebruikt BMI estimate
VO2max (ml/kg/min)       lege waarde gebruikt HR estimate
Planned carbs (g/h)      lege waarde gebruikt auto target
```

Pace en tijdvelden gebruiken tekstinput omdat notaties zoals `06:01` en
`1:36:22` geen gewone decimale getallen zijn.

### Training output

Tijdens de training toont `GuidancePanel` niet alleen de gekozen output, maar
ook een live vergelijking tussen beide engines:

```text
Keytel   kJ/min + totale kcal
Minetti  kJ/min + totale kcal
```

De geselecteerde engine wordt gemarkeerd en de balken tonen visueel hoe dicht
Keytel en Minetti bij elkaar liggen. De UI gebruikt hiervoor alleen waarden uit
`fuelingEngine.ts`; de formules zelf blijven in `energyEngine.ts`.

### Watch integration panel

Links staat nu een Watch Integration Panel met providerkeuze:

```text
Samsung   Wear OS / Health Services route, real integration pending
Garmin    Connect IQ route, real integration pending
COROS     sync mode; live custom watch app pending/limited
```

De providerkeuze verandert alleen de integratiestatus en context. De demo blijft
werken via `mockWatchProvider`, zodat dezelfde data-contracten al getest kunnen
worden zonder echte horlogekoppeling.

Het watch contract gebruikt:

```text
WatchSensorSample      inkomende HR/distance/pace/time/elevation/temp data
FuelPlanWatchOutput    next action, carbs, drink, timer, buffer en deficit
```

De UI claimt bewust niet dat COROS dezelfde live custom watch-app route heeft
als Samsung/Garmin.

## Kernberekeningen

De centrale rekenkern staat in:

```text
core/app/src/engine/energyEngine.ts
```

De belangrijkste inputtypes zijn:

```text
UserProfile       atleetdata: gewicht, lengte, leeftijd, HR, VO2max, vetpercentage
TrainingSegment   runsegment: tijd, snelheid, helling, hoogtemeters, temperatuur, terrein
```

De output van `calculateTrainingEnergy(profile, segments, options)` bevat onder
andere:

```text
totalKcal
totalKj
selectedEngine
averageRer
totalCarbsBurnedG
totalFatBurnedG
keytelTotalKcal
minettiTotalKcal
segmentResults
```

### Stap 1: profiel normaliseren

De input wordt eerst begrensd en opgeschoond. Voorbeelden:

- lichaamsgewicht en lengte krijgen realistische minimum/maximum waarden;
- ontbrekend vetpercentage wordt geschat via BMI;
- ontbrekende VO2max wordt geschat uit rusthartslag en maximale hartslag.

Daarna worden afgeleide waarden berekend:

- lean body mass;
- fat mass;
- BMR via Cunningham, Katch-McArdle en Mifflin-St Jeor;
- geselecteerde BMR;
- persoonlijke MET;
- correctie tussen rust-BMR en Keytel-rustwaarde.

### Stap 2: RER en brandstofverdeling

RER beschrijft de verhouding tussen koolhydraat- en vetverbranding.

Simpel gezegd:

- lagere intensiteit schuift richting meer vetgebruik;
- hogere hartslag schuift richting meer koolhydraatgebruik;
- lange duur en dalende glycogeenvoorraad laten RER zakken;
- ingenomen koolhydraten herstellen RER gedeeltelijk.

Daaruit volgen:

```text
carbShare
fatShare
kcalPerLiterO2
fuelFactor
```

Die waarden bepalen hoeveel energie uit koolhydraten en vetten komt.

### Stap 3: Keytel engine

Keytel schat energieverbruik vanuit hartslag en atleetprofiel.

In deze app betekent Keytel:

```text
energie die deze atleet waarschijnlijk werkelijk gebruikt op basis van HR
```

De engine:

1. corrigeert hartslag voor warmte boven de ingestelde temperatuurdrempel;
2. past optioneel HR drift toe;
3. rekent kJ/min met de man/vrouw Keytel-formule;
4. telt de body-composition/BMR-correctie op;
5. past de RER fuel factor toe.

### Stap 4: Minetti engine

Minetti schat de mechanische kost van lopen over terrein.

In deze app betekent Minetti:

```text
energie die een ideale efficiënte loper mechanisch nodig heeft voor dit parcours
```

De engine gebruikt:

- helling;
- snelheid;
- lichaamsgewicht;
- terrein-factor;
- cumulatieve stijging en daling;
- economy decay bij langere duur en impact.

Minetti is dus minder afhankelijk van hartslag en meer van het parcours.

### Stap 5: gekozen output

De gebruiker kiest bovenaan de input:

```text
Keytel Equation   HR-gebaseerde energie-output
Minetti Equation  parcours/mechanica-gebaseerde energie-output
```

De app berekent beide intern, maar de gekozen engine bepaalt de hoofdoutput.
Daarmee blijven vergelijking en waarschuwingen mogelijk zonder dat de UI zelf
formules kent.

### Stap 6: fueling advies

`generateFuelingRecommendation(...)` gebruikt de segmentoutput en actuele
fuel-state om een simpel advies te geven:

- huidige fuel buffer;
- fuel deficit;
- aanbevolen koolhydraten nu;
- volgende actie over hoeveel minuten;
- korte melding voor de UI.

De carb target komt uit `plannedCarbsPerHour` of uit een default op basis van
duur en intensiteit:

```text
< 60 min    laag of geen carb target
60-90 min   ongeveer 30-45 g/u
> 90 min    ongeveer 60-90 g/u
```

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

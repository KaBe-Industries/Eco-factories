# Kořeny: zadání prototypu v0.1

## Cíl prototypu
Ověřit jedinou hypotézu: je zábavné postupně nahrazovat stroje živými řetězci,
až fabriku můžeš vypnout? A je špinavá energie dost lákavá, aby jí hráč
aspoň jednou podlehl?

Prototyp je hratelný v prohlížeči, jedna mapa, jedno sezení na 20 až 40 minut.
Žádná grafika: barevné čtverce, jednoduché ikony nebo emoji, čitelné UI.

## Technologie
- Vite + TypeScript, bez frameworku, HTML Canvas 2D na mapu, obyčejné HTML/CSS na panely.
- Simulace je úplně oddělená od vykreslování: čistá funkce `step(state, config) -> state`,
  bez přístupu k DOM. Díky tomu jde testovat a pouštět bez UI.
- Všechna čísla (ceny, rychlosti, prahy) jsou v jednom souboru `src/config.ts`.
  Nikde v kódu nesmí být "magická čísla" pro balanc.
- Testy simulace ve Vitest.
- Kód a identifikátory anglicky, všechny texty ve hře česky.
- Deploy na GitHub Pages přes GitHub Action, aby šlo poslat odkaz partě.
- README: jak to spustit lokálně (npm install, npm run dev) pro člověka,
  který neumí programovat.

## Mapa
- Mřížka 24 × 16 polí, generovaná ze seedu (seed v configu, stejný seed = stejná mapa).
- Mapou vede řeka (2 až 3 pole široká, mírně se vlní).
- Typy polí: půda, řeka, ruina, kopec (jen kopec dává větrníkům bonus).
- Každé pole půdy má hodnoty 0 až 100:
  - `toxicity` (start 50 až 90, u ruin vyšší)
  - `moisture` (start podle vzdálenosti od řeky, dál od řeky sušší)
- Globální hodnoty:
  - `riverQuality` 0 až 100 (start 15)
  - `pollution` 0 až 100 (start 10)
- Uprostřed mapy stojí Databanka (předem postavená, nedá se zbourat).

## Čas
- Simulace běží v ticích. Rychlosti: pauza, 1× (1 tick za sekundu), 3×.
- Žádný časový limit, žádní nepřátelé. Hra nikdy nekončí prohrou.

## Zdroje
- **Materiál**: start 60. Získává se rozebráním ruin (ruina dá 20 materiálu,
  rozebrání trvá 10 ticků) a recyklací strojů (vrací 50 % ceny).
- **Energie**: nejde skladovat. Každý tick se porovná výroba a spotřeba.
  Když spotřeba převýší výrobu, všechny stroje jedou na poměrný výkon
  (výroba / spotřeba). Hráč to musí vidět v UI.

## Energie (2 zdroje)
| Stavba | Cena | Výkon | Vedlejší efekt |
| --- | --- | --- | --- |
| Uhelná elektrárna | 15 mat. | +10 energie | +0,4 pollution za tick |
| Větrník | 35 mat. | +4 energie × vítr | žádný, na kopci ×1,5 |

Vítr kolísá v čase mezi 0,3 a 1,2 (sinus + šum), aktuální hodnota je vidět v UI.

## Stroje (4)
Každý stroj jde zapnout, vypnout a rozebrat. Vypnutý stroj nežere energii.

| Stroj | Cena | Energie | Efekt |
| --- | --- | --- | --- |
| Čistička půdy | 20 mat. | 3 | toxicity −1 za tick v okruhu 2 |
| Závlaha | 15 mat. | 2 | moisture +1 za tick v okruhu 2 |
| Filtrační stanice | 30 mat. | 4 | jen na břehu řeky, riverQuality +0,3 za tick |
| Rozprašovač pylu | 20 mat. | 2 | opyluje rostliny v okruhu 3 |

## Databanka a druhy (3 patra)
Patro se odemkne, až biom splní podmínku. Odemčený druh je potřeba
"rozmrazit": stojí 8 energie za tick po dobu 20 ticků (databanka se chová
jako spotřebič). Potom ho hráč může vysazovat na pole.

| Patro | Druh | Podmínka odemčení | Co nahradí | Jak funguje |
| --- | --- | --- | --- | --- |
| 1 | Houby | aspoň 10 polí s toxicity < 60 | čističku půdy | na poli s toxicity < 70 snižují toxicity o 0,5 za tick, šíří se na sousední pole s toxicity < 70 |
| 2 | Rákos a pionýrské rostliny | riverQuality ≥ 40 a aspoň 15 polí s toxicity < 30 | závlahu a filtrační stanici | roste na poli s toxicity < 30 a moisture > 40; drží vlhkost (moisture se na zarostlém poli nesnižuje); rostliny na břehu zvyšují riverQuality; šíří se jen když jsou opylené |
| 3 | Včely | aspoň 20 polí s rostlinami a pollution < 40 | rozprašovač pylu | populace 0 až 100, opylují rostliny v okruhu podle velikosti populace; rostou, když je dost rostlin |

Vysazení druhu stojí 5 materiálu za pole. Šíření pak probíhá samo.

## Znečištění a kolaps
- `pollution` roste z uhelných elektráren, samo klesá o 0,05 za tick,
  každé pole s rostlinami ho snižuje o 0,002 za tick.
- Nad pollution 40: zjeví se duch včely s varováním (vždy dřív, než se něco stane).
- Nad pollution 50: kyselé deště. Včely ubývají o 3 % za tick, rostliny
  bez opylení přestávají růst a pomalu odumírají, toxicity na polích lehce roste.
- Kolaps se tak šíří po řetězci: včely → opylení → rostliny → vlhkost a řeka.
- Pod pollution 40 se vše pomalu vzpamatovává. Nic se nesmaže natrvalo,
  žádný game over.
- Hráč musí vždy vidět příčinu: overlay znečištění a tooltip "proč umírají včely".

## Soběstačnost a výhra
- 4 funkce: čištění půdy, zavlažování, filtrace řeky, opylování.
- Pro každou funkci se počítá podíl, který dělají živé druhy (ne stroje),
  0 až 100 %. Celková soběstačnost = průměr čtyř funkcí.
- UI ukazuje soběstačnost celkem i po funkcích.
- **Výhra**: všechny stroje i elektrárny jsou vypnuté nebo rozebrané,
  soběstačnost je ≥ 95 % a biom vydrží stabilní 60 ticků
  (riverQuality, včely i rostliny neklesají). Pak se zobrazí obrazovka
  "Niva je vyléčená" s časem a počtem kolapsů.

## Duch včely
- Jeden duch, texty v souboru `src/content/ghost.json`, aby je šlo upravovat
  bez programování.
- Spouštěče (každý text max. jednou, pokud není uvedeno jinak):
  - start hry: úvod, co je databanka
  - první uhelná elektrárna: "Tenkrát to taky začalo jednou elektrárnou. Jen na přechodnou dobu."
  - odemčení každého patra: nápověda, co druh potřebuje
  - pollution překročí 40: varování (opakovatelné, max. jednou za 100 ticků)
  - první vymírání včel: vysvětlení, co je způsobilo
  - první vypnutý stroj díky živému druhu: povzbuzení
  - výhra: závěrečná řeč
- Duch se zobrazí jako bublina u příslušného místa na mapě, dá se zavřít.

## UI
- Mapa na canvasu, kliknutím se staví, najetím myší tooltip s hodnotami pole.
- Horní lišta: materiál, energie (výroba / spotřeba), vítr, pollution, soběstačnost, rychlost času.
- Boční panel: stavební menu, databanka (patra, podmínky odemčení s progresem, rozmrazování), seznam funkcí se soběstačností.
- Overlaye (přepínač): toxicita, vlhkost, znečištění, opylení.
- Kliknutí na stroj: zapnout, vypnout, rozebrat.
- Uložení hry do localStorage (obalené v try/catch, když selže, hra jede dál).
- Skrytý debug panel (klávesa D): všechny globální hodnoty a tlačítko "přeskoč 100 ticků".

## Balanční test (povinný)
Napiš headless skript `npm run balance`, který bez UI odehraje tři
jednoduché strategie (skriptované boty) a vypíše, za kolik ticků vyhrály
a kolik zažily kolapsů:
1. **Čistá**: jen větrníky od začátku.
2. **Půjčka**: uhlí na začátku, po odemčení patra 2 přechod na větrníky a zbourání uhlí.
3. **Závislák**: uhlí pořád.

Cílový stav balancu:
- Půjčka je nejrychlejší (aspoň o 15 % rychlejší než Čistá).
- Čistá vyhraje, jen pomaleji.
- Závislák do 3000 ticků nevyhraje a zažije aspoň jeden kolaps včel.

Pokud to tak nevychází, uprav čísla v configu (ne logiku) a napiš,
co jsi změnil. Tento test je hlavní důkaz, že návrh hry funguje.

## Fáze
Po každé fázi se zastav, shrň, co je hotové, a jak to vyzkoušet.

0. Kostra projektu, Vite + TS, Vitest, GitHub Action pro Pages, README.
1. Generování mapy ze seedu a vykreslení, tooltip pole, overlaye.
2. Čas, materiál, energie, stavění a rozebírání, ruiny.
3. Simulace toxicity, vlhkosti a řeky, efekty strojů.
4. Databanka, odemykání pater, rozmrazování, šíření druhů.
5. Znečištění, kolapsy, duch včely.
6. Soběstačnost, výhra, ukládání.
7. Balanční skript a ladění čísel.

## Mimo rozsah
Cestování mezi biomy, blueprinty, technologický strom, příběh nad rámec
jednoho ducha, zvuk, grafika, mobilní ovládání, býložravci a predátoři.

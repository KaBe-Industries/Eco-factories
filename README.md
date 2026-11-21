# Kořeny

Hratelný prototyp hry o léčení zničené nivy: postupně nahrazuješ stroje
živými druhy, až můžeš fabriku vypnout. Zadání je v
[docs/PROTOTYP.md](docs/PROTOTYP.md).

## Zahrát si v prohlížeči

Po každém nahrání změn na GitHub se hra sama zveřejní na GitHub Pages.
Odkaz najdeš v repozitáři vpravo nahoře v rámečku **About**
(nebo v **Settings → Pages**).

## Spustit na vlastním počítači

Stačí to udělat jednou, pak už jen krok 4.

1. Nainstaluj **Node.js** (verze 22 nebo novější) ze stránky
   <https://nodejs.org> – stáhni verzi označenou „LTS“ a proklikej instalátor.
2. Stáhni si tento projekt: na GitHubu zelené tlačítko **Code → Download ZIP**,
   a rozbal ho.
3. Otevři ve složce projektu terminál:
   - **Windows:** ve složce klikni do adresního řádku Průzkumníka,
     napiš `cmd` a stiskni Enter.
   - **Mac:** klikni pravým na složku → **Služby → Nový terminál ve složce**.

   Do terminálu napiš a potvrď Enterem:

   ```bash
   npm install
   ```

   Stáhne to potřebné nástroje (chvíli to trvá, stačí jednou).
4. Spusť hru:

   ```bash
   npm run dev
   ```

   V terminálu se objeví adresa typu `http://localhost:5173`. Otevři ji
   v prohlížeči. Hru vypneš zavřením terminálu (nebo Ctrl+C).

## Další příkazy

| Příkaz | Co dělá |
| --- | --- |
| `npm test` | spustí automatické testy simulace |
| `npm run build` | připraví verzi pro zveřejnění (složka `dist`) |

## Kde co upravit bez programování

- **Čísla hry** (ceny, rychlosti, prahy): `src/config.ts`
- **Texty ducha včely**: `src/content/ghost.json`

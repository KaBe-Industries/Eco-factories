# Pravidla pro práci na projektu

- Zadání hry: `docs/PROTOTYP.md`. Postupuje se po fázích, po každé fázi stop a shrnutí.
- Větve pojmenovávej podle fáze: `faze-<číslo>-<krátký-popis>`, např. `faze-1-mapa`.
- Před každým commitem spusť `npm test` (a `npm run build`); ve shrnutí uveď, jestli prošly.
- Uživatel není vývojář: shrnutí piš česky, srozumitelně, bez programátorského žargonu.
- Kód a identifikátory anglicky, všechny texty ve hře česky.
- Simulace (`src/sim/`) nesmí sahat na DOM; vše přes čisté funkce `step` a `applyCommand`.
- Všechna balanční čísla jen v `src/config.ts`.

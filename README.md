# Midnight Club — Card Arcade

A polished, responsive browser arcade featuring Crazy 8, European roulette, and blackjack. The games use virtual chips only—no account, payment, or real-money gambling is involved.

[Play Midnight Club](https://midnight-club-card-arcade.jacquesvidja.chatgpt.site)

![Midnight Club social preview](public/og.png)

## Games

- **Crazy 8:** Play against the house, match rank or suit, and call a new suit when using an eight.
- **Roulette:** Bet on a single number, red, black, odd, or even. The animated wheel lands on the generated result.
- **Blackjack:** Choose a stake, then hit, stand, or double. The dealer stands on 17 and blackjack pays 3 to 2.

Your virtual chip balance is saved on the current device. Active wagers are settled only when a round completes, so refreshing does not consume an unfinished wager.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

Run all checks together with `npm run check`.

## Project structure

- `app/arcade.tsx` coordinates the three game tables and their interface state.
- `app/game-engine.ts` contains reusable rules, scoring, payouts, and wheel positioning.
- `app/game-engine.test.ts` verifies the important game rules.
- `app/balance-store.ts` manages the device-local chip balance.
- `app/card-view.tsx` and `app/rules-modal.tsx` contain reusable accessible interface pieces.

## Fair-play note

Cards and roulette outcomes use the browser’s `Math.random()` generator. This is appropriate for this no-money entertainment project, but it is not suitable for regulated or real-money gambling.

## License

[MIT](LICENSE) © 2026 Jacques Vidjanagni.

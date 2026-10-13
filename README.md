# Regatta Flight Planner

Generates a random but fair flight plan for a league-style fleet regatta, where more teams than boats share the water and swap boats between races. It is built as an offline-first PWA, and the plan is meant to live in a shareable URL, not on a server.

**Status: early.** The plan generator (the solver) is a working prototype with a command line. In the app, a form builds the plan link, for example `/#0.t17b7.f9-15.oOGBRK.K7QX2M`. The link is solved in a Web Worker with a progress bar, and the Flight view shows each flight with idle boats and keepers. The live solver is too slow on phones for now (about 50 s on an iPhone 17, see the findings). The team, boat and stats views come next.

## How a plan works

- The organiser divides the teams into flights, and each flight has several races. Every team races once per flight.
- A plan is scored on opponent balance, gaps between a team's races, boat balance, boat reuse and keeper duty. You choose the order of these objectives and the solver compares plans tier by tier.
- The same inputs always give the same plan: seeded integer PRNG, integer scores and a fixed iteration count. Each plan has a short checksum for comparing results across devices.

Search quality results so far are in [docs/solver-findings.md](docs/solver-findings.md).

## Development

Requires Node 22 or newer (CI uses 24).

```sh
npm install
npm run dev
npm run build
```

Try the solver from the command line:

```sh
npm run solve -- --teams 17 --boats 7 --flights 15 --min-flights 9
```

It prints the flights, idle boats and keepers, meeting and boat spreads, the plan checksum and the solve time.

## Tests

```sh
npm test                  # solver unit tests
npm run test:determinism  # same checksum in Chromium, Firefox and WebKit as in Node, also through the worker
```

The determinism check runs in CI on Linux and macOS. Run `npx playwright install` once to get the browsers locally.

## License

[MIT](LICENSE.txt)

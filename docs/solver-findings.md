# Solver prototype: search quality findings

Status of the step 1 prototype (`src/solver/`), measured with `npm run solve` on a Mac in Node.
All runs use seed `K7QX2M`.

## Benchmark: 18 teams, 6 boats, 16 flights (races of 6)

Target from the spec: meeting spread 1. A perfect plan has O = 3420 (108 pairs meet 5 times, 45 pairs meet 4 times).

| Setup | O | Meeting spread | Time |
|---|---|---|---|
| order OBGRK, 300k iterations, old acceptance rule | 3456 | 3 | 1.3 s |
| order OBGRK, 1M iterations, old acceptance rule | 3468 | 3 | 4.3 s |
| order OBGRK, 4M iterations, old acceptance rule | 3456 | 3 | 17 s |
| order O only, 1M iterations, old rule, start temp 2 / 6 | 3446 / 3444 | 3 | 4.3 s |
| order O only, 1M iterations, 2^-x acceptance, start temp 0.5 / 1 / 2 / 4 | 3440 / 3440 / 3442 / 3444 | 3 / 2 / 3 / 3 | 4.3 s |
| order O only, 4M iterations, start temp 1 | 3438 | 2 | 17 s |
| order O only, 16M iterations, start temp 1 | 3438 | 3 | 70 s |

## Findings

- **Boat balance (B) is easy.** It reaches its optimum (792 for 18 teams) in every run.
- **Opponent balance (O) is the hard part.** Plain simulated annealing stalls at O ≈ 3438–3442, 18–22 above the optimum, with a meeting spread of 2–3.
- **More iterations do not help past about 1M.** 4M and 16M reach the same O as 1M. The search is stuck in local optima, not short on time.
- **Temperature matters a little.** Replacing the heavy-tailed rule `T / (T + 4d)` with an integer `2^(-d/T)` table and a lower start temperature (0.5–1 score steps) improved O from about 3444 to 3440.
- **Other tiers do not explain the plateau.** An O-only order stalls at the same level as OBGRK.
- **Speed.** About 4 s per 1M iterations in Node on this Mac. A phone will be slower, and this is not yet measured.

## 17 teams, 7 boats, 15 flights (min 9), default order, 1M iterations

O = 2696, G = 64, B = 663, R = 11, K = 18, meeting spread 3, boat spread 1, 5.5 s.
The keeper and gap output is readable. It still needs a review by a race officer.

## Phone solve time: needs rework

Version 0 (1M iterations), link `#0.t17b7.f9-15.oOGBRK.K7QX2M` (17 teams, 7 boats, 15 flights, min 9), solved in the Web Worker of the app:

| Device | Solve time |
|---|---|
| MacBook (browser and headless Chromium, WebKit) | 5.4–6.6 s |
| iPhone 17, Safari | 49.9 s |

The phone is about 8 times slower than the laptop. Fifty seconds is not acceptable for an interactive plan, and the live solver needs rework before the app depends on it.
The fixed iteration count stays (determinism), so the fix has to come from fewer iterations doing more (better moves, a structured start), a faster inner loop, or templates.

## Conclusions

- Plain annealing with the three spec moves does not reach spread 1 for the 18-team league case within a phone-sized budget.
- The template fast path in the spec (long offline compute, ship JSON, seed permutes teams and boats) looks necessary for this case, not only an optimisation.

## Ideas to try, in order

1. Targeted team swaps: prefer swaps that involve the most over-met pairs.
2. Restarts: several short runs with different sub-seeds, keep the best.
3. Start from a structured construction (for example a rotation scheme) instead of a random plan.
4. Better temperature handling: reheating, or a schedule per phase.
5. If none reaches spread 1, build the offline template compute job and use the live solver as the fallback.
6. Profile the inner loop (score deltas, undo) in Safari; the phone time has to come down by about 10×.

## Not yet measured

- Firefox determinism. `tests/determinism.spec.ts` runs 4 cases in Chromium, Firefox and WebKit and compares each with Node.
  Chromium and WebKit match Node locally (8 of 8). Firefox does not start on the dev Mac ("Could not find profile folder"),
  so it relies on the GitHub Actions run on Linux. WebKit is the Safari engine but not Safari itself.
- Solve time on a mid-range phone. An iPhone 17 is measured above; a mid-range Android is not.

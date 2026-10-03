# Qubit FC

Five-a-side football. Every completed pass is a quantum gate.

Two teams, ten players, one qubit. Build the ball's state through passing, protect it from pressure, and aim for the defending keeper's measurement lock. Football skill gets the shot past the keeper; the Born rule decides whether it counts.

## Play locally

Requires Node.js 20.19+ or 22.12+ and a modern desktop browser.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. Choose **Kick off** for local multiplayer, **Practice vs AI** for one player, or **Watch match** for an autonomous demonstration. Keyboard layouts work immediately; two standard gamepads can claim teams in the join screen. Controllers use the browser's standard mapping, including Xbox and PlayStation controllers. Browsers generally reveal a connected controller after its first button press.

Standard matches have two three-minute halves. The showcase setting uses one-minute halves. Expert mode hides phase in the globe and ball hue; the shot probability and passing history remain visible. Audio begins after interaction. Pause with Escape, P, or controller Start; hiding the browser also pauses a live match.

| Action | Player 1 | Player 2 | Controller |
| --- | --- | --- | --- |
| Move / aim pass | W A S D | Arrow keys | Left stick / D-pad |
| Pass | F | K | A / Cross |
| Hold, then release to shoot | G | L | B / Circle |
| Switch defender / call press | H | J | X / Square |
| Switch your keeper's reading | R | U | Y / Triangle |
| Sprint | Left Shift | Right Shift | RT / RB |

Pass in the direction you face; a dashed line previews the best teammate. Control moves to the receiver. Your selected player has an arrow, a scoring probability bar, and a charging shot bar. Every team has an X defender, H and Z midfielders, a T striker, and a keeper who resets the qubit.

## Quantum model

The ball is a Bloch vector **r**, including mixed states inside the unit sphere. The goal's target is unit vector **n**. The probability of scoring after beating the keeper is:

```text
P(goal) = (1 + r · n) / 2
```

For a pure state, this is exactly `cos²(theta/2)`. North against the north lock scores with certainty; south never scores. The center gives 50% against every lock.

- **X:** `(x, y, z) → (x, −y, −z)`.
- **H:** `(x, y, z) → (z, −y, x)`.
- **Z:** `(x, y, z) → (−x, −y, z)`.
- **T:** rotate about z by π/4. The math module also supports S, a π/2 rotation.
- **Pressure:** a depolarizing channel continuously shortens r. Gates preserve length, so passing cannot repair it.
- **Turnover:** a projective Z measurement erases phase and returns north or south according to the current Born probability.
- **Keeper reception / kickoff:** reset to fresh north.
- **Keeper reading:** rotate the lock between +Z and +X over two seconds. Rotation pauses inside the defending penalty box. The globe's hollow gold marker and goal glyph show the current axis, including partial rotations.
- **Shot:** physical contact and keeper saves occur first. A ball entering the goal then gets a half-second measurement beat, snapping to the positive or negative lock axis before the result.

Two useful routes, starting from a fresh north state:

| Reception sequence | Result |
| --- | --- |
| H → Z → H | South, identical to X. Reveals how phase changes later outcomes. |
| H → T → H → T → Z → T → Z | `x = z = 1/√2`, `y = 0`: 85.36% against either fixed keeper reading. |

The hedge falls toward 50% under pressure. H → T → H alone is **not** an X/Z hedge: its X probability is 50%. Only receptions apply gates; dribbling leaves the state unchanged. Intermediate teammates also count, so plan the entire passing route.

## Build and checks

```sh
npm test
npm run build
npm run preview
```

The production build is in `dist/`. Serve it over HTTP with `npm run preview` or any static host. Quantum and simulation checks cover gate identities, the hedge, pressure conservation, completed passes, keeper saves/reset, interception collapse, board rebounds, shot outcomes and complete matches. The renderer and UI are checked in Chromium with the available Playwright installation.

## Source layout

| File | Responsibility |
| --- | --- |
| `src/game/quantum.js` | Pure Bloch-vector gates, measurements and channels |
| `src/game/simulation.js` | Fixed-step football, AI, match lifecycle and stats |
| `src/game/scene.js` | Procedural stadium, players, ball, camera, globe and radar |
| `src/input.js` | Two-player keyboard/gamepad controls, claims and input edges |
| `src/audio.js` | Synthesized kicks, gates, whistle, crowd and measurement feedback |
| `src/ui.js`, `src/style.css` | Title, join, instructions, broadcast HUD and results |
| `src/main.js` | Match orchestration and scene integration |

## Third-party declarations

- **Phaser 3.90**, MIT, game rendering and scene lifecycle.
- **Vite 7**, MIT, development server and production bundling.
- **Barlow Condensed**, SIL Open Font License, bundled via `@fontsource/barlow-condensed`.
- **Playwright**, Apache-2.0, optional development verification only; not a runtime dependency.

All primary gameplay code, pitch graphics, player/ball visuals, icons and synthesized audio are authored for this project. No external image or sound packs are used. Exact installed dependency versions are recorded in `package-lock.json`.

## Scope

The playable core includes local multiplayer, solo practice, spectator mode, five-player formations, gate passes, pressure, goalkeeper readings, collapse/reset, physical saves, measurement shots, two halves, stats, tutorials, audio and accessibility settings. The spatial split through-ball remains a stretch feature; a single Bloch vector cannot honestly represent its two-lane interference, so it needs a separate spatial state model.

See [design notes](docs/DESIGN.md) for the model and visual direction, and [showcase guide](docs/SHOWCASE.md) for a short demonstration plan.

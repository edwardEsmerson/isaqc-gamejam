# Level building handoff

## What the builder creates

The editor tool at `unity/Assets/Editor/DemoProjectBuilder.cs` creates saved,
editable Unity assets; it is not a runtime level generator. On first import it
builds the rooms when `Assets/Scenes/01-the-box.unity` is missing, creating
them additively. A dirty current scene remains open and unsaved, with a Console
message telling you to open `01-the-box.unity` when ready; if the current scene
is clean, first import opens the new demo automatically. Use **Quriosity > Build Demo and Level Templates**
only if first-import setup failed or to fill missing assets/scenes. The builder
preserves existing scenes/prefabs/tiles and adds all four rooms to Build
Settings.

| Scene | Status and intended concept |
| --- | --- |
| `01-the-box.unity` | Introductory demo: learn movement, reach the console, measure a route, and follow the story toward rescuing Hilary from Schrödinger. Both measurement outcomes have a safe route to the exit; the prologue ends with Hilary still ahead. |
| `02-linked-rooms.unity` | Editable movement graybox; entangled outcomes are the intended concept, not an implemented puzzle. |
| `03-phase-laboratory.unity` | Editable movement graybox; phase and interference are the intended concepts, not an implemented puzzle. |
| `04-schrodingers-hideout.unity` | Editable movement graybox; combining quantum rules is the intended concept, not an implemented boss or puzzle. |

The last three rooms have safe movement routes, checkpoint/player/exit
scaffolding, and concept labels/art only. Do not present their labels or props
as working quantum mechanics. `LevelExit.NextSceneName` is left empty; the HUD
offers an **Explore next template** button when the next scene is in Build
Settings. Set `NextSceneName` if an exit-triggered scene transition is desired.

## Editing a room

1. Keep one teammate's level edits in one scene at a time. Open the intended
   scene under `Assets/Scenes/`; do not rebuild a shared room to make a personal
   variant. Rerunning the builder does not overwrite an existing room.
2. Open **Window > 2D > Tile Palette** and select
   `Assets/Tiles/Demo/Demo Palette.prefab`. Paint on the scene's
   `World / paintable terrain` tilemap. Its static Rigidbody2D, TilemapCollider2D,
   and CompositeCollider2D make painted terrain solid; leave those components
   intact for collision.
3. Shared linked prefabs are in `Assets/Prefabs/Demo/` (Fleabag, checkpoint,
   spike hazard, exit, console, and story props). Use the prefab rather than a
   one-off copy when the shared behavior should stay consistent. Keep props and
   decorations non-blocking unless they are deliberately part of the route.
4. The whole room is visible in a fixed 640 × 360 camera at 16 PPU: a 40 × 22.5
   world-unit frame. Use 16 × 16 pixel terrain tiles, and do not design a route
   that depends on scrolling beyond the frame.
5. Floor tops in the templates use integer world Y coordinates. Place Fleabag's
   root at `floor surface Y + 0.8125`; the checkpoint prefab's safe-respawn
   child already includes that standing offset, so do not add it a second time.
   The builder places its spike-hazard roots at Y `0.875`; hazard colliders are
   triggers, not solid floor. Keep hazards out of spawn/respawn points and do
   not block required paths.
6. Keep every required route traversable with normal movement. For the demo,
   preserve the gap that makes the console's measurement necessary and ensure
   **both** outcome branches can be completed safely. Fall/spike hazards respawn
   the player at the initial point or activated checkpoint.

## Quantum puzzle goals

Keep quantum calculations in small, deterministic, pure-C# types, separate from
Unity scene components and UI. At the first console, E cycles through
**prepare → measure → reset**. The station applies H to the initial `|0⟩`,
measures a sample, then resets to `|0⟩`; respawning also resets the station.
Because this preparation is `H|0⟩`, both outcomes have a 50% chance. More
generally, for a normalized state `α|0⟩ + β|1⟩`, use `P(0) = |α|²` and
`P(1) = |β|²`, not a fair coin. Measurement collapses the state and makes only
its matching bridge solid. The pure-C# `QubitState` model implements H, X, and
Z; the current station uses H, measurement, and reset, not X/Z puzzle steps.
Repeatable math checks are available via `sh scripts/check-quantum.sh`. The
script requires .NET SDK 8 or newer, targets the installed SDK's matching
framework, and can use the Windows `dotnet.exe` fallback under WSL; it has no
NuGet dependencies. It tests the pure state model, not Unity scene wiring or
route playability. The first room's two outcomes must both remain viable routes.

Build later rooms as actual mechanics only when their quantum logic is ready:
level 2's entangled outcomes, level 3's phase/interference, and level 4's
combination of quantum rules remain planned work. The current template scenery
does not implement those mechanics or a boss.

## Verify and play through

Run **Quriosity > Verify Saved Demo Assets** outside Play Mode. It checks saved
scenes, prefab links, collision tilemaps, camera/art settings, and authored route
geometry; its own message notes that a playthrough is still required. In Play
Mode, test movement, jump/dash, checkpoint and hazard recovery, console
prepare/measure/reset, and **both** measured routes. Test the HUD's next-template
navigation after editing Build Settings. If an edited exit should load a scene
on contact, set and test its `NextSceneName`; the builder leaves that field blank.

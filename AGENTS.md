# Repository Guidelines

## Project Structure & Module Organization

This repository supports ISAQC’s QURIOSITY quantum game jam. The Unity 6.3 project is in `unity/`: gameplay scripts belong in `Assets/Scripts/Gameplay`, quantum rules in `Assets/Scripts/Quantum`, interface code in `Assets/Scripts/UI`, scenes in `Assets/Scenes`, and PixelLab art in `Assets/Art/Source` or `Assets/Art/Generated`. Keep generated Unity caches out of Git. Root-level event, contribution, and attribution guidance lives in `about.md`, `CONTRIBUTING.md`, and `THIRD_PARTY.md`.

## Build, Test, and Development Commands

- `sh scripts/setup-git.sh` configures Git defaults for this checkout.
- Install Unity Editor `6000.3.25f1` with Unity Hub, then open the `unity/` folder and let Package Manager resolve its pinned dependencies.
- `sh scripts/setup-pixellab.sh` adds the project-scoped PixelLab MCP entry for Codex. Set `PIXELLAB_API_KEY` in the Codex process environment; never commit it.
- Build through Unity’s **File > Build Profiles**. There is no automated Unity build or test command configured yet.
- Run `git diff --check` and `git diff --cached --check` before committing.

## Coding Style & Naming Conventions

Use C# with four-space indentation, PascalCase for types and public members, and camelCase for private fields and locals. Give each `MonoBehaviour` its own matching `.cs` filename. Keep scene-bound behavior in components and quantum calculations in small, deterministic C# types that can be reasoned about independently. Use descriptive scene, prefab, and asset names such as `measurement-room.unity` and `player-dash.png`.

## Testing Guidelines

No test framework is configured yet. At minimum, compile in the Unity Editor and play through the changed interaction. When quantum rules are added, cover state transitions and measurement outcomes with repeatable tests; record manual checks in the pull request.

## Commit & Pull Request Guidelines

Follow `CONTRIBUTING.md`: use `feat/`, `fix/`, `docs/`, or `chore/` branches; make small commits with imperative subjects; stage explicit files; and never rewrite shared history. Pull requests should explain the behavior, link an issue when available, record checks, and include a capture for visible changes. Do not merge without teammate review.

## Game-Jam Requirements

Follow `about.md`: quantum mechanics must drive gameplay, primary gameplay code must be written during the event window, third-party code and art must be declared, and Git history must show incremental work.

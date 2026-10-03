# ISAQC · QURIOSITY

The challenge brief is in [`about.md`](about.md). This repository contains a Unity 6.3 project scaffold for an original quantum-inspired 2D platformer; gameplay, scenes, and art are still to be built during the jam.

## Start the project

1. Install Unity Editor `6000.3.25f1` with Unity Hub.
2. In Unity Hub, open the existing project at `unity/` and wait for its pinned packages to resolve.
3. Create and save a scene under `unity/Assets/Scenes/`, then press Play to iterate.

The project uses Unity’s 2D physics and tilemap workflow, with the Input System, Pixel Perfect Camera, and Tilemap Extras packages. See [`unity/README.md`](unity/README.md) for editor setup and [`AGENTS.md`](AGENTS.md) for coding guidance.

## PixelLab art workflow

PixelLab is an optional hosted art-generation service used during development. Configure its Codex MCP entry with `sh scripts/setup-pixellab.sh`, then provide `PIXELLAB_API_KEY` to the Codex process. Art is exported into `unity/Assets/Art/Generated`; the game does not call PixelLab at runtime. See [`docs/art-pipeline.md`](docs/art-pipeline.md) and record imported assets in [`THIRD_PARTY.md`](THIRD_PARTY.md).

## Team workflow

Read [`CONTRIBUTING.md`](CONTRIBUTING.md), then configure Git for this checkout with:

```bash
sh scripts/setup-git.sh
```

Use a task branch, commit small milestones, and open a pull request into `main` for teammate review. GitHub checks whitespace on changed files.

Before committing, run:

```bash
git diff --check
git diff --cached --check
```

Build a local player from Unity’s **File > Build Profiles** after adding the scene to the selected profile. No command-line build or automated Unity test runner is configured yet.

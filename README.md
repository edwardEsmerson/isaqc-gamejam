# ISAQC · QURIOSITY

The challenge brief is in [`about.md`](about.md).

## Team workflow

Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting a task. Shared coding-agent
instructions live in [AGENTS.md](AGENTS.md), and the jam requirements are in
[about.md](about.md).

After cloning, configure Git for this checkout:

```bash
sh scripts/setup-git.sh
```

Work on a descriptive branch, commit small milestones, push regularly, and open a
pull request into `main`. Have a teammate review it before merging. GitHub runs
the repository whitespace check on pushes and pull requests.

## Game stack and local development

The browser game uses Phaser, TypeScript, and Vite. PixelLab supplies generated
pixel-art assets during development; Aseprite is an optional desktop art editor.
Library and asset declarations live in [THIRD_PARTY.md](THIRD_PARTY.md).

Install Node.js 24 or newer, then run:

```bash
cd prototype
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. The initial
320 × 180 setup screen confirms Phaser is running; gameplay and quantum
mechanics have not been implemented yet.

From `prototype/`, use `npm run typecheck` to check TypeScript, `npm run build`
to check and build into `dist/`, and `npm run preview` to serve the build locally.
No test runner, linter, or formatter is configured yet.

## PixelLab setup

From the repository root, run `sh scripts/setup-pixellab.sh`. This configures the
official hosted MCP service for Codex in this checkout. Set `PIXELLAB_API_KEY`
in your client environment and start a new session to authenticate. Follow
[the art pipeline](docs/art-pipeline.md) for token entry and asset specifications.
The game runs without a PixelLab account; asset generation requires one.

Keep editable artwork in `assets/source/` and game-ready exports in
`prototype/public/assets/`. Game code lives in `prototype/src/`.

## Repository checks

Before committing, run:

```bash
git diff --check
git diff --cached --check
```

For a complete branch review against the latest `main`, run:

```bash
git fetch origin
git diff --check origin/main...HEAD
```

GitHub also installs the locked game dependencies and runs the production build.
The submission README must link to the playable build when one is available.

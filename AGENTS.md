# Repository Guidelines

## Project Structure & Module Organization

This repository supports ISAQC’s QURIOSITY quantum game jam. The initial Phaser setup lives in `prototype/`:

- `prototype/src/`: TypeScript entry point and Phaser scenes in `scenes/`; keep future quantum calculations in a separate `quantum/` module.
- `prototype/public/assets/`: approved runtime sprites, tilesets, audio, and atlas files.
- `assets/source/`: editable artwork and approved generation originals.
- `docs/art-pipeline.md`: PixelLab connection and asset workflow.

- `about.md`: challenge tracks, judging criteria, event rules, and submission checklist.
- `README.md`: project introduction and intended prototype startup instructions.
- `to-do.md`: contributor workflow ideas and planning notes.
- `CONTRIBUTING.md`: shared team workflow and review requirements.
- `THIRD_PARTY.md`: library and asset attribution ledger.
- `.github/`: issue templates, pull request template, and repository checks.
- `scripts/setup-git.sh`: local Git defaults for a team checkout.
- `scripts/setup-pixellab.sh`: project-scoped PixelLab MCP setup; shared template in `config/pixellab.codex.toml`.

The starter displays a setup screen. Gameplay, quantum mechanics, and a test suite have not been implemented yet.

## Technology Stack & Art Direction

Use **Phaser**, **TypeScript**, and **Vite** for the browser game. Use **PixelLab** for AI-generated pixel art and animations; it is a hosted development tool, not a browser dependency. Its MCP connection reads `PIXELLAB_API_KEY` from the client environment. Never commit tokens or expose them through Vite variables. Aseprite is an optional desktop GUI for cleanup and sprite-sheet exports.

Target original Celeste-inspired pixel art, starting with a 320 × 180 canvas and 16 × 16 environment tiles. Reuse an approved character reference and palette. Keep quantum calculations independent of rendering and movement; quantum mechanics must drive gameplay. Record libraries and asset provenance in `THIRD_PARTY.md`.

## Build, Test, and Development Commands

Configure a checkout with:

```bash
sh scripts/setup-git.sh
```

Use Node.js 24 or newer. From `prototype/`, run `npm ci` to install locked dependencies, `npm run dev` for the local Vite server, `npm run typecheck` for TypeScript checks, `npm run build` for typechecking and a production build, and `npm run preview` to serve that build. From the root, run `sh scripts/setup-pixellab.sh` to configure PixelLab, then follow `docs/art-pipeline.md` to authenticate. No test, lint, or formatting scripts are defined yet.

Run `git diff --check` and `git diff --cached --check` before committing to catch whitespace errors. GitHub also checks committed changes on pushes and pull requests.

## Coding Style & Naming Conventions

Follow `.editorconfig`: UTF-8, LF, final newlines, and two-space indentation. Use strict TypeScript, ES modules, single quotes, and semicolons. Name Phaser scene classes/files in PascalCase, functions and variables in camelCase, and assets in lowercase kebab-case. Keep Markdown concise and link to files with relative paths. No formatter or linter is configured. Keep dependencies and build outputs untracked.

## Testing Guidelines

No testing framework or coverage threshold is configured. Run `npm run build` in `prototype/` and check the setup screen in a browser. Review documentation links and commands manually. For gameplay changes, play through the core interaction loop; add deterministic tests for quantum calculations when introduced. Record validation steps and results in pull requests.

## Commit & Pull Request Guidelines

Follow [CONTRIBUTING.md](CONTRIBUTING.md). Before editing, inspect the current branch and `git status`; preserve teammates' and the user's existing work.

- Use `feat/<task>`, `fix/<task>`, `docs/<task>`, or `chore/<task>` branches off an updated `main`. Reuse a branch when continuing the same task.
- Commit small, coherent milestones with a short imperative subject, such as `Add measurement feedback`. Stage explicit paths or hunks; do not sweep unrelated changes into a commit.
- Push after each validated milestone and before handing off work. If access or network restrictions block a push, report the local commit and the remaining step.
- Never force-push shared branches, rewrite published history, or discard another contributor's changes. Do not commit credentials, dependencies, or generated builds.
- At the end of a task, run the available checks, summarize validation and limitations, and open or update a pull request when GitHub access is available. Suggest merging only after checks and teammate review; do not merge automatically.

Pull requests should explain the change, link relevant issues when available, describe validation, and include screenshots or gameplay recordings for visual changes.

## Game-Jam Requirements

Follow `about.md`: quantum mechanics must drive gameplay. Write primary gameplay code during the event window, declare third-party libraries and assets in submission documentation, and preserve incremental Git history for review.

# Repository Guidelines

## Project Structure & Module Organization

This repository supports ISAQC’s QURIOSITY quantum game jam. Currently, it contains documentation rather than a checked-in game implementation:

- `about.md`: challenge tracks, judging criteria, event rules, and submission checklist.
- `README.md`: project introduction and intended prototype startup instructions.
- `to-do.md`: contributor workflow ideas and planning notes.
- `CONTRIBUTING.md`: shared team workflow and review requirements.
- `THIRD_PARTY.md`: library and asset attribution ledger.
- `.github/`: issue templates, pull request template, and repository checks.
- `scripts/setup-git.sh`: local Git defaults for a team checkout.

No game source, test, or asset directories are established yet. When adding the game, document their locations and keep gameplay logic, quantum calculations, and assets organized into separate modules.

## Build, Test, and Development Commands

Configure a checkout with:

```bash
sh scripts/setup-git.sh
```

No game build, test, lint, or formatting scripts are currently defined. Add verified commands to the README when introducing tooling; do not assume `npm test` or `npm run build` exists.

Run `git diff --check` and `git diff --cached --check` before committing to catch whitespace errors. GitHub also checks committed changes on pushes and pull requests.

## Coding Style & Naming Conventions

Keep Markdown concise, use descriptive headings, and link to repository files with relative paths. No language-specific indentation or naming conventions have been established. Follow the chosen stack’s conventions consistently and document them when source code is added. Keep generated dependencies and build outputs untracked, as specified by `.gitignore`.

## Testing Guidelines

No testing framework or coverage threshold is configured. Review documentation links and commands manually. For future gameplay changes, verify the core interaction loop and quantum behavior; add deterministic tests for quantum calculations using the selected framework’s naming conventions. Record validation steps and results in pull requests.

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

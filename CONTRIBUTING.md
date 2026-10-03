# Contributing during the jam

## Pick a task

Pick a small feature or bug and agree who owns it. GitHub issues are optional.
Coordinate before editing files another teammate is actively changing. Keep
tasks small enough to finish and verify during the jam.

The event rules in [about.md](about.md) govern the work. Quantum mechanics must
drive gameplay, and primary gameplay code must be written during the event
window. Commit incrementally so evaluators can review the development history.

## Set up and branch

After cloning, run `sh scripts/setup-git.sh`. This sets fast-forward-only pulls,
simple pushes, and pruning of stale remote branches for this checkout only.
Set your own Git name and email if they are not already configured.

Install Unity Editor `6000.3.25f1` with Unity Hub and open the `unity/` project.
Let Unity resolve the package versions in `unity/Packages/manifest.json`. If you
use PixelLab through Codex, run `sh scripts/setup-pixellab.sh` and provide the
`PIXELLAB_API_KEY` environment variable to the Codex process.

Start with a clean working tree; finish or save your existing changes first:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/measurement-feedback
```

Use `feat/`, `fix/`, `docs/`, or `chore/` followed by a short task name. Push
branches so teammates can see progress. Keep `main` ready for a demo; use direct
branch merges instead of pull requests during the jam.

## Commit and share progress

Commit after a coherent milestone, and push before a break or handoff.
Use short imperative subjects such as `Add measurement feedback`. Stage explicit
files or selected hunks and inspect the staged diff before committing:

```bash
git diff --check
git add path/to/changed-file
git diff --cached
git diff --cached --check
git commit -m "Add measurement feedback"
git push -u origin HEAD
```

The path and message above are examples; substitute your actual files and task.
After the first push, `git push` is sufficient. Never commit secrets, `.env`
files, generated builds, or dependencies. Commit lockfiles when package tooling
is introduced. Record libraries and assets in [THIRD_PARTY.md](THIRD_PARTY.md),
including their sources and licenses.

To update a published task branch, merge the latest `main` into it:

```bash
git fetch origin
git merge origin/main
```

Resolve conflicts with the affected teammate and repeat validation. Do not
force-push or rewrite published history. Do not reset or clean away another
person's work.

## Test and merge

Before merging, compile and play through the changed loop in Unity. For quantum
calculations, use repeatable checks. Coordinate with the team and use a merge
commit to preserve incremental history:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git merge --no-ff feat/measurement-feedback
git push origin main
git branch -d feat/measurement-feedback
git push origin --delete feat/measurement-feedback
```

Substitute the name of your task branch. Do not merge unfinished or untested
work. Record third-party libraries and assets in `THIRD_PARTY.md`.

The Unity project is a scaffold; gameplay and automated tests are not present
yet. The GitHub check detects whitespace errors only; it does not establish
gameplay correctness.

## GitHub settings

For direct branch merging, `main` must allow pushes without a pull request or
review approval. Keep merge commits enabled and block force pushes. Retain the
`Repository checks` status if it works with the team's direct-push workflow.
These are GitHub settings; changing this file alone does not update them.

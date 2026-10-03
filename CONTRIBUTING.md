# Contributing as a team

## Pick a task

Use a GitHub issue for each feature or bug. Describe the expected result and how
to verify it, assign one owner, and link the pull request. Coordinate before
editing files another teammate is actively changing. Keep each task small enough
to finish and review during the jam.

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

Use `feat/`, `fix/`, `docs/`, or `chore/` followed by a short task name. Share work
through branches and pull requests. Keep `main` ready for a demo.

## Commit and share progress

Commit after a coherent, validated milestone, and push before a break or handoff.
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

## Review and merge

Open a pull request into `main` early; use a draft while work is incomplete.
Describe the resulting behavior, link the issue, and record checks actually run.
Include screenshots or a short recording for visual changes. Mention unfinished
work and known limitations explicitly.

Before merging:

- Get approval from at least one teammate other than the author.
- Pass the `Repository checks` GitHub check and resolve review conversations.
- Run available game checks. For gameplay changes, play through the core loop;
  for quantum calculations, add deterministic tests and check the behavior.
- Update setup instructions and third-party declarations when needed.

Use a merge commit to preserve the jam's incremental commit history. Delete the
finished branch after merging. Coding agents should report validation and suggest
a merge once review is complete; merging remains a team decision.

The Unity project is a scaffold; gameplay and automated tests are not present
yet. The current GitHub check detects whitespace errors only; it does not
establish gameplay correctness. Compile and play through the affected loop in
Unity before submitting gameplay changes.

## GitHub settings

Protect `main` with a pull request requirement, one approving review, dismissal
of stale approvals, resolved review conversations, and the required `Repository
checks` status. Block force pushes and branch deletion. Keep merge commits
enabled and disable squash/rebase merging to preserve incremental history.
These are repository settings; cloning files alone does not activate protection.

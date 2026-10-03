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

## Project status

This repository currently contains documentation and team tooling. A playable
prototype and its package manifest have not been added yet, so there are no game
install, development, build, or test commands to run. Add verified commands here
when the implementation lands.

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

Record third-party libraries and assets in [THIRD_PARTY.md](THIRD_PARTY.md). The
submission README must link to those declarations and the playable build.

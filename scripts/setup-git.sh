#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"
git rev-parse --show-toplevel > /dev/null

# Apply only to this checkout; each teammate keeps their own identity settings.
git config --local pull.ff only
git config --local push.default simple
git config --local fetch.prune true

printf '%s\n' 'Configured this checkout: fast-forward pulls, simple pushes, prune stale remote branches.'

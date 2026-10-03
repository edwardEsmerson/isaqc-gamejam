#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"

mkdir -p .codex
config_file=.codex/config.toml

if [ -f "$config_file" ] && grep -Eq '^[[:space:]]*\[mcp_servers\.pixellab\][[:space:]]*(#.*)?$' "$config_file"; then
  printf '%s\n' 'PixelLab is already configured; existing settings were preserved.'
  exit 0
fi

if [ -s "$config_file" ]; then
  printf '\n' >> "$config_file"
fi
cat config/pixellab.codex.toml >> "$config_file"

printf '%s\n' 'Configured PixelLab for this checkout. Set PIXELLAB_API_KEY in your client environment and start a new Codex session.'

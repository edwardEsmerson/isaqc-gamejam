# Pixel art workflow

Use [PixelLab](https://www.pixellab.ai/) for optional AI-generated sprites,
animations, and tilesets. Use [Aseprite](https://www.aseprite.org/) optionally
to inspect and clean up frames, palettes, and tile seams. Aseprite is a desktop
GUI with a CLI for exports; this repository does not install it.

## Connect PixelLab to Codex

PixelLab is a hosted service, not a Unity package. Its official
[MCP integration](https://www.pixellab.ai/mcp) uses
`https://api.pixellab.ai/mcp` and a bearer token from your PixelLab account.

The shared configuration template is `config/pixellab.codex.toml`. Run
`sh scripts/setup-pixellab.sh` to add it to `.codex/config.toml` while preserving
other server entries. Codex loads project configuration for trusted projects;
see the [Codex MCP guide](https://developers.openai.com/codex/mcp/).

In Bash, enter the token without putting it in shell history, then launch a new
Codex session from this repository:

```bash
read -r -s -p 'PixelLab API token: ' PIXELLAB_API_KEY
printf '\n'
export PIXELLAB_API_KEY
codex
```

For desktop or IDE clients, supply `PIXELLAB_API_KEY` in the client process
environment and restart it. `.env` files are not loaded by this MCP entry. Use
`/mcp` in Codex CLI to check the connection. A configured server is not
authenticated until the token is available. Never put tokens in source files,
prompts, browser code, or committed config.

## Unity asset workflow

Generate assets during development and export them to
`unity/Assets/Art/Generated/`; keep editable source files in
`unity/Assets/Art/Source/`. The game does not need PixelLab access at runtime.
PixelLab account access and generation credits are separate from Unity.

Aim for an original Celeste-inspired pixel-art world: clear silhouettes, cool
backgrounds, warm character accents, and readable quantum effects. Start with a
320 × 180 reference resolution and 16 × 16 environment tiles. Approve one
character and one room before generating more; reuse references and a shared
palette. Do not copy Celeste's sprites, levels, or other protected game assets.

Check animation frame sizes and alignment, transparency, palette consistency,
and tile seams. Prefer lowercase kebab-case names such as `player-idle.png`.
Record provenance and applicable usage terms for every imported asset in
`THIRD_PARTY.md`.

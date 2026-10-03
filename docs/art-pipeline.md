# Pixel art workflow

Use [PixelLab](https://www.pixellab.ai/) for AI-generated sprites, animations,
and tilesets. Use [Aseprite](https://www.aseprite.org/) optionally to inspect and
clean up frames, palettes, and tile seams. Aseprite is a desktop GUI with a CLI
for exports; it is not an npm dependency and is not installed by this repository.

## Connect PixelLab to Codex

PixelLab is a hosted service, not a local game engine. Its official
[MCP integration](https://www.pixellab.ai/mcp) uses
`https://api.pixellab.ai/mcp` and a bearer token from your PixelLab account.

The repository includes `config/pixellab.codex.toml` as the shared configuration
template. Run `sh scripts/setup-pixellab.sh` to add it to `.codex/config.toml`
without changing existing settings. Codex loads project configuration only in
trusted projects; see [the official MCP guide](https://developers.openai.com/codex/mcp/).

In Bash, enter the token without writing it into shell history, then launch a
new Codex session from this repository:

```bash
read -r -s -p 'PixelLab API token: ' PIXELLAB_API_KEY
printf '\n'
export PIXELLAB_API_KEY
codex
```

For desktop or IDE clients, supply `PIXELLAB_API_KEY` in the environment of the
client process and restart it. `.env` files are not automatically loaded by this
MCP configuration. Use `/mcp` in Codex CLI to check the connection. A configured
server is not an authenticated connection until the token is available.

Never put tokens in source files, prompts, browser code, or committed config.
Generate assets during development and save them locally; the playable game
does not need PixelLab access. Account access and generation credits are managed
on PixelLab, separately from npm installation.

## Initial art direction

Aim for an original Celeste-inspired pixel-art world: clear silhouettes, cool
backgrounds, warm character accents, and readable quantum effects. Start with a
320 × 180 canvas and 16 × 16 environment tiles. Approve one character and one
room before generating more; reuse references and a shared palette.

Check animation frame sizes and alignment, transparency, palette consistency,
and tile seams. Prefer lowercase kebab-case names such as `player-idle.png`.
Keep source art in `assets/source/`, runtime exports in
`prototype/public/assets/`, and per-asset provenance and applicable usage terms
in `THIRD_PARTY.md`. No artwork is bundled yet.

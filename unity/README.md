# Unity project

This is the Unity project root. It targets Editor `6000.3.25f1` (Unity 6.3 LTS)
and starts with the Built-in Render Pipeline to keep the jam prototype lean.
The pinned packages provide modern keyboard/gamepad input, pixel-perfect camera
scaling, and extra tile brushes. Unity 2D sprites, tilemaps, and 2D physics are
available in the editor.

## Open and run

1. Install Unity Editor `6000.3.25f1` in Unity Hub.
2. In Unity Hub, choose **Add/Open project** and select this `unity/` folder.
3. Wait for the packages in `Packages/manifest.json` to resolve. Unity creates
   `Packages/packages-lock.json`; commit it after resolution.
4. Create a 2D scene and save it under `Assets/Scenes/`. Add the scene to the
   active Build Profile before making a player build.
5. Set **Project Settings > Player > Active Input Handling** to **Input System
   Package (New)** if Unity prompts for it, then restart the editor.

Use the Editor's **Play** button for local iteration and **File > Build
Profiles** for a standalone or Web build. No scene or playable game is included
yet. Unity-generated `.meta` files belong in version control; caches and local
settings are ignored by the repository.

PixelLab is configured separately through the repository's Codex MCP setup; it
does not run inside the game. See [`../docs/art-pipeline.md`](../docs/art-pipeline.md).

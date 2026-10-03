# Unity project

This is the Unity project root. It targets Editor `6000.6.4f1` (Unity 6.6)
and uses the Built-in Render Pipeline. Its four-room authoring builder creates
ordinary Unity scenes, linked prefabs, tile assets, and a Tile Palette; these are
editable project assets, not a runtime level generator. It fills missing assets
only and does not replace existing scenes or prefabs.

`Packages/manifest.json` pins the Input System, Pixel Perfect Camera, and
Tilemap Extras packages, plus Unity built-in Audio, IMGUI, Physics 2D, Text
Rendering, and Tilemap modules. Project Settings already selects the Input
System and configures a resizable, windowed 1280 × 720 game resolution; Unity
normally should not need an input-handler prompt.

## Open and run

1. Install Unity Editor `6000.6.4f1` in Unity Hub.
2. In Unity Hub, choose **Add/Open project** and select this `unity/` folder.
3. Wait for packages in `Packages/manifest.json` to resolve and for scripts to
   compile. If Unity does prompt about input handling, verify **Project Settings
   > Player > Active Input Handling** is **Input System Package (New)**, then
   restart the editor if requested.
4. On first import, the builder creates `Assets/Scenes/01-the-box.unity`, three
   editable templates, shared prefabs, tiles, and the demo palette if the first
   scene is missing. It authors rooms additively. A dirty current scene stays
   open and unsaved, and the Console tells you to open
   `Assets/Scenes/01-the-box.unity` when ready; with a clean current scene, the
   builder opens the new demo automatically.
5. Use **Quriosity > Build Demo and Level Templates** only if first-import setup
   failed or to fill missing assets/scenes. If the Console reports a missing
   demo sprite, run
   `python3 scripts/generate-demo-art.py` from the repository root, wait for
   Unity to import the PNGs, then retry the menu.
6. Open `Assets/Scenes/01-the-box.unity` and press **Play**. The builder adds
   all four scenes to Build Settings. To check saved scaffold assets, run
   **Quriosity > Verify Saved Demo Assets**; then play the route yourself.

## Controls and scale

- **Walk:** A/D or Left/Right arrows.
- **Jump:** Space (hold for a higher jump).
- **Dash:** Left/Right Shift or X. Aim with WASD or arrow keys; without an aim
  direction, dash in the direction Fleabag faces.
- **Interact:** E. **Respawn at checkpoint:** R. **Pause:** Esc.
- Gamepad input is supported through the Input System.

The camera frames the whole room at 640 × 360 pixels and 16 pixels per world
unit. Use 16 × 16 pixel terrain tiles. On Fleabag's prefab, movement, jump,
coyote-time, jump-buffer, and dash tuning lives in the **Player Controller**
Inspector; sprite arrays and the linked prefab's visuals can be edited there too.

See [`../docs/level-building.md`](../docs/level-building.md) for the palette,
collision and route guidelines. See [`../docs/art-pipeline.md`](../docs/art-pipeline.md)
for the local art and preview generators and optional PixelLab workflow. Unity
`.meta` files are versioned; generated caches and local settings are ignored.

## Windows Editor CLI

The Windows Editor can import, compile, create scenes, and verify saved assets
without a manual editor session. From the repository root in PowerShell:

```powershell
.\scripts\check-unity.ps1
# For a different installed version or a custom install location:
.\scripts\check-unity.ps1 -EditorVersion 6000.6.4f1
.\scripts\check-unity.ps1 -EditorPath "C:\Your Unity Install\Editor\Unity.exe"
```

Close this project's interactive Editor before running its batch instance.
The helper writes `unity/Logs/batch-verify.log`, creates missing assets, and runs
the same saved-asset verifier as the menu. It needs a finished Editor installation
and active Unity license; it does not substitute the Hub executable. Using a
newer Editor may migrate project settings, so keep teammates on the same version
after verifying compatibility. Successful CLI verification does not replace
playing both routes in Play Mode.

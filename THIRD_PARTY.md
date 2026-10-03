# Third-party libraries and assets

Declare every third-party library, utility, and asset used in the submission as
required by [the jam rules](about.md). Add imported art and audio when it enters
the project, retain required license notices, and give each asset's source and
applicable terms. The current demo art is original project art, not third-party
or hosted-generated art; see **Original demo art** below.

| Name and version | Kind | Source URL | License / terms | Use / attribution |
| --- | --- | --- | --- | --- |
| Unity Editor 6000.6.4f1 | Game engine and editor | https://unity.com/releases/editor/whats-new/6000.6.4f1 | [Unity terms](https://unity.com/legal/editor-terms-of-service/software) | 2D game runtime and editor |
| Unity built-in modules 1.0.0: Audio, IMGUI, Physics 2D, Physics Core 2D, Tetgen, Tilemap, Timeline Foundation | Unity modules | https://unity.com/releases/editor/whats-new/6000.6.4f1 | Included with Unity; covered by the Unity Editor terms above | Audio, editor UI, 2D physics, tilemaps, and engine support |
| Input System 1.20.0 | Unity package | https://docs.unity.com/en-us/engine/6000.6/manual/packages-list/packages-all/pack-safe/com-unity-inputsystem | See package license metadata | Keyboard and gamepad input |
| 2D Pixel Perfect 6.0.0 | Unity package | https://docs.unity.com/en-us/engine/6000.6/manual/packages-list/packages-all/pack-safe/com-unity-2d-pixel-perfect | See package license metadata | Crisp pixel-art camera scaling |
| 2D Tilemap Extras 9.0.1 | Unity package | https://docs.unity.com/en-us/engine/6000.6/manual/packages-list/packages-all/pack-safe/com-unity-2d-tilemap-extras | See package license metadata | Tile brushes and rule/animated tiles |
| Unity AI Assistant 2.20.0-pre.1 and AI Inference 2.6.1 | Unity packages | https://packages.unity.com | See package license metadata | Editor-provided AI tools; not used by gameplay |
| PixelLab | Hosted art-generation service | https://www.pixellab.ai/ | [Service terms](https://www.pixellab.ai/termsofservice) | Optional development-time MCP configuration only; no hosted assets generated or included |
| actions/checkout v4 | CI utility | https://github.com/actions/checkout | MIT | Checks out the repository in GitHub Actions |

## Original demo art

The 32 PNGs in `unity/Assets/Art/Generated/Demo/` are original, locally
generated pixel art. Their authored patterns and palette are in
`scripts/generate-demo-art.py`; the source manifest at
`unity/Assets/Art/Source/demo-art-manifest.json` records each output's path,
dimensions, and SHA-256 hash. The generator uses Python's standard library and
does not use PixelLab, third-party art, or network resources. PixelLab is listed
above only because optional development-time integration is configured in the
repository; no PixelLab-generated assets are included.

Unity package versions are pinned in `unity/Packages/manifest.json`. Unity
generates `unity/Packages/packages-lock.json` on the first project open; commit
that file after package resolution to preserve transitive versions. Record each
new external library or imported asset's creator/source and license here.

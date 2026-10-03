# Third-party libraries and assets

Declare every third-party library, utility, and asset used in the submission as
required by [the jam rules](about.md). Add imported art and audio when it enters
the project, retain required license notices, and give each asset's source and
applicable terms. No generated or third-party game art is included yet.

| Name and version | Kind | Source URL | License / terms | Use / attribution |
| --- | --- | --- | --- | --- |
| Unity Editor 6000.3.25f1 | Game engine and editor | https://unity.com/releases/editor/whats-new/6000.3.25f1 | [Unity terms](https://unity.com/legal/editor-terms-of-service/software) | 2D game runtime and editor |
| Input System 1.20.0 | Unity package | https://docs.unity.com/en-us/engine/6000.3/manual/packages-list/packages-all/pack-safe/com-unity-inputsystem | See package license metadata | Keyboard and gamepad input |
| 2D Pixel Perfect 5.1.1 | Unity package | https://docs.unity.com/en-us/engine/6000.3/manual/packages-list/packages-all/pack-safe/com-unity-2d-pixel-perfect | See package license metadata | Crisp pixel-art camera scaling |
| 2D Tilemap Extras 6.0.3 | Unity package | https://docs.unity.com/en-us/engine/6000.3/manual/packages-list/packages-all/pack-safe/com-unity-2d-tilemap-extras | See package license metadata | Tile brushes and rule/animated tiles |
| PixelLab | Hosted art-generation service | https://www.pixellab.ai/ | [Service terms](https://www.pixellab.ai/termsofservice) | Development-time MCP configuration; no assets generated yet |
| actions/checkout v4 | CI utility | https://github.com/actions/checkout | MIT | Checks out the repository in GitHub Actions |

Unity package versions are pinned in `unity/Packages/manifest.json`. Unity
generates `unity/Packages/packages-lock.json` on the first project open; commit
that file after package resolution to preserve transitive versions. Record each
imported asset's creator/source and license here.

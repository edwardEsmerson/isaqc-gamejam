# Third-party libraries and assets

Declare every third-party library, utility, and asset used in the submission,
as required by [the jam rules](about.md). Add an entry when introducing a
dependency or asset, and retain any license files required by its terms.

The starter uses the libraries below. No third-party art or audio has been
imported yet. PixelLab is a development service; record the provenance and
applicable usage terms for each generated asset when importing it.

| Name and version | Kind | Source URL | License | Use / attribution |
| --- | --- | --- | --- | --- |
| actions/checkout v4 | CI utility | https://github.com/actions/checkout | MIT | Checks out the repository for GitHub Actions |
| actions/setup-node v4 | CI utility | https://github.com/actions/setup-node | MIT | Installs Node.js and configures npm caching in GitHub Actions |
| Phaser 4.2.1 | Game framework | https://github.com/phaserjs/phaser | MIT | Browser rendering and scenes; future gameplay systems |
| eventemitter3 5.0.4 | Runtime dependency | https://github.com/primus/eventemitter3 | MIT | Phaser's event emitter |
| Vite 8.3.2 | Development/build tool | https://github.com/vitejs/vite | MIT | Local server and production bundling |
| TypeScript 7.0.2 | Language/compiler | https://github.com/microsoft/TypeScript | Apache-2.0 | Strict typechecking of game source |
| PixelLab | Hosted art-generation service | https://www.pixellab.ai/ | [Service terms](https://www.pixellab.ai/termsofservice) | MCP configuration only; no assets generated yet |

Runtime license notices are retained in `prototype/public/licenses/` and copied
into production builds. Exact transitive dependency versions are recorded in
`prototype/package-lock.json`.

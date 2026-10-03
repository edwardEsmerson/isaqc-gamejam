# Qubit FC showcase

The finalist slot is **five minutes of live gameplay followed by three minutes of technical Q&A**. The submission also requires a separate **two-minute unedited gameplay recording**. These are distinct deliverables; see [event format](../about.md).

Use Standard mode so the full globe is visible. Each six-player team has keeper, X, H, Z, S, and S†. Two controllers are preferable; both keyboard layouts work without setup. Select showcase length for two one-minute halves during the match portion. Expert mode can follow once the judge understands phase.

## Five-minute live session

| Time | Demonstration |
| --- | --- |
| 0:00–0:30 | Show the globe and net target. Arrow direction sets scoring odds; arrow length is state strength. Explain that a physical shot must beat the keeper before a measurement decides whether it counts. |
| 0:30–1:30 | Run Gate drill. Start with fresh north against a fixed south net; three pass presses follow H → Z → H. After the first H, Z changes phase without changing Z odds; the final H converts that phase change into south. Shoot to finish the drill. |
| 1:30–2:45 | Hand a controller to the judge and start a showcase match. A passes; hold and release B to shoot. Point out the receiver's projected odds in the pass preview and the random net targets. Every scored goal rerolls the targets, so check the glyph again. |
| 2:45–3:30 | Prepare an equatorial state with H, then pass S → S† to show +90° and −90° phase rotations restoring the input state. Emphasize that gate order changes later outcomes. Switch the defending keeper with Y: +Z becomes +X, or −Z becomes −X, over two seconds; it freezes in the box. |
| 3:30–4:15 | Hold the ball near a defender and show the arrow shortening and odds drifting toward 50%. A keeper back-pass restores fresh north. If a shot fails measurement, follow its rebound: it now carries the opposite target state. |
| 4:15–5:00 | Use LB for a split through-ball. Tap controller X to select a support gate and move it into a ghost lane. Show the junction's chosen output and automatic control transfer. A defender touching a ghost demonstrates path measurement. A dark intended outlet sends the ball to the alternate outlet; total probability is conserved. |

Keep the quantum explanations tied to visible actions. Gate drill guarantees an understandable HZH circuit; the match then shows the pressure, target, and spatial decisions under real play.

## Three-minute technical Q&A

Be ready to show these implementation details:

- **Single ball:** `ρ = (I + r · σ)/2`, with `P(goal) = (1 + r · n)/2`. Pressure shortens r; gate rotations preserve its length.
- **State strength:** Bloch length is a purity indicator for a single qubit. It is not interchangeable with basis-dependent off-diagonal coherence.
- **Inverse gates and order:** S is +90° about Z; S† is −90°. S → S† restores the state, and neither changes a pole. H → S and S → H produce different results from north. The ordinary Clifford roster cannot prepare an X/Z midpoint hedge from north; verified T math stays in the library without a T player.
- **Measurements:** tackles use Z; net shots use the signed current target. Rejected net measurements rebound with the opposite eigenstate. Keeper reception explicitly resets to north.
- **Spatial interference:** a joint path–ball density matrix supports conditional gates, path projection, and a two-port readout with probabilities summing to one. A single Bloch vector cannot represent both coherent paths. Conditional-H is non-Clifford on this joint system; a bright-port outcome can prepare a diagonal state before the receiver's gate.

## Separate two-minute unedited recording

Record one continuous take with the Standard globe visible; do not cut or splice the gameplay. Start in Gate drill, complete H → Z → H and attempt the south goal. Continue into a showcase match, show the net glyph and pass preview, then demonstrate S → S† restoring a prepared equatorial state. Switch the keeper, show pressure, and use a split through-ball with controller X to move a support gate into a lane. Attempt another shot so the measurement beat and either a goal or collapsed-state rebound are visible. Explain what happens as you play; a missed physical shot still shows the football rules.

Watch match provides an autonomous backup if a second player is unavailable. Gate drill provides the reliable circuit demonstration. Finish with match statistics when time permits: goals, shots, possession, alignment, rejected measurements, state lost to pressure, saves and passes.

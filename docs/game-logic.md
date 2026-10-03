# Qubit FC: implemented game logic and quantum concepts

This write-up describes the latest fetched `feat/qubit-fc` implementation at commit [`a30785d`](https://github.com/edwardEsmerson/isaqc-gamejam/tree/a30785db1523b03a510eaca013e366d46b57f52c), reviewed on 4 October 2026. That implementation is now included on `main`. The football implementation uses JavaScript, Phaser, and Vite.

## The central idea

Traditional football asks players to move into space, pass around defenders, and get a shot past the goalkeeper. Qubit FC adds a second task: prepare the ball's quantum state so it matches the defending goal's target state. Passing builds a quantum circuit. Defending can disrupt that preparation. A physically successful shot is finally resolved by a quantum measurement.

There are six players per team: a RESET goalkeeper, an X defender, H and Z midfielders, and S and S† attackers. Every completed ordinary teammate pass applies the **receiver's** gate. Dribbling, changing direction, and starting a pass do not apply that player's gate. The passing route therefore determines the operation sequence.

The split through-ball adds a spatial path qubit. Players can change the ball's state on individual lanes, defenders can measure which path it follows, and recombination determines which outlet receives the real ball.

## 1. State representation: pure states, mixed states, and the Bloch sphere

Ordinary play stores the ball's internal quantum state as a Bloch vector `r = (x, y, z)`. This represents the density matrix:

$$
\rho = \frac{I + x\sigma_x + y\sigma_y + z\sigma_z}{2}.
$$

For a pure state `|ψ⟩ = α|0⟩ + β|1⟩`, with `|α|² + |β|² = 1`, the corresponding coordinates are:

$$
x = 2\operatorname{Re}(\alpha^*\beta),\quad
y = 2\operatorname{Im}(\alpha^*\beta),\quad
z = |\alpha|^2 - |\beta|^2.
$$

The density-matrix representation also supports mixed states produced by pressure or by correlation with the path qubit during split play.

| State | Bloch vector | Meaning |
| --- | --- | --- |
| \|0⟩ | (0, 0, 1) | North; fresh state after RESET or kickoff |
| \|1⟩ | (0, 0, −1) | South |
| \|+⟩ | (1, 0, 0) | Equal Z-basis superposition with relative phase 0 |
| \|−⟩ | (−1, 0, 0) | Equal Z-basis superposition with relative phase π |
| \|+i⟩ | (0, 1, 0) | Equal Z-basis superposition with relative phase +π/2 |
| \|−i⟩ | (0, −1, 0) | Equal Z-basis superposition with relative phase −π/2 |
| Maximally mixed | (0, 0, 0) | 50% success against every target |

The sphere's arrow length is `L = √(x² + y² + z²)`. Pure states have `L = 1`; mixed states have `L < 1`. Purity is `Tr(ρ²) = (1 + L²)/2`. Arrow length is **state strength/purity**, not a universal measure of coherence: north and south are pure but have no off-diagonal coherence in the Z basis.

The sphere displays the internal quantum state. Ordinary physical ball movement uses aiming, velocity, steering, and collisions. A phase rotation does **not** automatically turn the ball's physical travel direction. During a split, the two ghost trajectories follow predefined curved paths; quantum evolution determines their interference and output selection.

## 2. Gates used and their effects on football

X, H, Z, S, and S† are reversible unitary gates. They rotate the Bloch vector and preserve its length, including for mixed inputs. RESET is an irreversible state preparation operation.

| Operation | Exact Bloch transformation | Quantum function | Game effect |
| --- | --- | --- | --- |
| **X: defender** | `(x, y, z) → (x, −y, −z)` | Bit flip; 180° rotation about x. Swaps \|0⟩ and \|1⟩. | Reverses success odds against either signed Z target. Leaves odds against either signed X target unchanged. |
| **H: midfielder** | `(x, y, z) → (z, −y, x)` | Hadamard; mixes basis amplitudes. Exchanges the X and Z directions. | Creates superposition from north/south and converts phase-sensitive X alignment into Z scoring odds. Adapts preparation to a different keeper basis. |
| **Z: midfielder** | `(x, y, z) → (−x, −y, z)` | Phase flip; 180° rotation about z. Multiplies the \|1⟩ amplitude by −1. | Leaves signed Z-target odds unchanged immediately. Reverses signed X-target odds and changes what a later H produces. |
| **S: attacker** | `(x, y, z) → (−y, x, z)` | Phase gate; +90° rotation about z. Maps `(α, β)` to `(α, iβ)`. | Leaves signed Z-target odds unchanged immediately; changes X alignment and later interference. On a split lane it can change relative path phase and outlet probabilities. |
| **S†: attacker** | `(x, y, z) → (y, −x, z)` | Inverse S; −90° rotation about z. Maps `(α, β)` to `(α, −iβ)`. | Undoes S and provides the opposite phase adjustment in ordinary and split play. |
| **RESET: goalkeeper** | Any state → `(0, 0, 1)` | Discards the previous state and prepares \|0⟩. | Applies whenever the keeper takes possession; kickoff also prepares north. Restores full state strength after pressure. |

Both S and S† leave north and south unchanged on the internal Bloch sphere. Their effect becomes visible on states with transverse components, such as `|+⟩`. The game labels pole-state phase receptions as “state unchanged.”

The original name **S\*** corresponds to **S†** here. The implemented identifiers are `S†`, `SDG`, and `Sdg`; the literal identifier `S*` is not an alias. **T**, a +45° phase rotation, remains implemented and tested in the math library, including the split model, but no current player carries T.

RESET does not guarantee a goal. A north ball has 100% quantum success against +Z, 0% against −Z, and 50% against either X target. Physical saves can prevent measurement altogether.

## 3. Superposition and gate-sequence interference

Applying H to the fresh north ball prepares:

$$
|0\rangle \xrightarrow{H} |+\rangle
= \frac{|0\rangle + |1\rangle}{\sqrt{2}}.
$$

The program keeps the quantum state until an actual measurement occurs. It does not choose a hidden goal/miss outcome when H is applied.

H combines amplitudes as:

$$
(\alpha,\beta) \xrightarrow{H}
\left(\frac{\alpha+\beta}{\sqrt{2}},\frac{\alpha-\beta}{\sqrt{2}}\right).
$$

Relative phase changes whether those sums reinforce or cancel. This is implemented by the gate transformations, rather than by adding an arbitrary probability bonus.

Starting from north, with sequences read left to right:

| Reception sequence | Result | Gameplay interpretation |
| --- | --- | --- |
| H → H | North | The second H restores the starting state. |
| H → Z → H | South | Intermediate phase changes turn the final output into the opposite pole; equivalent to X. |
| H → S | +Y | A quarter-turn of phase; 50% against all four normal goal targets. |
| S → H | +X | S leaves north unchanged, then H prepares +X. Demonstrates that gate order matters. |
| H → S → S† | +X | S† cancels S. |

There is no permanently assigned “goal basis state.” The HZH south result is certain against a south target and impossible against a north target.

The **gate drill** fixes the goal at south and guides H → Z → H receptions from a fresh north input. A wrong gate restarts the drill setup. A scored goal completes it. This turns superposition, phase, interference, and gate order into a short playable lesson.

## 4. Born-rule scoring and changing measurement bases

Each net has a unit target vector `n`. The implemented scoring probability is:

$$
P(\text{goal}) = \frac{1 + \mathbf r\cdot\mathbf n}{2}.
$$

For pure states, this equals `cos²(θ/2)`, where θ is the angle **between the ball state and the current target**.

| Net target | Measurement success probability |
| --- | --- |
| \|0⟩, +Z | `(1 + z)/2` |
| \|1⟩, −Z | `(1 − z)/2` |
| \|+⟩, +X | `(1 + x)/2` |
| \|−⟩, −X | `(1 − x)/2` |

Normal matches randomly select each net's initial target from these four states. After a scored goal, both net targets are rerolled, excluding each net's current target choice. This random target selection is a game rule; the quantum probability calculation is the Born rule.

The defending keeper can rotate the target between Z and X over two seconds while preserving its sign: +Z ↔ +X or −Z ↔ −X. During rotation the actual target is:

$$
\mathbf n = s(\sin a,0,\cos a),\qquad s\in\{+1,-1\}.
$$

The transition pauses while the ball is inside that keeper's penalty box. Consequently, phase gates can affect scoring immediately against an X target or an intermediate axis, even though they preserve Z-basis probabilities.

### Exactly when a shot is measured

1. The physical shot travels toward the net. Defenders and the goalkeeper can intercept or save it first.
2. Crossing into the goal mouth starts a half-second measurement presentation and captures the current target and probability.
3. At the midpoint, the simulation samples `random() < P(goal)`.
4. Success collapses the ball state to `+n`, counts the goal, and rerolls targets.
5. Failure collapses it to `−n` and rebounds the loose ball into play. Failure does **not** automatically reset it or give the keeper possession.

The sampled shot outcome is stochastic; the preceding unitary gate evolution is deterministic.

## 5. Defensive measurement, reset, and depolarizing noise

**Ordinary tackle/interception:** an opposing outfield player gaining possession performs a projective Z measurement. The ball becomes north with probability `(1 + z)/2`, otherwise south. Its prior transverse phase information is lost. The turnover does not also apply that defender's shirt gate.

**Keeper possession:** prepares fresh north, independent of the previous state. This also happens after a physical keeper save.

**Pressure:** nearby opponents within 138 pitch units contribute a distance-weighted pressure value. While a non-keeper carries the ball, the simulation applies:

$$
\mathbf r' = e^{-0.64\,p\,\Delta t}\mathbf r.
$$

This is a depolarizing channel: it moves the density matrix toward the maximally mixed state `I/2`. It pushes all target probabilities toward 50%, reducing both favorable and unfavorable alignment. Ordinary gates preserve the weakened length and cannot repair it. Pressure is applied to held-ball play, not continuously to the split joint state.

Measurement, RESET, and depolarization are distinct operations. Only the unitary gates can be undone by applying inverses in reverse order.

## 6. Split through-ball: spatial superposition and genuine path interference

The newest mechanic uses **two qubits**: a path qubit and the ball's internal qubit. `interference.js` stores their joint 4×4 density matrix, with complex entries in real and imaginary arrays and basis order `|path, ball⟩ = |00⟩, |01⟩, |10⟩, |11⟩`.

### Preparing two paths

The split initializes:

$$
\rho_{\text{joint}} = |+\rangle\langle+|_{\text{path}}\otimes\rho_{\text{ball}}.
$$

The two visible ghost lanes represent one ball in coherent path superposition. This is a separate state model from the ordinary ball's Bloch vector. The split has a six-second cooldown. Its intended receiver and alternate outlet are chosen from outfield teammates.

During the split, the player can cycle eligible support teammates and move them into a lane. A teammate touching a lane applies their shirt gate **conditionally on that path**, once per player per lane. The sender and the two outlets are excluded from these lane contacts; the receiving player's gate still applies on the later ordinary reception.

### Conditional gates and entanglement

A gate on lane 0 has the joint form:

$$
U = |0\rangle\langle0|\otimes U_0
+ |1\rangle\langle1|\otimes I.
$$

Lane 1 uses the corresponding opposite block. The code evolves the full state by `ρ′ = UρU†`. Different lane histories can correlate or entangle the path and internal state. The ball's displayed state is obtained by tracing out the path. Its reduced Bloch vector can shorten through entanglement even without defensive noise; the full joint evolution still preserves trace and is unitary.

### Recombination and output selection

At an intact junction, `recombine()` applies **H to the path qubit**. It computes probabilities for two output ports and their conditional internal ball states. Port 0 routes the ball toward the intended receiver; port 1 routes it toward the alternate outlet. The simulation samples one port, restores one real ball, and transfers control toward its carrier.

The two output probabilities sum to one. Destructive interference at one outlet transfers probability to the other; it does not delete the ball.

Examples before the eventual receiving gate:

| Input and lane operation | Port 0 / port 1 probability | What this teaches |
| --- | --- | --- |
| Any ball state, no lane gates | 100% / 0% | Coherent equal paths recombine at the bright port. |
| South ball, Z on only lane 1 | 0% / 100% | A relative path phase of π swaps the bright and dark ports. |
| South ball, S on only lane 1 | 50% / 50% | A relative path phase of +π/2 changes interference. |
| North ball, S on only lane 1 | 100% / 0% | S has no effect on the populated north component. |

A subtle distinction matters: Z or S on a south ball does not move its internal Bloch vector, because the change is a global phase for that isolated internal state. Applied to only **one path**, that phase becomes relative to the other path and changes interference. The joint density matrix retains this information.

### Defenders reveal which path

An opponent touching a ghost lane triggers a two-outcome path measurement. If the sampled path is the touched lane, the defender takes the ball. An outfield defender then also performs the usual internal Z turnover measurement; a keeper resets it. If the other path is selected, the touched ghost disappears and a normal pass continues from the surviving lane toward the intended receiver. The intact two-port recombination no longer occurs after this path measurement.

This implements the loss of path interference when which-path information is obtained.

### What states ordinary passing and split play can reach

The ordinary roster's X, H, Z, S, and S† gates are Clifford gates. From fresh north, unitary ordinary passing reaches only the six Pauli poles. It cannot prepare an arbitrary Bloch orientation or a pure midpoint between +X and +Z. Noise can shorten these vectors but does not create a new direction.

Split play goes further. Applying H conditionally to one lane and selecting the bright port can prepare `(x, y, z) = (1/√2, 0, 1/√2)` from north. That state gives approximately **85.36%** success against either +X or +Z. The bright-port selection itself occurs with approximately **85.36% probability** in this example. It is a conditional preparation, not a guaranteed outcome, and a later receiving gate changes the resulting state. Controlled-H is non-Clifford on the joint system, so the ordinary single-qubit Clifford restriction does not apply.

## 7. Initial idea versus implemented game

| Initial discussion | Latest implementation |
| --- | --- |
| Quantum football built around X, Z, H, RESET, S, and S\*. | Six-player teams carry exactly those roles, with S\* named S†. The earlier five-player prototype used a T striker; T is now library-only. |
| Bloch orientation could determine the ball's physical direction. | The Bloch sphere shows the internal state. Classical football movement remains controlled by aiming and physics. Gates affect scoring and, in split play, the probabilistic outlet. |
| A simple fixed goal/miss state mapping. | Four changing signed target states and a keeper-controlled measurement basis. A state's success depends on the current net target. |
| A ball in superposition whose phase affects scoring. | H-based internal superposition and amplitude interference are implemented through exact gate transformations. |
| Reversible state-vector trajectories. | Unit gates are reversible, while tackles, shots, RESET, and pressure explicitly model measurement or irreversible channels. |
| Spatial split play was absent from the earlier prototype. | A separate path qubit, controlled lane gates, joint density-matrix evolution, which-path measurement, and two-port interference are now implemented. |
| Student-friendly visual gate effects. | Live Bloch display, phase-dependent ball colour, gate labels, probability previews, ghost lanes, outlet percentages, and the HZH teaching drill expose the state changes. |
| Initial project scaffold targeted Unity. | The implemented football game uses Phaser/Vite with independent simulation and quantum modules. |

The game therefore implements **state representation, superposition, relative phase, unitary gates, gate order, reversibility, Born-rule measurement, basis dependence, collapse, mixed states, depolarizing noise, path superposition, controlled operations, entanglement, conditional states, and constructive/destructive path interference**.

It is a classical simulation of quantum mathematics. The code does not use a quantum processor, quantum field theory, teleportation, Grover search, or quantum error correction. The path and ball qubits describe two degrees of freedom of one ball, rather than two independent footballs.

## 8. Source evidence and verification

All links below point to the reviewed commit so the explanation can be checked against the actual implementation.

| Source | Implementation evidence |
| --- | --- |
| [quantum.js](https://github.com/edwardEsmerson/isaqc-gamejam/blob/a30785db1523b03a510eaca013e366d46b57f52c/src/game/quantum.js) | `freshState`, `applyGate`, `probability`, `depolarize`, and `measureZ` |
| [interference.js](https://github.com/edwardEsmerson/isaqc-gamejam/blob/a30785db1523b03a510eaca013e366d46b57f52c/src/game/interference.js) | `createJoint`, `conditionalGate`, `internalState`, `recombine`, and `measurePath` |
| [simulation.js](https://github.com/edwardEsmerson/isaqc-gamejam/blob/a30785db1523b03a510eaca013e366d46b57f52c/src/game/simulation.js) | Roster, target rerolls, keeper readings, reception gates, pressure, split contacts, shots, and rebounds |
| [main.js](https://github.com/edwardEsmerson/isaqc-gamejam/blob/a30785db1523b03a510eaca013e366d46b57f52c/src/main.js) | HZH drill setup, route progression, retries, and completion |
| [scene.js](https://github.com/edwardEsmerson/isaqc-gamejam/blob/a30785db1523b03a510eaca013e366d46b57f52c/src/game/scene.js) | Phase colour, Bloch display, gate feedback, pass previews, and split visuals |

The existing quantum, simulation, and input test files passed against this commit. Additional numerical checks confirmed bright/dark-port recombination, conditional Z and S interference, the reduced entangled state, the conditional-H midpoint example, probability normalization, and both path-measurement outcomes. These are code and numerical checks; a new browser playthrough was not performed for this documentation update.

# Qubit FC

Fast local six-a-side football, where completed passes are quantum gates and shots are measurements. Each roster has a keeper, X defender, H and Z midfielders, and S and S† attackers. A keeper reception resets the state to north. Five outfield gate players provide more passing outlets and more support for moving into a split lane.

## Visual direction

Indoor broadcast football: navy stadium `#0b1724`, deep green turf `#205a46`, alternate grass `#245f4a`, ice blue team `#81e6ff`, coral team `#ff866d`, chalk `#f4f6ef`. Barlow Condensed carries scoreboards, shirt glyphs and titles, with a plain system sans for instructions. A big wordmark sits over a living pitch on the title screen. During play, quiet broadcast panels leave the ball and player markings readable. Dashed pass previews identify a receiver and their projected scoring odds; the preview assumes that player's gate is the next gate applied.

## Ball state and goals

The ball's density matrix is `ρ = (I + r · σ) / 2`, displayed as Bloch vector r. Gates rotate r without increasing its length. Pressure applies a depolarizing channel and shortens it. Arrow length is **state strength**, or Bloch-vector length. It describes purity for a single qubit, rather than coherence in every basis: north and south are pure states with no off-diagonal coherence in the Z basis. During a split pass, the ball's reduced state can also become mixed through correlation with the path.

For a unit goal target n, scoring probability is `(1 + r · n) / 2`; pure states give `cos²(theta/2)`. Each net initially draws a random target from `|0〉` (+Z), `|1〉` (−Z), `|+〉` (+X), and `|−〉` (−X). Every scored goal rerolls the net targets with each previous target excluded. The keeper changes basis while retaining the sign: +Z ↔ +X or −Z ↔ −X. This takes two seconds and freezes when the ball enters that penalty box; the in-between glyph is the actual rotating target.

A tackle or interception measures in Z and produces a pure north or south state, destroying the previous phase. Keeper reception and kickoff reset to fresh north. A physically successful shot measures along the net target after a half-second presentation beat. A counted goal collapses to that target. A rejected shot collapses to the opposite eigenstate and rebounds into the pitch for continued play; it does not grant a fresh north state or an automatic keeper catch.

## Gates and teaching routes

S rotates about Z by **+90°**; S† applies the inverse **−90°** rotation. Both leave north and south unchanged because relative phase matters when both basis amplitudes are populated. After H prepares +X, S turns it to +Y and S† returns it to +X. S followed by S† is the identity for arbitrary pure or mixed input states. Gate order matters: from north, H → S ends at +Y, while S → H ends at +X.

The flip identity is H → Z → H = X. The gate drill begins with an outfield player carrying fresh north and a fixed south `|1〉` goal. Successive receivers are H, Z, and H; their default facing directions guide the three passes. A wrong gate restarts the drill. One measured goal completes it, before returning to the usual changing targets in normal matches.

The ordinary roster uses Clifford gates X, H, Z, S, and S†. From fresh north, ordinary gate passing reaches only the six Pauli poles; it cannot prepare a pure midpoint hedge between X and Z. T remains a verified +45° rotation in the quantum library, with no player carrying it. Standard mode shows phase; expert mode hides transverse components in the HUD, making the passing history matter.

## Split through-ball

Q / O / LB creates two ghost paths and starts a six-second cooldown. The best outfield receiver is the intended outlet; another teammate is the alternate outlet. During the split, H / J / controller X cycles through eligible support players. The human can move a selected gate player into either ghost lane. Their gates act conditionally on the path, so two visible lane histories can produce different ball states before meeting at the junction. Once a path measurement or output selection resolves the real ball, control transfers automatically to its carrier.

The quantum model uses a **path qubit ⊗ ball qubit** joint density matrix, starting from a coherent path superposition coupled to the current ball state. A lane gate has the form `|0〉〈0| ⊗ U₀ + |1〉〈1| ⊗ U₁`, with an identity on an untouched lane. This preserves the full joint state's trace. A defender touching one lane measures the path: the touched-path outcome gives that defender the ball, while the other outcome removes that ghost and leaves the other path. Revealing which path occurred removes interference between paths.

At an intact junction, a final balanced path mixing operation creates two output ports. The model calculates each port's probability from the joint density matrix and samples a port; the corresponding conditional ball state is delivered to that outlet. The two probabilities sum to one. Destructive interference at the intended receiver increases the probability of the alternate outlet, rather than deleting the ball or losing probability. Ordinary gate passes preserve ball-state strength; conditioning on a path measurement is a different quantum operation and can change the reduced ball state.

Controlled-H is non-Clifford on the combined path–ball system. From north, applying H to one lane and selecting the bright output can prepare `(x, y, z) = (1/√2, 0, 1/√2)` before the receiving gate: an 85.36% hedge against +X and +Z. This requires the specific path outcome and changes if another lane or receiving gate is applied. The ordinary-passing Clifford restriction does not apply to the full split mechanic.

## Implementation

Vite and Phaser 3, with an independent fixed-step football model and pure quantum math. Phaser renders the pitch, players, ball, camera and event feedback. DOM overlays handle title, device joining, instructions, match HUD and results. Gamepad API and keyboard drive the same two-player input contract. Audio is synthesized with Web Audio; field graphics are generated in code. Split, conditional gate, recombination, path collapse, and rebound sounds attach to simulation events and never change the simulation.

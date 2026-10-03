# Qubit FC

Fast local five-a-side football, where completed passes are quantum gates and shots are measurements. The four outfield roles carry Z (defender), H and T (midfielders), and X (striker). A keeper reception resets the state to north. Four outfield players means four gates per roster; S is supported by the math but the standard roster uses T so the H–T–H hedge is possible.

## Visual direction

Indoor broadcast football: navy stadium `#0b1724`, deep green turf `#205a46`, alternate grass `#245f4a`, ice blue team `#81e6ff`, coral team `#ff866d`, chalk `#f4f6ef`. Barlow Condensed carries scoreboards, shirt glyphs and titles, with a plain system sans for instructions. A big wordmark sits over a living pitch on the title screen. During play, quiet broadcast panels leave the ball and player markings readable.

## Model

The qubit is a Bloch vector r. Gates rotate r without increasing its length. Pressure applies a depolarizing channel and shortens it. For a goal target n, scoring probability is `(1 + r · n) / 2`; pure states give `cos²(theta/2)`. A tackle/interception measures in Z and produces a fresh north or south state. Keepers reset to north. The defending keeper can rotate the goal's measurement axis from Z to X over two seconds; rotation freezes when the ball enters that penalty box.

The flip identity is H–Z–H = X. Starting from north, H–T–H gives a hedge with x = z = 1/√2, scoring roughly 85.4% against either X or Z. The ball cannot be perfect for both axes. Phase is visible in standard mode; expert mode hides the transverse components in the HUD, making the passing history matter.

## Implementation

Vite and Phaser 3, with an independent fixed-step football model and pure quantum math. Phaser renders the pitch, players, ball, camera and event feedback. DOM overlays handle title, device joining, instructions, match HUD and results. Gamepad API and keyboard drive the same two-player input contract. Audio is synthesized with Web Audio; all field graphics are generated in code.

The split through-ball is a stretch feature and is deferred until the core game has been played and tuned. It requires a spatial superposition model beyond the single-qubit Bloch vector.

# Quantum Football: original single-qubit design

Football traditionally revolves around passing, positioning, defending, and shooting. The ball follows a physical trajectory shaped by the kick, spin, collisions, and gravity. A goal is decided when the ball crosses the goal line.

Our variation adds a quantum layer to that familiar objective: **players shape the probability of scoring by transforming the ball's qubit state.** The field becomes a place to navigate quantum states using **X, Z, H, RESET, S, and S\***. Choosing an operation and its place in a sequence becomes part of the strategy.

The quantum field is a gameplay metaphor for a simulated single-qubit system. Gates change its amplitudes and phase deterministically; a shot is resolved probabilistically through measurement. The design connects football to the jam's **Qubits & the Bloch Sphere** and **Quantum Logic Gates** tracks. The original design targeted the Qubits & the Bloch Sphere and Quantum Logic Gates challenge tracks.

**Design reference:** this page records the original fixed-goal single-qubit model. The playable game uses changing target states, mixed states, and a separate path qubit for split passes. See [implemented game logic](game-logic.md) for the current model. Here, **|1⟩ = goal**, **|0⟩ = miss**, and **S* = S†**, the inverse of S, are the original conventions.

## The ball's input state

The ball's quantum input is a normalized state vector with two complex amplitudes:

$$
|\psi\rangle = \alpha|0\rangle + \beta|1\rangle,
\qquad |\alpha|^2 + |\beta|^2 = 1.
$$

The amplitudes carry both magnitude and phase. Measuring in the computational basis resolves the shot:

$$
P(\text{goal}) = |\beta|^2,
\qquad P(\text{miss}) = |\alpha|^2.
$$

These are the Born-rule probabilities for the chosen goal/miss mapping. A 50% chance describes repeated shots prepared in the same state; a single shot produces one outcome. Measurement leaves the qubit in the state corresponding to that outcome. See [IBM Quantum's introduction to states and measurement](https://quantum.cloud.ibm.com/learning/en/courses/utility-scale-quantum-computing/bits-gates-and-circuits).

Useful input states for explaining the design are:

| State | Amplitudes (α, β) | Bloch sphere location | Chance of a goal |
| --- | --- | --- | --- |
| \|0⟩ | (1, 0) | North pole, +z | 0% |
| \|1⟩ | (0, 1) | South pole, −z | 100% |
| \|+⟩ | (1, 1)/√2 | Equator, +x | 50% |
| \|−⟩ | (1, −1)/√2 | Equator, −x | 50% |
| \|+i⟩ | (1, i)/√2 | Equator, +y | 50% |
| \|−i⟩ | (1, −i)/√2 | Equator, −y | 50% |

Here, *i* is the imaginary unit. Equal scoring probabilities can hide different relative phases, which matter when another gate mixes the amplitudes.

## The ball's motion on the Bloch sphere

The Bloch sphere represents the ball's **quantum state trajectory**. Each gate moves the state vector to a new orientation. Its coordinates describe amplitudes and phase; any movement of the ball across the football pitch is a separate visual mapping.

Ignoring an unobservable global phase, a pure qubit state can be written as:

$$
|\psi\rangle = \cos\left(\frac{\theta}{2}\right)|0\rangle
+ e^{i\phi}\sin\left(\frac{\theta}{2}\right)|1\rangle.
$$

Its Bloch coordinates and scoring probability are:

$$
(x,y,z) = (\sin\theta\cos\phi,\;\sin\theta\sin\phi,\;\cos\theta),
\qquad P(\text{goal}) = \frac{1-z}{2}.
$$

Moving toward the south pole raises the scoring probability; moving toward the north pole lowers it. Moving around the equator changes relative phase while keeping the immediate probability at 50%. The path records how gate choices transform the state. See [IBM Quantum's Bloch sphere explanation](https://quantum.cloud.ibm.com/learning/en/modules/quantum-mechanics/superposition-with-qiskit).

## The principle: reversible play

Ordinary classical AND and OR gates discard information: several input pairs produce the same output, so the output alone cannot recover the inputs. Unitary quantum gates preserve information:

$$
U^\dagger U = I.
$$

For the ideal, isolated pure qubit used in this model, X, Z, H, S, and S\* preserve normalization and the unit-length Bloch vector. The state rotates without shrinking or swelling. Their evolution is reversible until measurement or RESET intervenes. **RESET is an irreversible operation**, even though it appears alongside the gates in the game. See [IBM Quantum's circuit model](https://quantum.cloud.ibm.com/docs/en/api/qiskit/circuit).

## The mechanism: what each operation does

Each unitary takes the current amplitudes (α, β) as input. The following probabilities assume the shot is measured immediately afterward in the goal/miss basis.

| Operation | Output amplitudes | Bloch sphere action | Effect on scoring |
| --- | --- | --- | --- |
| **X — bit flip** | (β, α) | 180° rotation about x | Swaps goal and miss probabilities: P becomes 1 − P. |
| **Z — phase flip** | (α, −β) | 180° rotation about z | Leaves the immediate chance unchanged; changes relative phase for later interference. |
| **H — Hadamard** | ((α + β)/√2, (α − β)/√2) | 180° rotation about the axis halfway between +x and +z | Gives P(goal) = \|α − β\|²/2. Basis states become 50/50; other inputs can become certain goals or misses. |
| **RESET** | (1, 0), regardless of input | Returns the state to the north pole | Sets the immediate chance to 0% and discards the previous state. |
| **S — phase gate** | (α, iβ) | +90° rotation about z | Leaves the immediate chance unchanged; adds a quarter-turn of relative phase. |
| **S\* — inverse phase gate (S†)** | (α, −iβ) | −90° rotation about z | Leaves the immediate chance unchanged; reverses S's phase change. |

The gate definitions follow IBM Quantum's documentation for [X and H](https://quantum.cloud.ibm.com/learning/en/courses/utility-scale-quantum-computing/bits-gates-and-circuits), [S](https://quantum.cloud.ibm.com/docs/en/api/qiskit/qiskit.circuit.library.SGate), and [S†](https://quantum.cloud.ibm.com/docs/en/api/qiskit/qiskit.circuit.library.SdgGate); [RESET prepares |0⟩ irreversibly](https://quantum.cloud.ibm.com/docs/en/api/qiskit/circuit).

### Why phase changes matter for a goal

Z, S, and S\* can set up a later H to change the scoring odds through interference. The following examples start at |0⟩, apply operations **from left to right**, and measure only at the end. The results are calculated from the transformations above.

| Sequence | Final state | Chance of a goal |
| --- | --- | --- |
| X | \|1⟩ | 100% |
| H | \|+⟩ | 50% |
| H → H | \|0⟩ | 0% |
| H → Z → H | \|1⟩ | 100% |
| H → S → H | ((1 + i)\|0⟩ + (1 − i)\|1⟩)/2 | 50% |
| H → S → S → H | \|1⟩ | 100% |
| H → S → S\* → H | \|0⟩ | 0% |
| Any sequence → RESET | \|0⟩ | 0% |

In **H → H**, the two gates undo each other. In **H → Z → H**, the phase flip between them changes interference so that the final state becomes |1⟩. Two S operations have the same effect as Z, while S followed by S\* cancels out. This gives phase manipulation a direct role in the scoring strategy.

### Winding a sequence back

X, Z, and H are their own inverses. S and S\* undo each other. To reverse a sequence, apply each inverse **in reverse order**, like a film played backwards: a forward sequence **H → S → X** is undone by **X → S\* → H**. Measurement and RESET prevent recovery of an arbitrary earlier state from the resulting qubit alone.

## Ideas worth knowing

- **Bloch sphere coordinates:** read scoring probability from z and relative phase from the orientation around the z axis.
- **Single-qubit unitaries:** gates transform amplitudes while preserving total probability.
- **Reversibility:** recover an earlier state by reversing gate order and applying inverses.
- **State vector trajectories:** follow the ball's quantum journey through successive gate transformations.
- **Interference and measurement:** phase affects how amplitudes combine; measurement turns the prepared state into a goal or miss.

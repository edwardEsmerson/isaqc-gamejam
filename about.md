# QURIOSITY: A Quantum Game Dev Challenge (ISAQC, IIIT Hyderabad)

Turn quantum computing into an interactive game in 16 continuous hours. Quantum principles must drive the gameplay itself, not just serve as a visual theme.

## Format

- **Team:** solo or up to 4
- **Build window:** 16-hour sprint within the event (3 Oct 2026, 10:30 IST → 4 Oct 2026, 06:00 IST)
- **Stage 1 (Hackathon):** build the game. Technical evaluators then review the code and audit the playable build.
- **Stage 2 (Finalist Showcase):** 8 minutes in front of a panel: **5 min live gameplay + 3 min technical Q&A**

## Core requirement

The gameplay must have a **meaningful connection to at least one challenge track.**

## Challenge tracks

| Track | Focus |
|---|---|
| Qubits & the Bloch Sphere | State-vector navigation, rotations, geometric alignment |
| Quantum Logic Gates | Gameplay built on X, Z, H, CNOT, Toffoli |
| Quantum Interference | Constructive/destructive interference as mechanics |
| Grover's Search | Amplitude amplification for search, stealth or tracking |
| Shor's Algorithm & Period Finding | Quantum modular arithmetic, QFT-inspired patterns |
| Quantum Teleportation | State reconstruction, information routing via entanglement |
| Quantum Error Correction | Detecting/correcting bit-flip and phase-flip errors |
| Variational Quantum Eigensolver | Optimization with hybrid classical-quantum feedback |
| Quantum Phase Estimation | Signal calibration, resonance, diagnostic puzzles |
| Quantum Random Walks | Traversal in superposition across multiple paths |

## Judging

| Criterion | Weight | What's assessed |
|---|---|---|
| Quantum Mechanics Fidelity | **35%** | How accurately the game implements the quantum model, and whether QM genuinely drives gameplay |
| Game Design & Intuitiveness | 25% | Gameplay loop quality and responsiveness; how well quantum behaviour is communicated through UI, visual metaphors and level design |
| Technical Stability & Performance | 20% | Architecture, modularity, performance, frame-rate consistency, no serious bugs or bottlenecks |
| Originality & Execution | 20% | Creativity of concept, innovation in mapping the quantum concept to gameplay, visual/audio cohesion |

## Tech (open-engine policy)

- **Engines:** Unity, Godot, Unreal, WebGL/Three.js, Pygame, Bevy, or a custom engine
- **Quantum:** Qiskit, Cirq, PennyLane, or your own implementation of the math

## Code rules

- All **primary gameplay logic and project code must be written during the 16-hour window.**
- Allowed **if declared in submission docs:** third-party open-source libraries, general utility scripts, and public asset packs (audio, textures, 3D models).
- Create a **public GitHub/GitLab repo at the start** and **commit regularly and incrementally.** Bulk uploads or single-commit dumps at the deadline may trigger a disqualification audit.
- **Immediate disqualification:** plagiarism, pre-built prototypes, or presenting existing code as event work.

## Submission checklist

- [ ] Public repo with complete source code
- [ ] Descriptive README that declares all third-party libraries and assets
- [ ] Playable standalone build **or** hosted WebGL link
- [ ] 2-minute **unedited** gameplay recording showing the core quantum mechanics

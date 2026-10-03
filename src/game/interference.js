/** Two-qubit density matrices, ordered |path,internal>: |00>,|01>,|10>,|11>.
 * Complex entries live in parallel row-major Float64Arrays. This retains both
 * mixed internal states and entanglement created by a gate on only one lane.
 */
const clamp = value => Math.max(0, Math.min(1, value));
const matrix = () => ({ re: new Float64Array(16), im: new Float64Array(16) });

function evolve(density, unitary) {
  const intermediate = matrix(), result = matrix();
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    const out = row * 4 + column;
    for (let k = 0; k < 4; k++) {
      const a = row * 4 + k, b = k * 4 + column;
      intermediate.re[out] += unitary.re[a] * density.re[b] - unitary.im[a] * density.im[b];
      intermediate.im[out] += unitary.re[a] * density.im[b] + unitary.im[a] * density.re[b];
    }
  }
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    const out = row * 4 + column;
    for (let k = 0; k < 4; k++) {
      const a = row * 4 + k, b = column * 4 + k;
      result.re[out] += intermediate.re[a] * unitary.re[b] + intermediate.im[a] * unitary.im[b];
      result.im[out] += intermediate.im[a] * unitary.re[b] - intermediate.re[a] * unitary.im[b];
    }
  }
  return result;
}

function gateEntries(gate) {
  const c = Math.SQRT1_2;
  switch (gate) {
    case 'X': return { re: [0, 1, 1, 0], im: [0, 0, 0, 0] };
    case 'Z': return { re: [1, 0, 0, -1], im: [0, 0, 0, 0] };
    case 'H': return { re: [c, c, c, -c], im: [0, 0, 0, 0] };
    case 'S': return { re: [1, 0, 0, 0], im: [0, 0, 0, 1] };
    case 'S†':
    case 'SDG':
    case 'Sdg': return { re: [1, 0, 0, 0], im: [0, 0, 0, -1] };
    case 'T': return { re: [1, 0, 0, c], im: [0, 0, 0, c] };
    default: return { re: [1, 0, 0, 1], im: [0, 0, 0, 0] };
  }
}

export function createJoint(state) {
  const joint = matrix();
  const internalRe = [(1 + state.z) / 2, state.x / 2, state.x / 2, (1 - state.z) / 2];
  const internalIm = [0, -state.y / 2, state.y / 2, 0];
  // |+><+| on path tensor the full internal density matrix.
  for (let pathRow = 0; pathRow < 2; pathRow++) for (let pathColumn = 0; pathColumn < 2; pathColumn++) {
    for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
      const index = (pathRow * 2 + row) * 4 + pathColumn * 2 + column;
      joint.re[index] = internalRe[row * 2 + column] / 2;
      joint.im[index] = internalIm[row * 2 + column] / 2;
    }
  }
  return joint;
}

/** Controlled-U: the shirt gate acts on internal only in the contacted lane. */
export function conditionalGate(joint, gate, lane) {
  const unitary = matrix(), entries = gateEntries(gate);
  for (let path = 0; path < 2; path++) for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
    const index = (path * 2 + row) * 4 + path * 2 + column;
    if (path === lane) {
      unitary.re[index] = entries.re[row * 2 + column];
      unitary.im[index] = entries.im[row * 2 + column];
    } else if (row === column) unitary.re[index] = 1;
  }
  return evolve(joint, unitary);
}

export function pathProbabilities(joint) {
  const first = Math.max(0, joint.re[0] + joint.re[5]);
  const second = Math.max(0, joint.re[10] + joint.re[15]);
  const total = first + second;
  return total > 1e-12 ? [first / total, second / total] : [0.5, 0.5];
}

function blockState(joint, path) {
  const offset = path * 2;
  const a = offset * 4 + offset, d = (offset + 1) * 4 + offset + 1;
  const trace = joint.re[a] + joint.re[d];
  if (trace < 1e-12) return { x: 0, y: 0, z: 0 };
  const off = offset * 4 + offset + 1;
  return { x: 2 * joint.re[off] / trace, y: -2 * joint.im[off] / trace, z: (joint.re[a] - joint.re[d]) / trace };
}

/** Reduced internal state. Entanglement can shorten it even without noise. */
export function internalState(joint) {
  const trace = joint.re[0] + joint.re[5] + joint.re[10] + joint.re[15];
  if (trace < 1e-12) return { x: 0, y: 0, z: 0 };
  return {
    x: 2 * (joint.re[1] + joint.re[11]) / trace,
    y: -2 * (joint.im[1] + joint.im[11]) / trace,
    z: (joint.re[0] + joint.re[10] - joint.re[5] - joint.re[15]) / trace,
  };
}

/** Balanced recombiner H on path. Cancellation at one port feeds the other. */
export function recombine(joint) {
  const unitary = matrix();
  for (let pathRow = 0; pathRow < 2; pathRow++) for (let pathColumn = 0; pathColumn < 2; pathColumn++) {
    for (let internal = 0; internal < 2; internal++) {
      unitary.re[(pathRow * 2 + internal) * 4 + pathColumn * 2 + internal] = (pathRow && pathColumn ? -1 : 1) * Math.SQRT1_2;
    }
  }
  const output = evolve(joint, unitary);
  const probabilities = pathProbabilities(output);
  return { probabilities, states: [blockState(output, 0), blockState(output, 1)], joint: output };
}

/** Contact is a two-outcome path measurement. Return the conditioned internal state. */
export function measurePath(joint, touchedLane, random = Math.random) {
  const probabilities = pathProbabilities(joint);
  const caught = random() < clamp(probabilities[touchedLane]);
  const path = caught ? touchedLane : 1 - touchedLane;
  return { caught, path, probability: probabilities[touchedLane], state: blockState(joint, path) };
}

export function relativePathPhase(joint) {
  // Partial trace over internal: phase of rho_10 is the lane-1 minus lane-0 phase.
  return Math.atan2(joint.im[8] + joint.im[13], joint.re[8] + joint.re[13]);
}

/** Pure qubit operations in the Bloch representation. Mixed states are allowed. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function freshState() {
  return { x: 0, y: 0, z: 1 };
}

export function stateLength(state) {
  return Math.hypot(state.x, state.y, state.z);
}

export function lockAxis(basis = 'Z') {
  if (basis === 'X') return { x: 1, y: 0, z: 0 };
  if (basis === 'Y') return { x: 0, y: 1, z: 0 };
  return { x: 0, y: 0, z: 1 };
}

/** Rotations preserve the Bloch vector's length: gates cannot repair decoherence. */
export function applyGate(state, gate) {
  const { x, y, z } = state;
  switch (gate) {
    case 'X': return { x, y: -y, z: -z };
    case 'H': return { x: z, y: -y, z: x };
    case 'Z': return { x: -x, y: -y, z };
    case 'S': return { x: -y, y: x, z };
    case 'S†':
    case 'SDG':
    case 'Sdg': return { x: y, y: -x, z };
    case 'T': {
      const c = Math.SQRT1_2;
      return { x: c * (x - y), y: c * (x + y), z };
    }
    case 'RESET': return freshState();
    default: return { x, y, z };
  }
}

/** Born probability for the positive outcome along a unit measurement axis. */
export function probability(state, basisOrVector = 'Z') {
  const axis = typeof basisOrVector === 'string' ? lockAxis(basisOrVector) : basisOrVector;
  const length = Math.hypot(axis.x, axis.y, axis.z);
  if (!length) return 0.5;
  const dot = (state.x * axis.x + state.y * axis.y + state.z * axis.z) / length;
  return clamp((1 + dot) / 2, 0, 1);
}

/** amount is the fraction lost, so repeated pressure compounds continuously. */
export function depolarize(state, amount) {
  const factor = 1 - clamp(amount, 0, 1);
  return { x: state.x * factor, y: state.y * factor, z: state.z * factor };
}

/** A projective Z measurement destroys phase and restores a pure outcome. */
export function measureZ(state, random = Math.random) {
  return { x: 0, y: 0, z: random() < probability(state, 'Z') ? 1 : -1 };
}

export function measureAlong(state, axis, random = Math.random) {
  const length = Math.hypot(axis.x, axis.y, axis.z) || 1;
  const sign = random() < probability(state, axis) ? 1 : -1;
  return { x: sign * axis.x / length, y: sign * axis.y / length, z: sign * axis.z / length };
}

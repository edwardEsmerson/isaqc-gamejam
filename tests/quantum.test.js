import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGate, depolarize, freshState, measureZ, probability, stateLength } from '../src/game/quantum.js';
import { conditionalGate, createJoint, internalState, recombine, relativePathPhase } from '../src/game/interference.js';

const near = (actual, expected, epsilon = 1e-10) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} should be ${expected}`);
const circuit = (state, gates) => gates.reduce((current, gate) => applyGate(current, gate), state);

test('H-Z-H is an X flip for arbitrary pure and mixed input states', () => {
  for (const state of [freshState(), { x: 0, y: 0, z: -1 }, { x: 0.3, y: -0.4, z: 0.5 }]) {
    const actual = circuit(state, ['H', 'Z', 'H']);
    const expected = applyGate(state, 'X');
    for (const axis of ['x', 'y', 'z']) near(actual[axis], expected[axis]);
  }
  near(probability(circuit(freshState(), ['H', 'Z', 'H']), 'Z'), 0);
});

test('phase has no direct Z odds but H converts it into observable odds', () => {
  const plus = applyGate(freshState(), 'H');
  const minus = applyGate(plus, 'Z');
  near(probability(plus), 0.5);
  near(probability(minus), 0.5);
  near(probability(applyGate(plus, 'H')), 1);
  near(probability(applyGate(minus, 'H')), 0);
});

test('T-based circuits distinguish a Z-only advantage from a genuine X/Z hedge', () => {
  const tuned = circuit(freshState(), ['H', 'T', 'H']);
  near(probability(tuned), (1 + Math.SQRT1_2) / 2);
  near(probability(tuned, 'X'), 0.5);
  const hedge = circuit(freshState(), ['H', 'T', 'H', 'T', 'Z', 'T', 'Z']);
  near(hedge.x, Math.SQRT1_2);
  near(hedge.y, 0);
  near(hedge.z, Math.SQRT1_2);
  near(probability(hedge, 'Z'), 0.8535533905932737);
  near(probability(hedge, 'X'), 0.8535533905932737);
  near(probability(freshState(), 'X'), 0.5);
});

test('T rotates transverse state by positive pi/4 and preserves both poles', () => {
  assert.deepEqual(applyGate({ x: 0, y: 0, z: 1 }, 'T'), { x: 0, y: 0, z: 1 });
  assert.deepEqual(applyGate({ x: 0, y: 0, z: -1 }, 'T'), { x: 0, y: 0, z: -1 });
  const rotated = applyGate({ x: 1, y: 0, z: 0 }, 'T');
  near(rotated.x, Math.SQRT1_2); near(rotated.y, Math.SQRT1_2); near(rotated.z, 0);
  near(Math.atan2(rotated.y, rotated.x), Math.PI / 4);
  near(stateLength(rotated), 1);
  const quarterTurn = circuit({ x: 1, y: 0, z: 0 }, ['T', 'T']);
  near(quarterTurn.x, 0); near(quarterTurn.y, 1);
  const phaseToOdds = circuit(freshState(), ['H', 'T', 'H']);
  near(phaseToOdds.z, Math.SQRT1_2);
});

test('a conditional T changes path interference on south while preserving its internal pole', () => {
  const north = conditionalGate(createJoint({ x: 0, y: 0, z: 1 }), 'T', 1);
  near(recombine(north).probabilities[0], 1);
  const south = conditionalGate(createJoint({ x: 0, y: 0, z: -1 }), 'T', 1);
  const ports = recombine(south);
  near(ports.probabilities[0], (1 + Math.SQRT1_2) / 2);
  near(ports.probabilities[1], (1 - Math.SQRT1_2) / 2);
  near(ports.probabilities[0] + ports.probabilities[1], 1);
  near(internalState(south).z, -1);
  for (const state of ports.states) near(state.z, -1);
});

test('S dagger reverses S and contributes the opposite conditional lane phase', () => {
  const state = { x: 0.3, y: -0.4, z: 0.5 };
  const recovered = circuit(state, ['S', 'S†']);
  for (const axis of ['x', 'y', 'z']) near(recovered[axis], state[axis]);
  const turned = applyGate({ x: 1, y: 0, z: 0 }, 'S†');
  near(turned.x, 0); near(turned.y, -1); near(turned.z, 0);
  const south = createJoint({ x: 0, y: 0, z: -1 });
  near(relativePathPhase(conditionalGate(south, 'S', 1)), Math.PI / 2);
  near(relativePathPhase(conditionalGate(south, 'S†', 1)), -Math.PI / 2);
});

test('gate sequences conserve mixed-state strength and pressure only decreases it', () => {
  const before = { x: 0.3, y: 0.4, z: 0 };
  const weakened = depolarize(before, 0.6);
  near(stateLength(weakened), 0.2);
  near(stateLength(circuit(weakened, ['T', 'S', 'H', 'Z', 'X', 'H'])), 0.2);
  for (const basis of ['X', 'Y', 'Z']) near(probability(depolarize(before, 1), basis), 0.5);
  assert.deepEqual(before, { x: 0.3, y: 0.4, z: 0 }, 'operations do not mutate their inputs');
});

test('projective tackles destroy phase and sample the correct Z marginal', () => {
  const state = { x: 0.8, y: 0, z: 0.6 };
  assert.deepEqual(measureZ(state, () => 0.79), { x: 0, y: 0, z: 1 });
  assert.deepEqual(measureZ(state, () => 0.81), { x: 0, y: 0, z: -1 });
  near(probability(freshState(), 'Z'), 1);
  near(probability(applyGate(freshState(), 'X'), 'Z'), 0);
});

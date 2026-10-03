import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, PITCH, TEAM_SIZE } from '../src/game/simulation.js';
import { stateLength } from '../src/game/quantum.js';

function advance(match, seconds, inputs = []) {
  const steps = Math.ceil(seconds * 120);
  for (let i = 0; i < steps; i++) match.update(seconds / steps, inputs);
}

function isolatedMatch(state = { x: 0, y: 0, z: 1 }) {
  const match = new Match({ random: () => 0.99 });
  match.locks.forEach(lock => { lock.basis = 'Z'; lock.sign = 1; lock.target = null; lock.progress = 0; });
  match.phase = 'play';
  match.players.forEach((player, i) => {
    player.x = 1100 + (i % 4) * 70;
    player.y = 750 + Math.floor(i / 4) * 65;
    player.vx = 0; player.vy = 0;
  });
  const carrier = match.player(4);
  carrier.x = 500; carrier.y = 400; carrier.fx = 1; carrier.fy = 0;
  match.ball.x = 529; match.ball.y = 400; match.ball.state = { ...state };
  match.ball.owner = 4;
  match.controlled = [4, TEAM_SIZE + 1];
  match.drainEvents();
  return match;
}

test('dribbling and changing direction never apply a shirt gate', () => {
  const match = isolatedMatch();
  advance(match, 0.4, [{ x: 0.6, y: -0.8 }, {}]);
  assert.ok(match.player(4).y < 350);
  assert.deepEqual(match.ball.state, { x: 0, y: 0, z: 1 });
  assert.equal(match.gatesHistory.length, 0);
  assert.equal(match.drainEvents().filter(e => e.type === 'gate').length, 0);
});

test('a completed teammate pass applies one gate and a return pass applies the receiver gate', () => {
  const match = isolatedMatch();
  const receiver = match.player(2);
  receiver.x = 760; receiver.y = 400;
  assert.equal(match.bestPass(match.player(4)).id, receiver.id);
  match.update(1 / 120, [{ pass: true }, {}]);
  assert.equal(match.controlled[0], receiver.id, 'control follows the pass immediately');
  advance(match, 0.5);
  assert.equal(match.ball.owner, receiver.id);
  assert.deepEqual(match.gatesHistory, ['H']);
  assert.equal(match.ball.state.x, 1);
  const returnTarget = match.player(4);
  returnTarget.x = 530; returnTarget.y = 400; returnTarget.vx = 0; returnTarget.vy = 0;
  receiver.fx = -1; receiver.fy = 0;
  assert.equal(match.bestPass(receiver).id, returnTarget.id);
  match.update(1 / 120, [{ pass: true }, {}]);
  advance(match, 0.5);
  assert.equal(match.ball.owner, returnTarget.id);
  assert.deepEqual(match.gatesHistory, ['H', 'S']);
  assert.ok(Math.abs(match.ball.state.x) < 1e-9);
  assert.ok(Math.abs(match.ball.state.y - 1) < 1e-9);
});

test('pressure loses strength, and a subsequent gate reception cannot restore it', () => {
  const match = isolatedMatch({ x: 0.6, y: 0.8, z: 0 });
  const defender = match.player(TEAM_SIZE + 1);
  defender.x = 590; defender.y = 400;
  advance(match, 0.35);
  const weakened = stateLength(match.ball.state);
  assert.ok(weakened < 0.96 && weakened > 0.75);
  assert.ok(match.stats[0].stateLost > 0.04);
  defender.x = 1370; defender.y = 860;
  const receiver = match.player(2);
  receiver.x = 760; receiver.y = 400;
  match.update(1 / 120, [{ pass: true }, {}]);
  advance(match, 0.5);
  assert.equal(match.ball.owner, receiver.id);
  assert.ok(Math.abs(stateLength(match.ball.state) - weakened) < 1e-9);
});

test('a back-pass to the keeper resets even a maximally mixed ball', () => {
  const match = isolatedMatch({ x: 0, y: 0, z: 0 });
  const keeper = match.player(0);
  keeper.x = 740; keeper.y = 400;
  assert.equal(match.bestPass(match.player(4)).id, keeper.id);
  match.update(1 / 120, [{ pass: true }, {}]);
  advance(match, 0.5);
  assert.equal(match.ball.owner, keeper.id);
  assert.deepEqual(match.ball.state, { x: 0, y: 0, z: 1 });
  assert.ok(match.drainEvents().some(e => e.type === 'reset' && e.reason === 'keeper'));
});

test('a defender intercepts before the receiver and wipes the original phase', () => {
  const match = isolatedMatch({ x: 0.6, y: 0.8, z: 0 });
  const defender = match.player(TEAM_SIZE + 1);
  defender.x = 650; defender.y = 400;
  const receiver = match.player(2);
  receiver.x = 900; receiver.y = 400;
  match.update(1 / 120, [{ pass: true }, {}]);
  for (let i = 0; i < 60 && match.ball.owner === null; i++) match.update(1 / 120);
  assert.equal(match.ball.owner, defender.id);
  assert.deepEqual(match.ball.state, { x: 0, y: 0, z: -1 });
  assert.deepEqual(match.gatesHistory, []);
  assert.ok(match.drainEvents().some(e => e.type === 'tackle' && e.interception));
});

test('a pressured back-pass leaves from the correct foot and escapes a front marker', () => {
  const match = isolatedMatch();
  const defender = match.player(TEAM_SIZE + 1);
  defender.x = 550; defender.y = 400;
  const receiver = match.player(2);
  receiver.x = 270; receiver.y = 400;
  const passer = match.player(4);
  passer.fx = -1;
  // The held ball was on the old front foot before the passer changed direction.
  match.ball.x = 529; match.ball.y = 400;
  match.update(1 / 120, [{ pass: true }, {}]);
  assert.ok(match.ball.x < passer.x);
  advance(match, 0.5);
  assert.equal(match.ball.owner, receiver.id);
  assert.deepEqual(match.gatesHistory, ['H']);
});

test('reading takes two seconds, freezes in the box, and preserves a valid measurement axis', () => {
  const match = isolatedMatch();
  match.update(1 / 120, [{}, { reading: true }]);
  advance(match, 0.8);
  const progress = match.locks[1].progress;
  assert.ok(progress > 0.39 && progress < 0.42);
  const carrier = match.player(4);
  carrier.x = PITCH.right - 150; carrier.y = PITCH.cy;
  advance(match, 0.5);
  assert.equal(match.locks[1].frozen, true);
  assert.ok(Math.abs(match.locks[1].progress - progress) < 0.01);
  const axis = match.lockVector(1);
  assert.ok(Math.abs(stateLength(axis) - 1) < 1e-10);
  carrier.x = 500; carrier.y = 400;
  advance(match, 1.4);
  assert.equal(match.locks[1].basis, 'X');
  assert.equal(match.locks[1].target, null);
  assert.equal(match.shotChance(0), 0.5);
});

function clearGoalAttempt(state, random) {
  const match = isolatedMatch(state);
  match.random = random;
  const shooter = match.player(4);
  shooter.x = 1260; shooter.y = PITCH.cy - 80; shooter.fx = 1; shooter.fy = 0;
  // The keeper has been beaten: place it far enough from the shot lane.
  const keeper = match.keeper(1);
  keeper.x = 1430; keeper.y = PITCH.cy + 100;
  keeper.vx = 0; keeper.vy = 0;
  match.ball.x = shooter.x + 29; match.ball.y = shooter.y;
  match.update(1 / 120, [{ shootReleased: true }, {}]);
  return match;
}

test('a physically successful shot gets a half-second Born measurement, then a conceding-team kickoff', () => {
  const match = clearGoalAttempt({ x: 0, y: 0, z: 1 }, () => 0.5);
  advance(match, 0.3);
  assert.equal(match.phase, 'measurement');
  assert.equal(match.measurement.probability, 1);
  advance(match, 0.55);
  assert.equal(match.phase, 'goal');
  assert.deepEqual(match.score, [1, 0]);
  assert.equal(match.stats[0].shots, 1);
  advance(match, 2.5);
  assert.equal(match.phase, 'kickoff');
  assert.equal(match.ball.lastTeam, 1);
  assert.equal(match.ball.owner, TEAM_SIZE + 4);
  assert.deepEqual(match.ball.state, { x: 0, y: 0, z: 1 });
});

test('a perfectly opposite shot fails measurement and rebounds in the measured negative state', () => {
  const match = clearGoalAttempt({ x: 0, y: 0, z: -1 }, () => 0.5);
  for (let i = 0; i < 120 && !match.drainEvents().some(event => event.type === 'rebound'); i++) match.update(1 / 120);
  assert.deepEqual(match.score, [0, 0]);
  assert.equal(match.stats[0].failedMeasurements, 1);
  assert.equal(match.ball.mode, 'loose');
  assert.equal(match.ball.owner, null);
  assert.deepEqual(match.ball.state, { x: 0, y: 0, z: -1 });
  assert.ok(match.ball.vx < 0);
});

test('a shot already in flight at the whistle finishes measurement before halftime', () => {
  const match = clearGoalAttempt({ x: 0, y: 0, z: 1 }, () => 0.5);
  match.duration = 1;
  match.time = 0.94;
  advance(match, 0.8);
  assert.equal(match.phase, 'goal');
  assert.deepEqual(match.score, [1, 0]);
  advance(match, 2.5);
  assert.equal(match.phase, 'halftime');
  assert.equal(match.time, 1);
});

test('a goalkeeper physical save occurs before quantum measurement', () => {
  const match = isolatedMatch();
  const shooter = match.player(4);
  shooter.x = 1150; shooter.y = PITCH.cy;
  match.keeper(1).x = 1448; match.keeper(1).y = PITCH.cy;
  match.ball.x = shooter.x + 29; match.ball.y = shooter.y;
  match.update(1 / 120, [{ shootReleased: true }, {}]);
  advance(match, 0.5);
  assert.equal(match.stats[1].saves, 1);
  assert.equal(match.measurement, null);
  assert.deepEqual(match.score, [0, 0]);
  assert.equal(match.ball.owner, match.keeper(1).id);
});

test('halftime pauses, swaps ends, and full-time closes the second half', () => {
  const match = new Match({ halfDuration: 1 });
  advance(match, 2.5);
  assert.equal(match.phase, 'halftime');
  const firstDirection = match.attackDirection(0);
  advance(match, 3);
  assert.equal(match.phase, 'halftime');
  assert.equal(match.time, 1);
  assert.equal(match.continueHalf(), true);
  assert.equal(match.half, 2);
  assert.equal(match.attackDirection(0), -firstDirection);
  assert.equal(match.ball.lastTeam, 1);
  advance(match, 2.5);
  assert.equal(match.phase, 'fulltime');
  assert.equal(match.continueHalf(), false);
});

test('unowned balls bounce from boards rather than leaving play', () => {
  const match = isolatedMatch();
  match.ball.owner = null; match.ball.mode = 'loose';
  match.ball.x = 700; match.ball.y = PITCH.top + 12;
  match.ball.vx = 0; match.ball.vy = -800;
  match.update(1 / 60);
  assert.ok(match.ball.y >= PITCH.top);
  assert.ok(match.ball.vy > 0);
  assert.equal(match.phase, 'play');
});

test('a seeded AI showcase completes with passing circuits, measurement, and pressure', () => {
  let seed = 293;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const match = new Match({ halfDuration: 60, aiTeams: [0, 1], random });
  const counts = {};
  for (let frame = 0; frame < 15000 && match.phase !== 'fulltime'; frame++) {
    match.update(1 / 60);
    for (const event of match.drainEvents()) counts[event.type] = (counts[event.type] || 0) + 1;
    if (match.phase === 'halftime') match.continueHalf();
    for (const player of match.players) assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y));
    assert.ok(stateLength(match.ball.state) <= 1.0000001);
  }
  assert.equal(match.phase, 'fulltime');
  assert.ok(counts.gate > 10);
  assert.ok(counts.measure > 0);
  assert.ok(counts.pressure > 0);
  assert.ok(counts.goal > 0);
});

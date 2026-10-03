import test from 'node:test';
import assert from 'node:assert/strict';
import { InputManager } from '../src/input.js';

// Simulate browser boundaries only: events, animation frames, and controller hardware.
function browser(t) {
  const originals = new Map(['window', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const listeners = new Map();
  const frames = new Map();
  const pads = [];
  let frameId = 0;
  let polls = 0;
  const dispatch = (type, properties = {}) => {
    const event = { type, ...properties, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (const listener of listeners.get(type) || []) listener(event);
    return event;
  };
  const fakeWindow = {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { getGamepads() { polls++; return pads; } },
  });
  const input = new InputManager();
  t.after(() => {
    input.destroy();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    input,
    keyDown: (code, repeat = false) => dispatch('keydown', { code, repeat }),
    keyUp: code => dispatch('keyup', { code }),
    blur: () => dispatch('blur'),
    frame() {
      const callbacks = Array.from(frames.values());
      frames.clear();
      for (const callback of callbacks) callback(frameId * 16.67);
    },
    connect(index) {
      const pad = {
        index, id: `Test controller ${index}`, connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      pads[index] = pad;
      return pad;
    },
    disconnect(index) {
      const pad = pads[index];
      pad.connected = false;
      pads[index] = null;
      dispatch('gamepaddisconnected', { gamepad: pad });
    },
    button(pad, index, pressed) {
      pad.buttons[index] = { pressed, value: pressed ? 1 : 0 };
    },
    get polls() { return polls; },
  };
}

test('two keyboard players move independently and diagonal speed stays bounded', t => {
  const rig = browser(t);
  rig.keyDown('KeyW');
  rig.keyDown('KeyA');
  rig.keyDown('ArrowRight');
  rig.keyDown('ArrowDown');
  rig.frame();
  const [first, second] = rig.input.sample();
  assert.ok(first.x < 0 && first.y < 0);
  assert.ok(second.x > 0 && second.y > 0);
  assert.ok(Math.abs(Math.hypot(first.x, first.y) - 1) < 1e-9);
  assert.ok(Math.abs(Math.hypot(second.x, second.y) - 1) < 1e-9);

  rig.keyUp('KeyW');
  rig.keyUp('KeyA');
  rig.frame();
  const afterRelease = rig.input.sample();
  assert.equal(afterRelease[0].x, 0);
  assert.equal(afterRelease[0].y, 0);
  assert.ok(afterRelease[1].x > 0 && afterRelease[1].y > 0);
});

test('a held keyboard shot releases once, and one player never releases the other shot', t => {
  const rig = browser(t);
  rig.keyDown('KeyG');
  rig.keyDown('KeyL');
  rig.frame();
  assert.deepEqual(rig.input.sample().map(player => player.shoot), [true, true]);
  rig.frame();
  assert.deepEqual(rig.input.sample().map(player => player.shootReleased), [false, false]);

  rig.keyUp('KeyG');
  rig.frame();
  const released = rig.input.sample();
  assert.equal(released[0].shootReleased, true);
  assert.equal(released[0].shoot, false);
  assert.equal(released[1].shoot, true);
  assert.equal(released[1].shootReleased, false);
  assert.equal(rig.input.sample()[0].shootReleased, false);
  rig.frame();
  assert.equal(rig.input.sample()[0].shootReleased, false);

  rig.keyUp('KeyL');
  rig.frame();
  assert.deepEqual(rig.input.sample().map(player => player.shootReleased), [false, true]);
});

test('controllers are claimed exclusively and reconnecting cannot steal a team', t => {
  const rig = browser(t);
  const first = rig.connect(4);
  const second = rig.connect(9);
  first.axes = [1, 0];
  second.axes = [0, -1];
  rig.frame();
  assert.deepEqual(rig.input.getGamepads().map(pad => pad.index), [4, 9]);
  assert.equal(rig.input.assignPad(0, 4), true);
  assert.equal(rig.input.assignPad(1, 4), false);
  assert.equal(rig.input.assignPad(1, 9), true);
  assert.equal(rig.input.assignPad(0, 1), false);
  assert.deepEqual(rig.input.assignedPads, [4, 9]);
  let sample = rig.input.sample();
  assert.equal(sample[0].x, 1);
  assert.equal(sample[1].y, -1);

  rig.disconnect(4);
  rig.frame();
  assert.deepEqual(rig.input.assignedPads, [null, 9]);
  sample = rig.input.sample();
  assert.equal(sample[0].x, 0);
  assert.equal(sample[1].y, -1);
  const reconnected = rig.connect(4);
  reconnected.axes = [-1, 0];
  rig.frame();
  assert.deepEqual(rig.input.assignedPads, [null, 9]);
  assert.equal(rig.input.sample()[0].x, 0, 'a reconnected pad needs a new claim');
  assert.equal(rig.input.assignPad(0, 4), true);
  rig.frame();
  assert.equal(rig.input.sample()[0].x, -1);
});

test('held keyboard actions need release after a modal and cannot create a phantom shot', t => {
  const rig = browser(t);
  rig.input.setActive(true);
  for (const key of ['KeyF', 'KeyG', 'KeyH', 'KeyR']) rig.keyDown(key);
  rig.frame();
  const before = rig.input.sample()[0];
  assert.ok(before.pass && before.shoot && before.switch && before.reading);
  rig.input.setActive(false);
  rig.input.setActive(true);
  rig.frame();
  const heldAfterModal = rig.input.sample()[0];
  for (const action of ['pass', 'shoot', 'shootReleased', 'switch', 'reading']) assert.equal(heldAfterModal[action], false);

  for (const key of ['KeyF', 'KeyG', 'KeyH', 'KeyR']) rig.keyUp(key);
  rig.frame();
  assert.equal(rig.input.sample()[0].shootReleased, false);
  for (const key of ['KeyF', 'KeyG', 'KeyH', 'KeyR']) rig.keyDown(key);
  rig.frame();
  const afterRelease = rig.input.sample()[0];
  assert.ok(afterRelease.pass && afterRelease.shoot && afterRelease.switch && afterRelease.reading);
});

test('joining with held controller buttons does not pass, shoot, or switch keeper reading', t => {
  const rig = browser(t);
  const pad = rig.connect(2);
  for (const index of [0, 1, 2, 3]) rig.button(pad, index, true);
  rig.frame();
  assert.deepEqual(rig.input.consumeJoinEvents(), [{ index: 2, id: pad.id }]);
  assert.equal(rig.input.assignPad(0, 2), true);
  rig.frame();
  const held = rig.input.sample()[0];
  for (const action of ['pass', 'shoot', 'shootReleased', 'switch', 'reading']) assert.equal(held[action], false);
  for (const index of [0, 1, 2, 3]) rig.button(pad, index, false);
  rig.frame();
  assert.equal(rig.input.sample()[0].shootReleased, false);
  for (const index of [0, 1, 2, 3]) rig.button(pad, index, true);
  rig.frame();
  const freshPress = rig.input.sample()[0];
  assert.ok(freshPress.pass && freshPress.shoot && freshPress.switch && freshPress.reading);
  rig.input.clear();
  rig.frame();
  assert.equal(rig.input.sample()[0].shoot, false, 'clear also suppresses already claimed held buttons');
});

test('A joins and Start pauses on edges, with each global action consumed once', t => {
  const rig = browser(t);
  const pad = rig.connect(7);
  rig.frame();
  rig.input.consumeGlobalActions();
  rig.button(pad, 0, true);
  rig.button(pad, 9, true);
  rig.frame();
  assert.deepEqual(rig.input.consumeJoinEvents(), [{ index: 7, id: pad.id }]);
  assert.deepEqual(rig.input.consumeJoinEvents(), []);
  assert.equal(rig.input.consumeGlobalActions().pause, true);
  assert.deepEqual(rig.input.consumeGlobalActions(), { pause: false, confirm: false });
  rig.frame();
  assert.deepEqual(rig.input.consumeJoinEvents(), []);
  assert.equal(rig.input.consumeGlobalActions().pause, false);

  assert.equal(rig.input.assignPad(0, 7), true);
  rig.button(pad, 0, false);
  rig.button(pad, 9, false);
  rig.frame();
  rig.button(pad, 0, true);
  rig.frame();
  assert.equal(rig.input.consumeGlobalActions().confirm, true, 'a claimed controller confirms menu selections');
});

test('the standard gamepad deadzone rejects drift and d-pad/trigger mappings work', t => {
  const rig = browser(t);
  const pad = rig.connect(1);
  pad.axes = [0.1, -0.1];
  rig.frame();
  assert.equal(rig.input.assignPad(0, 1), true);
  let sample = rig.input.sample()[0];
  assert.equal(sample.x, 0);
  assert.equal(sample.y, 0);

  pad.axes = [0.7, 0];
  rig.frame();
  sample = rig.input.sample()[0];
  assert.ok(sample.x > 0.4 && sample.x < 1);
  assert.equal(sample.y, 0);
  pad.axes = [1, 1];
  rig.frame();
  sample = rig.input.sample()[0];
  assert.ok(Math.abs(Math.hypot(sample.x, sample.y) - 1) < 1e-9);

  pad.axes = [0, 0];
  rig.button(pad, 12, true);
  rig.button(pad, 7, true);
  rig.frame();
  sample = rig.input.sample()[0];
  assert.equal(sample.x, 0);
  assert.equal(sample.y, -1);
  assert.equal(sample.sprint, true);
});

test('the frame cache polls once for all public consumers and blur clears latched keys', t => {
  const rig = browser(t);
  rig.input.setActive(true);
  assert.equal(rig.keyDown('ArrowLeft').defaultPrevented, true);
  assert.equal(rig.keyDown('KeyQ').defaultPrevented, false);
  rig.keyDown('KeyG');
  rig.frame();
  const polls = rig.polls;
  assert.equal(rig.input.sample()[0].shoot, true);
  rig.input.consumeGlobalActions();
  rig.input.consumeJoinEvents();
  rig.input.getGamepads();
  rig.input.sample();
  assert.equal(rig.polls, polls);
  rig.blur();
  rig.frame();
  const afterBlur = rig.input.sample();
  assert.equal(afterBlur[0].shoot, false);
  assert.equal(afterBlur[0].shootReleased, false);
  assert.equal(afterBlur[1].x, 0);
});

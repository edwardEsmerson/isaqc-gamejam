const KEYBOARDS = [
  { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', pass: 'KeyF', split: 'KeyQ', shoot: 'KeyG', switch: 'KeyH', reading: 'KeyR', sprint: 'ShiftLeft' },
  { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', pass: 'KeyK', split: 'KeyO', shoot: 'KeyL', switch: 'KeyJ', reading: 'KeyU', sprint: 'ShiftRight' },
];

const GAME_KEYS = new Set(KEYBOARDS.flatMap((mapping) => Object.values(mapping)).concat(['Escape', 'KeyP', 'Enter', 'Space']));
const ACTION_KEYS = new Set(KEYBOARDS.flatMap((mapping) => [mapping.pass, mapping.split, mapping.shoot, mapping.switch, mapping.reading]).concat(['Escape', 'KeyP', 'Enter', 'Space']));
const EMPTY_ACTIONS = () => ({ x: 0, y: 0, pass: false, split: false, shoot: false, shootReleased: false, switch: false, reading: false, sprint: false });

function buttonDown(button) {
  return Boolean(button && (button.pressed || button.value > 0.5));
}

function stickAxis(value) {
  return Number.isFinite(value) ? value : 0;
}

/** Keyboard and explicitly claimed controllers, with transient inputs consumed per frame. */
export class InputManager {
  constructor() {
    this.assignedPads = [null, null];
    this.lastDevice = 'keyboard';
    this.active = false;
    this.keys = new Set();
    this._keyEdges = new Set();
    this._frameKeyEdges = new Set();
    this._blockedKeys = new Set();
    this._pads = new Map();
    this._blockedButtons = new Map();
    this._joins = [];
    this._globals = { pause: false, confirm: false };
    this._previousShoot = [false, false];
    this._sampled = [false, false];
    this._destroyed = false;
    this._hasPolled = false;

    this._onKeyDown = (event) => {
      if (this.active && GAME_KEYS.has(event.code)) event.preventDefault();
      if (event.repeat || this.keys.has(event.code)) return;
      this.keys.add(event.code);
      if (!this._blockedKeys.has(event.code)) this._keyEdges.add(event.code);
      if (GAME_KEYS.has(event.code)) this.lastDevice = 'keyboard';
    };
    this._onKeyUp = (event) => {
      if (this.active && GAME_KEYS.has(event.code)) event.preventDefault();
      this.keys.delete(event.code);
      this._blockedKeys.delete(event.code);
    };
    this._onBlur = () => {
      this.clear();
      this.keys.clear();
      this._blockedKeys.clear();
    };
    this._onDisconnect = (event) => {
      const index = event.gamepad.index;
      this._pads.delete(index);
      this._blockedButtons.delete(index);
      this.assignedPads.forEach((assigned, team) => {
        if (assigned === index) {
          this.assignedPads[team] = null;
          this._previousShoot[team] = false;
        }
      });
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('gamepaddisconnected', this._onDisconnect);

    this._tick = () => {
      if (this._destroyed) return;
      this._poll();
      this._raf = window.requestAnimationFrame(this._tick);
    };
    this._raf = window.requestAnimationFrame(this._tick);
  }

  _poll() {
    this._hasPolled = true;
    this._sampled.fill(false);
    this._frameKeyEdges = new Set(this._keyEdges);
    this._keyEdges.clear();
    this._joins.length = 0;
    this._globals.pause = this._frameKeyEdges.has('Escape') || this._frameKeyEdges.has('KeyP');
    this._globals.confirm = this._frameKeyEdges.has('Enter') || this._frameKeyEdges.has('Space');

    let connected = [];
    try {
      connected = Array.from(navigator.getGamepads?.() || []).filter((pad) => pad?.connected);
    } catch {
      // Sandboxed and unsupported browsers still have two complete keyboard layouts.
    }
    const connectedIndices = new Set();
    for (const pad of connected) {
      connectedIndices.add(pad.index);
      const previous = this._pads.get(pad.index);
      const buttons = Array.from(pad.buttons, buttonDown);
      const blocked = this._blockedButtons.get(pad.index);
      if (blocked) {
        for (const button of blocked) if (!buttons[button]) blocked.delete(button);
      }
      const pressed = buttons.map((down, index) => down && !previous?.buttons[index] && !blocked?.has(index));
      const x = stickAxis(pad.axes[0]);
      const y = stickAxis(pad.axes[1]);
      this._pads.set(pad.index, { index: pad.index, id: pad.id, connected: true, buttons, pressed, x, y });
      if (pressed.some(Boolean) || Math.hypot(x, y) > 0.25) this.lastDevice = 'gamepad';
      if (pressed[0]) {
        this._joins.push({ index: pad.index, id: pad.id });
        if (this.assignedPads.includes(pad.index)) this._globals.confirm = true;
      }
      if (pressed[9]) this._globals.pause = true;
    }
    for (const index of this._pads.keys()) {
      if (!connectedIndices.has(index)) {
        this._pads.delete(index);
        this._blockedButtons.delete(index);
        this.assignedPads.forEach((assigned, team) => {
          if (assigned === index) {
            this.assignedPads[team] = null;
            this._previousShoot[team] = false;
          }
        });
      }
    }
  }

  _ensurePolled() {
    if (!this._hasPolled && !this._destroyed) this._poll();
  }

  setActive(active) {
    if (this.active !== Boolean(active)) this.clear();
    this.active = Boolean(active);
  }

  assignPad(team, index) {
    if ((team !== 0 && team !== 1) || !Number.isInteger(index) || index < 0) return false;
    this._ensurePolled();
    const pad = this._pads.get(index);
    if (!pad) return false;
    const otherTeam = 1 - team;
    if (this.assignedPads[otherTeam] === index) return false;
    this.assignedPads[team] = index;
    this._previousShoot[team] = false;
    this._blockedButtons.set(index, new Set(pad.buttons.flatMap((down, button) => down ? [button] : [])));
    return true;
  }

  clearAssignments() {
    this.assignedPads.fill(null);
    this.clear();
  }

  getGamepads() {
    this._ensurePolled();
    return Array.from(this._pads.values(), ({ index, id, connected }) => ({ index, id, connected }));
  }

  consumeJoinEvents() {
    this._ensurePolled();
    return this._joins.splice(0);
  }

  consumeGlobalActions() {
    this._ensurePolled();
    const result = { ...this._globals };
    this._globals.pause = false;
    this._globals.confirm = false;
    return result;
  }

  sample() {
    this._ensurePolled();
    if (this._destroyed) return [EMPTY_ACTIONS(), EMPTY_ACTIONS()];
    return KEYBOARDS.map((mapping, team) => {
      const held = (key) => this.keys.has(key) && !this._blockedKeys.has(key);
      const pressed = (key) => !this._sampled[team] && this._frameKeyEdges.has(key) && !this._blockedKeys.has(key);
      const pad = this._pads.get(this.assignedPads[team]);
      const blocked = this._blockedButtons.get(this.assignedPads[team]);
      const padHeld = (button) => Boolean(pad?.buttons[button] && !blocked?.has(button));
      const padPressed = (button) => Boolean(!this._sampled[team] && pad?.pressed[button] && !blocked?.has(button));
      let x = Number(held(mapping.right)) - Number(held(mapping.left));
      let y = Number(held(mapping.down)) - Number(held(mapping.up));
      if (pad) {
        const magnitude = Math.hypot(pad.x, pad.y);
        if (magnitude > 0.18) {
          const strength = Math.min(1, (magnitude - 0.18) / 0.82);
          x += pad.x / magnitude * strength;
          y += pad.y / magnitude * strength;
        }
        x += Number(padHeld(15)) - Number(padHeld(14));
        y += Number(padHeld(13)) - Number(padHeld(12));
      }
      const magnitude = Math.hypot(x, y);
      if (magnitude > 1) { x /= magnitude; y /= magnitude; }
      const shoot = held(mapping.shoot) || padHeld(1);
      const shootReleased = !this._sampled[team] && this._previousShoot[team] && !shoot;
      this._previousShoot[team] = shoot;
      const actions = {
        x, y,
        pass: pressed(mapping.pass) || padPressed(0),
        split: pressed(mapping.split) || padPressed(4),
        shoot,
        shootReleased,
        switch: pressed(mapping.switch) || padPressed(2),
        reading: pressed(mapping.reading) || padPressed(3),
        sprint: held(mapping.sprint) || padHeld(5) || padHeld(7),
      };
      this._sampled[team] = true;
      return actions;
    });
  }

  /** Require release of held actions before they can fire after a menu or kickoff. */
  clear() {
    this._keyEdges.clear();
    this._frameKeyEdges.clear();
    this._joins.length = 0;
    this._globals.pause = false;
    this._globals.confirm = false;
    this._previousShoot.fill(false);
    this._sampled.fill(true);
    for (const key of this.keys) if (ACTION_KEYS.has(key)) this._blockedKeys.add(key);
    for (const pad of this._pads.values()) {
      this._blockedButtons.set(pad.index, new Set(pad.buttons.flatMap((down, button) => down ? [button] : [])));
      pad.pressed.fill(false);
    }
  }

  destroy() {
    this.clear();
    this._destroyed = true;
    window.cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('gamepaddisconnected', this._onDisconnect);
    this._pads.clear();
  }
}

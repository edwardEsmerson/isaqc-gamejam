import { applyGate, depolarize, freshState, lockAxis, measureZ, probability, stateLength } from './quantum.js';

export const PITCH = Object.freeze({ left: 100, right: 1500, top: 100, bottom: 960, cx: 800, cy: 530, goalHalf: 110, boxDepth: 230, boxHalf: 230 });
export const TEAM_COLORS = [0x36e1db, 0xff8b59];
export const PLAYER_RADIUS = 22;
const BALL_RADIUS = 9;
const RUN_SPEED = 242;
const SPRINT_SPEED = 326;
const PRESSURE_RADIUS = 138;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const blankInput = () => ({ x: 0, y: 0, pass: false, shoot: false, shootReleased: false, switch: false, reading: false, sprint: false });
const blankStats = () => ({ shots: 0, goals: 0, possession: 0, alignmentTotal: 0, failedMeasurements: 0, stateLost: 0, saves: 0, passes: 0 });

function normalized(x, y) {
  const n = Math.hypot(x, y);
  return n > 0.0001 ? { x: x / n, y: y / n } : { x: 0, y: 0 };
}

// Earliest point of contact with a moving ball, preventing tunnelling at full power.
function segmentContact(ax, ay, bx, by, px, py, radius) {
  const dx = bx - ax, dy = by - ay;
  const rx = ax - px, ry = ay - py;
  const a = dx * dx + dy * dy;
  const c = rx * rx + ry * ry - radius * radius;
  if (c <= 0) return 0;
  if (a < 0.00001) return null;
  const b = 2 * (rx * dx + ry * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** A renderer-independent, deterministic-with-rng football match. dt is in seconds. */
export class Match {
  constructor(options = {}) {
    this.reset(options);
  }

  reset(options = {}) {
    this.options = { halfDuration: 180, aiTeams: [], ...options };
    this.random = this.options.random || Math.random;
    this.duration = Math.max(1, Number(this.options.halfDuration) || 180);
    this.aiTeams = new Set(this.options.aiTeams || []);
    this.score = [0, 0];
    this.stats = [blankStats(), blankStats()];
    this.half = 1;
    this.time = 0;
    this.elapsed = 0;
    this.phase = 'kickoff';
    this.timer = 1.35;
    this.events = [];
    this.gatesHistory = [];
    this.measurement = null;
    this.pressure = 0;
    this.controlled = [4, 9];
    this.locks = [0, 1].map(() => ({ basis: 'Z', target: null, progress: 0, frozen: false }));
    this._manualUntil = [0, 0];
    this._pressUntil = [0, 0];
    this._aiTimer = [0.75, 0.75];
    this._pressureEventTimer = 0;
    this._immunity = 1;
    this._endPending = false;
    this._kickoffTeam = 0;
    this.players = [];
    const roster = [ ['GK', 'RESET'], ['DEF', 'X'], ['MID', 'H'], ['MID', 'Z'], ['FWD', 'T'] ];
    for (let team = 0; team < 2; team++) {
      roster.forEach(([role, gate], index) => this.players.push({
        id: team * 5 + index, team, role, gate, slot: index,
        x: PITCH.cx, y: PITCH.cy, vx: 0, vy: 0, fx: team ? -1 : 1, fy: 0,
        charge: 0, dive: 0, cooldown: 0,
      }));
    }
    this.ball = { x: PITCH.cx, y: PITCH.cy, vx: 0, vy: 0, owner: 4, state: freshState(), mode: 'held', lastTeam: 0, target: null, sender: null, height: 0, age: 0 };
    this._setupKickoff(0);
    return this;
  }

  player(id) { return id === null ? null : this.players[id] || null; }
  getControlled(team) { return this.player(this.controlled[team]); }
  attackDirection(team) { return (team === 0 ? 1 : -1) * (this.half === 1 ? 1 : -1); }
  ownGoalX(team) { return this.attackDirection(team) > 0 ? PITCH.left : PITCH.right; }
  opposingGoalX(team) { return this.ownGoalX(1 - team); }
  keeper(team) { return this.players[team * 5]; }
  shotChance(team) { return probability(this.ball.state, this.lockVector(1 - team)); }

  lockVector(team) {
    const lock = this.locks[team];
    if (!lock.target) return lockAxis(lock.basis);
    const angle = (lock.basis === 'Z' ? lock.progress : 1 - lock.progress) * Math.PI / 2;
    return { x: Math.sin(angle), y: 0, z: Math.cos(angle) };
  }

  inPenaltyBox(team, point = this.ball) {
    const goalX = this.ownGoalX(team);
    return Math.abs(point.x - goalX) <= PITCH.boxDepth && Math.abs(point.y - PITCH.cy) <= PITCH.boxHalf;
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  _emit(type, data = {}) { this.events.push({ type, x: this.ball.x, y: this.ball.y, ...data }); }

  _home(player) {
    const direction = this.attackDirection(player.team);
    const relativeX = [ -645, -395, -125, -45, 270 ][player.slot];
    const relativeY = [ 0, 0, -185, 185, 0 ][player.slot];
    return { x: PITCH.cx + direction * relativeX, y: PITCH.cy + relativeY };
  }

  _setupKickoff(team) {
    this._kickoffTeam = team;
    this.phase = 'kickoff';
    this.timer = 1.35;
    this.measurement = null;
    this.pressure = 0;
    this._immunity = 1.25;
    for (const player of this.players) {
      const home = this._home(player);
      const direction = this.attackDirection(player.team);
      player.x = home.x;
      player.y = home.y;
      // Both teams start in their own half, giving the first pass breathing room.
      if (player.role !== 'GK') {
        player.x = direction > 0 ? Math.min(home.x, PITCH.cx - 160) : Math.max(home.x, PITCH.cx + 160);
      }
      player.vx = 0; player.vy = 0; player.fx = direction; player.fy = 0;
      player.charge = 0; player.dive = 0; player.cooldown = 0;
    }
    const starter = this.players[team * 5 + 4];
    starter.x = PITCH.cx - this.attackDirection(team) * 29;
    starter.y = PITCH.cy;
    const teammate = this.players[team * 5 + 2];
    teammate.x = PITCH.cx - this.attackDirection(team) * 120;
    teammate.y = PITCH.cy - 150;
    this.ball = { x: PITCH.cx, y: PITCH.cy, vx: 0, vy: 0, owner: starter.id, state: freshState(), mode: 'held', lastTeam: team, target: null, sender: null, height: 0, age: 0 };
    this.locks.forEach((lock, defendedTeam) => { lock.frozen = this.inPenaltyBox(defendedTeam); });
    this.controlled[team] = starter.id;
    this.controlled[1 - team] = this._nearestOutfield(1 - team).id;
    this.gatesHistory = [];
    this._emit('whistle', { team, kickoff: true });
    this._emit('reset', { team, reason: 'kickoff' });
  }

  continueHalf() {
    if (this.phase !== 'halftime') return false;
    this.half = 2;
    this.time = 0;
    this._endPending = false;
    this._manualUntil = [0, 0];
    this.locks.forEach(lock => { lock.target = null; lock.progress = 0; lock.frozen = false; });
    this._setupKickoff(1);
    return true;
  }

  _finishHalf() {
    this.time = this.duration;
    this._endPending = false;
    this.measurement = null;
    this.ball.vx = 0; this.ball.vy = 0;
    for (const player of this.players) { player.vx = 0; player.vy = 0; player.charge = 0; }
    this.phase = this.half === 1 ? 'halftime' : 'fulltime';
    this.timer = 0;
    this._emit('whistle', { final: this.half === 2 });
    this._emit(this.phase, { score: [...this.score] });
  }

  _nearestOutfield(team, point = this.ball, excluded = null) {
    let chosen = null, nearest = Infinity;
    for (const player of this.players) {
      if (player.team !== team || player.role === 'GK' || player.id === excluded) continue;
      const dist = distance(player, point);
      if (dist < nearest) { nearest = dist; chosen = player; }
    }
    return chosen;
  }

  bestPass(player) {
    if (!player) return null;
    const candidates = this.players.filter(p => p.team === player.team && p.id !== player.id);
    let best = null, bestScore = -Infinity;
    for (const teammate of candidates) {
      const dx = teammate.x - player.x, dy = teammate.y - player.y;
      const length = Math.hypot(dx, dy);
      if (length < 55) continue;
      const facing = (dx * player.fx + dy * player.fy) / length;
      const nearestDefender = Math.min(...this.players.filter(p => p.team !== player.team).map(p => distance(p, teammate)));
      const safety = clamp(nearestDefender / 160, 0, 1);
      let blocked = 0;
      for (const opponent of this.players) {
        if (opponent.team === player.team) continue;
        const projection = ((opponent.x - player.x) * dx + (opponent.y - player.y) * dy) / (length * length);
        if (projection > 0.1 && projection < 0.9) {
          const lateral = Math.hypot(opponent.x - player.x - dx * projection, opponent.y - player.y - dy * projection);
          if (lateral < 55) blocked += 1;
        }
      }
      const score = facing * 3.6 + safety * 0.75 - length / 1100 - blocked * 0.55;
      if (score > bestScore) { bestScore = score; best = teammate; }
    }
    return best;
  }

  _pass(player, target = this.bestPass(player)) {
    if (this.ball.owner !== player.id || !target) return false;
    const speed = 730;
    const lead = Math.min(distance(player, target) / speed, 0.4);
    const aim = normalized(target.x + target.vx * lead - player.x, target.y + target.vy * lead - player.y);
    // A touch moves the ball to the kicking foot in the chosen direction. Keeping
    // it on the old front foot made pressured back-passes hit a marker instantly.
    player.fx = aim.x; player.fy = aim.y;
    this.ball.x = player.x + aim.x * 29; this.ball.y = player.y + aim.y * 29;
    this.ball.owner = null;
    this.ball.mode = 'pass';
    this.ball.vx = aim.x * speed; this.ball.vy = aim.y * speed;
    this.ball.target = target.id; this.ball.sender = player.id; this.ball.lastTeam = player.team;
    this.ball.age = 0; this.ball.height = 0;
    this._immunity = 0.15;
    player.charge = 0;
    this.controlled[player.team] = target.id;
    this._manualUntil[player.team] = 0;
    this.stats[player.team].passes++;
    this._emit('kick', { team: player.team, pass: true });
    this._emit('pass', { team: player.team, from: player.id, to: target.id, gate: target.gate });
    return true;
  }

  _shoot(player, power = player.charge) {
    if (this.ball.owner !== player.id) return false;
    const direction = this.attackDirection(player.team);
    const targetY = PITCH.cy + clamp(player.fy * 95 + (player.y - PITCH.cy) * 0.17, -PITCH.goalHalf + 20, PITCH.goalHalf - 20);
    const aim = normalized(this.opposingGoalX(player.team) + direction * 35 - player.x, targetY - player.y);
    player.fx = aim.x; player.fy = aim.y;
    this.ball.x = player.x + aim.x * 29; this.ball.y = player.y + aim.y * 29;
    const speed = 770 + clamp(power, 0, 1) * 580;
    this.ball.owner = null; this.ball.mode = 'shot';
    this.ball.vx = aim.x * speed; this.ball.vy = aim.y * speed;
    this.ball.target = null; this.ball.sender = player.id; this.ball.lastTeam = player.team;
    this.ball.age = 0; this.ball.power = clamp(power, 0, 1); this.ball.height = 0;
    this._immunity = 0.15;
    this.stats[player.team].shots++;
    this.stats[player.team].alignmentTotal += this.shotChance(player.team);
    player.charge = 0;
    this._emit('kick', { team: player.team, shot: true, power, probability: this.shotChance(player.team) });
    return true;
  }

  _takePossession(player, cause = 'collection') {
    const ball = this.ball;
    const previousTeam = ball.lastTeam;
    const isPass = ball.mode === 'pass' && previousTeam === player.team && ball.sender !== player.id;
    const isTurnover = previousTeam !== player.team;
    const wasShot = ball.mode === 'shot';
    if (player.role === 'GK') {
      ball.state = freshState();
      this.gatesHistory = ['RESET'];
      this._emit('reset', { team: player.team, player: player.id, reason: 'keeper' });
      if (wasShot && isTurnover) {
        this.stats[player.team].saves++;
        player.dive = 0.5;
        this._emit('save', { team: player.team, player: player.id });
      }
    } else if (isTurnover) {
      ball.state = measureZ(ball.state, this.random);
      this.gatesHistory = [];
      this._emit('tackle', { team: player.team, player: player.id, interception: cause === 'interception', outcome: ball.state.z });
    } else if (isPass) {
      ball.state = applyGate(ball.state, player.gate);
      this.gatesHistory.push(player.gate);
      this.gatesHistory = this.gatesHistory.slice(-7);
      this._emit('gate', { team: player.team, player: player.id, gate: player.gate, probability: probability(ball.state, this.lockVector(1 - player.team)) });
    }
    ball.owner = player.id; ball.mode = 'held'; ball.target = null; ball.sender = null;
    ball.lastTeam = player.team; ball.vx = 0; ball.vy = 0; ball.age = 0; ball.height = 0;
    this.controlled[player.team] = player.id;
    this._manualUntil[player.team] = 0;
    this._immunity = 0.7;
    player.charge = 0;
    this._emit('touch', { team: player.team, player: player.id });
  }

  _reading(team) {
    const lock = this.locks[team];
    if (lock.frozen || lock.target) return false;
    lock.target = lock.basis === 'Z' ? 'X' : 'Z';
    lock.progress = 0;
    this._emit('reading', { team, basis: lock.target, x: this.ownGoalX(team), y: PITCH.cy });
    return true;
  }

  _updateLocks(dt) {
    for (let team = 0; team < 2; team++) {
      const lock = this.locks[team];
      lock.frozen = this.inPenaltyBox(team);
      if (lock.target && !lock.frozen) {
        lock.progress = Math.min(1, lock.progress + dt / 2);
        if (lock.progress >= 1) {
          lock.basis = lock.target; lock.target = null; lock.progress = 0;
        }
      }
    }
  }

  _updateControl(team, input) {
    const owner = this.player(this.ball.owner);
    if (owner?.team === team) {
      this.controlled[team] = owner.id;
      if (input.switch) this._pressUntil[team] = this.elapsed + 2;
      return;
    }
    if (this.ball.mode === 'pass' && this.ball.lastTeam === team && this.ball.target !== null) {
      this.controlled[team] = this.ball.target;
      return;
    }
    if (input.switch) {
      const ordered = this.players.filter(p => p.team === team && p.role !== 'GK').sort((a, b) => distance(a, this.ball) - distance(b, this.ball));
      const index = ordered.findIndex(p => p.id === this.controlled[team]);
      this.controlled[team] = ordered[(index + 1) % ordered.length].id;
      this._manualUntil[team] = this.elapsed + 2.5;
      this._pressUntil[team] = this.elapsed + 2;
    } else if (this.elapsed > this._manualUntil[team]) {
      const nearest = this._nearestOutfield(team);
      const current = this.getControlled(team);
      // A small margin prevents the control arrow flickering between equal distances.
      if (!current || current.role === 'GK' || distance(nearest, this.ball) + 30 < distance(current, this.ball)) this.controlled[team] = nearest.id;
    }
  }

  _aiInput(team, dt) {
    const input = blankInput();
    const controlled = this.getControlled(team);
    if (!controlled) return input;
    const owner = this.player(this.ball.owner);
    this._aiTimer[team] -= dt;
    if (owner?.team === team) {
      const goal = { x: this.opposingGoalX(team), y: PITCH.cy };
      const goalDistance = distance(owner, goal);
      const direction = this.attackDirection(team);
      const laneY = PITCH.cy + Math.sin(this.elapsed * 0.65 + team * 2) * 140;
      const move = normalized(direction * 450, laneY - owner.y);
      input.x = move.x; input.y = move.y;
      input.sprint = goalDistance > 330;
      const oppositionNear = this.players.some(p => p.team !== team && distance(p, owner) < 115);
      if (this._aiTimer[team] <= 0) {
        if (goalDistance < 390 && (this.shotChance(team) > 0.55 || oppositionNear || goalDistance < 210)) {
          // Aim across the keeper, rather than firing every demo shot at its feet.
          owner.fy = this.keeper(1 - team).y >= PITCH.cy ? -0.95 : 0.95;
          this._shoot(owner, 0.6 + this.random() * 0.35);
          this._aiTimer[team] = 0.9;
        } else if (oppositionNear || this.random() < 0.38 || owner.role === 'GK') {
          const candidates = this.players.filter(p => p.team === team && p.id !== owner.id && p.role !== 'GK');
          let best = null, bestScore = -Infinity;
          for (const target of candidates) {
            const forward = (target.x - owner.x) * direction;
            const open = Math.min(...this.players.filter(p => p.team !== team).map(p => distance(p, target)));
            const after = probability(applyGate(this.ball.state, target.gate), this.lockVector(1 - team));
            const dx = target.x - owner.x, dy = target.y - owner.y;
            const passLength = Math.hypot(dx, dy);
            let blocked = 0;
            for (const defender of this.players) {
              if (defender.team === team) continue;
              const along = ((defender.x - owner.x) * dx + (defender.y - owner.y) * dy) / (passLength * passLength);
              if (along > 0.08 && along < 0.96 && Math.hypot(defender.x - owner.x - dx * along, defender.y - owner.y - dy * along) < 62) blocked++;
            }
            const score = forward * 0.002 + clamp(open / 160, 0, 1) + after * 0.85 - passLength / 1500 - blocked * 2.5;
            if (score > bestScore) { bestScore = score; best = target; }
          }
          if (best) this._pass(owner, best);
          this._aiTimer[team] = 0.65 + this.random() * 0.6;
        } else this._aiTimer[team] = 0.5;
      }
    } else {
      const aim = normalized(this.ball.x + this.ball.vx * 0.1 - controlled.x, this.ball.y + this.ball.vy * 0.1 - controlled.y);
      input.x = aim.x; input.y = aim.y; input.sprint = distance(controlled, this.ball) > 200;
      if (this._aiTimer[team] <= 0) {
        const lock = this.locks[team];
        const alternative = lock.basis === 'Z' ? 'X' : 'Z';
        if (probability(this.ball.state, alternative) + 0.2 < probability(this.ball.state, lock.basis)) input.reading = true;
        this._aiTimer[team] = 1.1 + this.random();
      }
    }
    return input;
  }

  _offballTarget(player) {
    const home = this._home(player);
    const owner = this.player(this.ball.owner);
    const attacking = owner ? owner.team === player.team : this.ball.lastTeam === player.team;
    const direction = this.attackDirection(player.team);
    if (player.role === 'GK') {
      const goalX = this.ownGoalX(player.team);
      const goalDistance = Math.abs(this.ball.x - goalX);
      const track = clamp((this.ball.y - PITCH.cy) * (goalDistance < 400 ? 0.88 : 0.55), -PITCH.goalHalf + 28, PITCH.goalHalf - 28);
      let targetY = PITCH.cy + track;
      if (this.ball.mode === 'shot' && this.ball.lastTeam !== player.team && this.ball.age < 0.16) {
        targetY = player.y;
      } else if (this.ball.mode === 'shot' && this.ball.lastTeam !== player.team && Math.abs(this.ball.vx) > 1) {
        const t = (goalX + direction * 42 - this.ball.x) / this.ball.vx;
        if (t >= 0 && t < 0.7) targetY = clamp(this.ball.y + this.ball.vy * t, PITCH.cy - PITCH.goalHalf + 20, PITCH.cy + PITCH.goalHalf - 20);
      }
      return { x: goalX + direction * 52, y: targetY };
    }
    const ballShiftX = clamp((this.ball.x - PITCH.cx) * 0.36, -205, 205);
    const ballShiftY = clamp((this.ball.y - PITCH.cy) * 0.26, -112, 112);
    let target = { x: home.x + ballShiftX + direction * (attacking ? 58 : -70), y: home.y + ballShiftY };
    if (attacking) {
      // Teammates fan away from opponents, preserving an outlet on either side.
      for (const opponent of this.players) {
        if (opponent.team === player.team || opponent.role === 'GK') continue;
        const dist = distance(target, opponent);
        if (dist < 175 && dist > 1) {
          const push = (175 - dist) * 0.48;
          target.x += (target.x - opponent.x) / dist * push;
          target.y += (target.y - opponent.y) / dist * push;
        }
      }
      if (owner?.role === 'GK') target.x = Math.min(Math.max(target.x, PITCH.left + 230), PITCH.right - 230);
    } else if (this.elapsed < this._pressUntil[player.team]) {
      const presser = this._nearestOutfield(player.team, this.ball, this.controlled[player.team]);
      if (presser?.id === player.id) target = { x: this.ball.x, y: this.ball.y };
    }
    return { x: clamp(target.x, PITCH.left + 55, PITCH.right - 55), y: clamp(target.y, PITCH.top + 55, PITCH.bottom - 55) };
  }

  _movePlayers(dt, inputs) {
    for (const player of this.players) {
      player.dive = Math.max(0, player.dive - dt);
      player.cooldown = Math.max(0, player.cooldown - dt);
      const input = inputs[player.team];
      const controlled = this.controlled[player.team] === player.id;
      let aim, speed;
      if (controlled) {
        const magnitude = Math.min(1, Math.hypot(input.x || 0, input.y || 0));
        aim = normalized(input.x || 0, input.y || 0);
        speed = (input.sprint ? SPRINT_SPEED : RUN_SPEED) * magnitude;
        if (this.ball.owner === player.id && player.role !== 'GK') speed *= 0.91;
      } else {
        const target = this._offballTarget(player);
        const dist = distance(player, target);
        aim = normalized(target.x - player.x, target.y - player.y);
        speed = Math.min(player.role === 'GK' ? 330 : RUN_SPEED * 0.85, dist * 3.2);
        if (this.ball.mode === 'pass' && this.ball.target === player.id) {
          aim = normalized(this.ball.x - player.x, this.ball.y - player.y);
          speed = distance(player, this.ball) < 95 ? Math.min(190, distance(player, this.ball) * 2) : 0;
        }
      }
      const smoothing = 1 - Math.exp(-dt * 15);
      player.vx += (aim.x * speed - player.vx) * smoothing;
      player.vy += (aim.y * speed - player.vy) * smoothing;
      player.x += player.vx * dt; player.y += player.vy * dt;
      player.x = clamp(player.x, PITCH.left + PLAYER_RADIUS, PITCH.right - PLAYER_RADIUS);
      player.y = clamp(player.y, PITCH.top + PLAYER_RADIUS, PITCH.bottom - PLAYER_RADIUS);
      if (Math.hypot(player.vx, player.vy) > 18) {
        const facing = normalized(player.vx, player.vy);
        player.fx = facing.x; player.fy = facing.y;
      }
    }
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i], b = this.players[j];
        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
        const separation = PLAYER_RADIUS * 1.85;
        if (dist >= separation) continue;
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        const shift = (separation - dist) / 2;
        a.x -= nx * shift; a.y -= ny * shift;
        b.x += nx * shift; b.y += ny * shift;
      }
    }
  }

  _heldBall(dt, inputs) {
    const owner = this.player(this.ball.owner);
    if (!owner) { this.ball.mode = 'loose'; return; }
    this.ball.x = clamp(owner.x + owner.fx * 29, PITCH.left + BALL_RADIUS, PITCH.right - BALL_RADIUS);
    this.ball.y = clamp(owner.y + owner.fy * 29, PITCH.top + BALL_RADIUS, PITCH.bottom - BALL_RADIUS);
    this.ball.vx = owner.vx; this.ball.vy = owner.vy;
    this.stats[owner.team].possession += dt;
    let pressure = 0;
    let tackling = null;
    for (const opponent of this.players) {
      if (opponent.team === owner.team) continue;
      const dist = distance(opponent, owner);
      if (dist < PRESSURE_RADIUS) pressure += (1 - dist / PRESSURE_RADIUS);
      if (dist < 53 && opponent.cooldown <= 0 && (!tackling || dist < distance(tackling, owner))) tackling = opponent;
    }
    this.pressure = clamp(pressure, 0, 2);
    if (pressure > 0 && owner.role !== 'GK') {
      const before = stateLength(this.ball.state);
      this.ball.state = depolarize(this.ball.state, 1 - Math.exp(-pressure * 0.64 * dt));
      const loss = before - stateLength(this.ball.state);
      this.stats[owner.team].stateLost += loss;
      if (loss > 0.00001 && this._pressureEventTimer <= 0) {
        this._pressureEventTimer = 0.36;
        this._emit('pressure', { team: owner.team, amount: loss, strength: stateLength(this.ball.state) });
      }
    }
    if (tackling && this._immunity <= 0 && this.random() < 1 - Math.exp(-dt * 2.3)) {
      tackling.cooldown = 1.1;
      this._takePossession(tackling, 'tackle');
      return;
    }
    const input = inputs[owner.team];
    if (input.shoot) owner.charge = Math.min(1, owner.charge + dt / 0.85);
    if (input.shootReleased) this._shoot(owner, Math.max(0.12, owner.charge));
    else if (input.pass) this._pass(owner);
  }

  _beginMeasurement(team) {
    const chance = this.shotChance(team);
    const axis = this.lockVector(1 - team);
    this.ball.vx = 0; this.ball.vy = 0;
    this.phase = 'measurement';
    this.timer = 0.5;
    this.measurement = { probability: chance, team, success: null, timer: 0.5, axis, stateBefore: { ...this.ball.state } };
    this._emit('measure', { team, probability: chance, result: null });
  }

  _updateMeasurement(dt) {
    this.timer = Math.max(0, this.timer - dt);
    const measure = this.measurement;
    measure.timer = this.timer;
    if (this.timer <= 0.25 && measure.success === null) {
      measure.success = this.random() < measure.probability;
      const sign = measure.success ? 1 : -1;
      this.ball.state = { x: sign * measure.axis.x, y: sign * measure.axis.y, z: sign * measure.axis.z };
      this._emit('measure', { team: measure.team, probability: measure.probability, result: measure.success });
    }
    if (this.timer > 0) return;
    if (measure.success) {
      this.score[measure.team]++;
      this.stats[measure.team].goals++;
      this.phase = 'goal'; this.timer = 2.4;
      this._kickoffTeam = 1 - measure.team;
      this._emit('goal', { team: measure.team, probability: measure.probability, score: [...this.score] });
    } else {
      this.stats[measure.team].failedMeasurements++;
      this._emit('miss', { team: measure.team, reason: 'measurement', probability: measure.probability });
      const keeper = this.keeper(1 - measure.team);
      this.ball.mode = 'loose';
      this._takePossession(keeper, 'reset');
      this.phase = 'play';
      this.measurement = null;
      if (this._endPending) this._finishHalf();
    }
  }

  _movingBall(dt) {
    const ball = this.ball;
    ball.age += dt;
    this.pressure = 0;
    if (ball.mode === 'pass' && ball.target !== null && ball.age < 1.3) {
      const target = this.player(ball.target);
      const dir = normalized(target.x - ball.x, target.y - ball.y);
      const speed = Math.hypot(ball.vx, ball.vy);
      const steer = 1 - Math.exp(-dt * 2.5);
      const heading = normalized(ball.vx * (1 - steer) + dir.x * speed * steer, ball.vy * (1 - steer) + dir.y * speed * steer);
      ball.vx = heading.x * speed; ball.vy = heading.y * speed;
    }
    const ax = ball.x, ay = ball.y;
    const bx = ax + ball.vx * dt, by = ay + ball.vy * dt;
    let contact = null, first = 2;
    for (const player of this.players) {
      if (player.id === ball.sender && ball.age < 0.22) continue;
      // A keeper has a visible dive reach, while outfielders meet the ball on foot.
      const isKeeperShot = player.role === 'GK' && ball.mode === 'shot' && player.team !== ball.lastTeam;
      const radius = isKeeperShot ? 30 + (1 - (ball.power || 0)) * 12 : PLAYER_RADIUS + BALL_RADIUS - 2;
      const t = segmentContact(ax, ay, bx, by, player.x, player.y, radius);
      if (t !== null && t < first) { first = t; contact = player; }
    }
    // Goal crossing competes with contacts; a save has to happen before the line.
    const direction = this.attackDirection(ball.lastTeam);
    const goalX = this.opposingGoalX(ball.lastTeam);
    const crosses = ball.mode === 'shot' && (direction > 0 ? bx >= goalX && ax < goalX : bx <= goalX && ax > goalX);
    if (crosses) {
      const fraction = (goalX - ax) / (bx - ax);
      const crossY = ay + (by - ay) * fraction;
      if (Math.abs(crossY - PITCH.cy) <= PITCH.goalHalf - BALL_RADIUS && fraction <= first) {
        ball.x = goalX; ball.y = crossY;
        this._beginMeasurement(ball.lastTeam);
        return;
      }
    }
    if (contact) {
      ball.x = ax + (bx - ax) * first; ball.y = ay + (by - ay) * first;
      this._takePossession(contact, 'interception');
      if (this._endPending) this._finishHalf();
      return;
    }
    ball.x = bx; ball.y = by;
    let bounced = false;
    if (ball.y < PITCH.top + BALL_RADIUS || ball.y > PITCH.bottom - BALL_RADIUS) {
      ball.y = clamp(ball.y, PITCH.top + BALL_RADIUS, PITCH.bottom - BALL_RADIUS);
      ball.vy *= -0.86; bounced = true;
    }
    const enteringGoal = ball.mode === 'shot' && Math.abs(ball.y - PITCH.cy) <= PITCH.goalHalf - BALL_RADIUS
      && (direction > 0 ? ball.x > PITCH.right - BALL_RADIUS : ball.x < PITCH.left + BALL_RADIUS);
    if (!enteringGoal && (ball.x < PITCH.left + BALL_RADIUS || ball.x > PITCH.right - BALL_RADIUS)) {
      ball.x = clamp(ball.x, PITCH.left + BALL_RADIUS, PITCH.right - BALL_RADIUS);
      ball.vx *= -0.86; bounced = true;
    }
    if (bounced && ball.mode === 'shot') {
      this._emit('miss', { team: ball.lastTeam, reason: 'wide' });
      ball.mode = 'loose'; ball.target = null;
    }
    if (ball.mode === 'loose') {
      const friction = Math.exp(-dt * 1.3);
      ball.vx *= friction; ball.vy *= friction;
    }
    if ((ball.mode === 'pass' && ball.age > 1.7) || (ball.mode === 'shot' && ball.age > 2.6)) {
      ball.mode = 'loose'; ball.target = null;
    }
    ball.height = ball.mode === 'pass' ? Math.sin(Math.min(1, ball.age / 0.85) * Math.PI) * 8 : 0;
    if (this._endPending && ball.mode !== 'shot') this._finishHalf();
  }

  _step(dt, humanInputs) {
    this.elapsed += dt;
    this._immunity = Math.max(0, this._immunity - dt);
    this._pressureEventTimer = Math.max(0, this._pressureEventTimer - dt);
    if (this.phase === 'halftime' || this.phase === 'fulltime') return;
    if (this.phase === 'kickoff') {
      this.timer -= dt;
      if (this.timer <= 0) { this.phase = 'play'; this.timer = 0; }
      return;
    }
    if (this.phase === 'goal') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this._endPending) this._finishHalf();
        else this._setupKickoff(this._kickoffTeam);
      }
      return;
    }
    if (this.phase === 'measurement') { this._updateMeasurement(dt); return; }
    this.time = Math.min(this.duration, this.time + dt);
    if (this.time >= this.duration) {
      if (this.ball.mode === 'shot') this._endPending = true;
      else { this._finishHalf(); return; }
    }
    this._updateLocks(dt);
    const inputs = humanInputs.map((input, team) => this.aiTeams.has(team) ? this._aiInput(team, dt) : input);
    for (let team = 0; team < 2; team++) {
      this._updateControl(team, inputs[team]);
      if (inputs[team].reading) this._reading(team);
    }
    this._movePlayers(dt, inputs);
    if (this.ball.mode === 'held') this._heldBall(dt, inputs);
    else this._movingBall(dt);
  }

  update(dt, inputs = []) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Limit resume spikes, then substep collision/pressure at 120 Hz.
    const total = Math.min(dt, 0.25);
    const count = Math.max(1, Math.ceil(total * 120));
    const step = total / count;
    const current = [0, 1].map(team => ({ ...blankInput(), ...(inputs[team] || {}) }));
    for (let i = 0; i < count; i++) {
      this._step(step, current);
      // Button edges are consumed once; movement and held charge persist.
      if (i === 0) for (const input of current) { input.pass = false; input.shootReleased = false; input.switch = false; input.reading = false; }
    }
  }
}

export default Match;

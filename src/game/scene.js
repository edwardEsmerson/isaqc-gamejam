import Phaser from 'phaser';
import { PITCH, splitLanePosition } from './simulation.js';
import { stateLength } from './quantum.js';

const COLORS = [0x81e6ff, 0xff866d];
const HEX = ['#81e6ff', '#ff866d'];
const FONT = 'Barlow Condensed, Arial Narrow, sans-serif';
const clamp = Phaser.Math.Clamp;

export function quantumColor(state) {
  const phase = Math.atan2(state.y, state.x);
  const color = Phaser.Display.Color.HSVToRGB((0.51 + phase / (Math.PI * 2) + state.z * 0.13 + 1) % 1, 0.48 + 0.3 * stateLength(state), 1);
  return color.color;
}

/** Rendering and feedback live here; the match owns every physical coordinate. */
export class PitchScene extends Phaser.Scene {
  constructor(controller) {
    super('pitch');
    this.controller = controller;
  }

  create() {
    this.drawStadium();
    this.playerViews = new Map();
    this.lockViews = [];
    for (let side = 0; side < 2; side++) {
      const x = side ? PITCH.right + 66 : PITCH.left - 66;
      const disc = this.add.circle(x, PITCH.cy, 28, 0x102d39, 0.94).setStrokeStyle(2, 0xe9f9ed, 0.7);
      const axis = this.add.graphics();
      const label = this.add.text(x, PITCH.cy + 43, '|0〉', { fontFamily: FONT, fontSize: '23px', color: '#f4f6ef', fontStyle: 'bold' }).setOrigin(0.5);
      this.lockViews.push({ x, disc, axis, label });
    }
    this.dynamic = this.add.graphics().setDepth(4);
    this.trail = this.add.graphics().setDepth(3);
    this.splitPaths = this.add.graphics().setDepth(11);
    this.splitViews = [0, 1].map(path => this.add.container(0, 0, [
      this.add.ellipse(2, 8, 25, 14, 0x031b1b, 0.25),
      this.add.circle(0, 0, 11, path ? 0xc1baff : 0x81e6ff, 0.22).setStrokeStyle(2, path ? 0xc1baff : 0x81e6ff, 0.9),
      this.add.circle(0, 0, 7, 0xf7fff6, 0.6),
      this.add.text(0, -25, path ? 'B' : 'A', { fontFamily: FONT, fontSize: '17px', color: path ? '#c1baff' : '#81e6ff', fontStyle: 'bold', stroke: '#0b1c29', strokeThickness: 3 }).setOrigin(0.5),
    ]).setDepth(14).setVisible(false));
    this.portLabels = [0, 1].map(() => this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '19px', color: '#f4d38c', fontStyle: 'bold', stroke: '#0b1c29', strokeThickness: 4 }).setOrigin(0.5).setDepth(15).setVisible(false));
    this.splitTrails = [[], []];
    this.activeSplit = null;
    this.passLabel = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '18px', color: '#f4f6ef', fontStyle: 'bold', stroke: '#0b1c29', strokeThickness: 4 }).setOrigin(0.5).setDepth(15).setVisible(false);
    this.netGlow = this.add.graphics().setDepth(6);
    this.netPulse = [0, 0];
    this.ballShadow = this.add.ellipse(0, 0, 25, 14, 0x031b1b, 0.5).setDepth(10);
    this.ballRing = this.add.graphics().setDepth(12);
    this.ballView = this.add.container(0, 0, [
      this.add.circle(0, 0, 9, 0xf7fff6).setStrokeStyle(1.6, 0xc3d8cd),
      this.add.circle(-2, -2, 3.2, 0x254238),
      this.add.triangle(3, 4, -2, -2, 3, -1, 0, 3, 0x254238),
    ]).setDepth(13);
    this.trailPoints = [];
    this.fx = [];
    this.lastHud = 0;
    this.lastPhase = null;
    this.cameraX = PITCH.cx;
    this.cameraY = PITCH.cy;
    this.controller.scene = this;
    this.controller.ready();
  }

  drawStadium() {
    const g = this.add.graphics();
    g.fillStyle(0x0b1c29).fillRect(-1800, -1800, 5000, 5000);
    // Shadowed indoor concourse and seated crowd, generated once.
    g.fillStyle(0x142b37).fillRoundedRect(-54, -48, 1708, 1156, 40);
    g.fillStyle(0x081b26).fillRect(0, 0, 1600, 66).fillRect(0, 997, 1600, 66);
    let seed = 42;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 110; col++) {
        const color = [0x345365, 0x253f51, 0x5b747d, 0x477584, 0x956761][Math.floor(random() * 5)];
        g.fillStyle(color, 0.65 + random() * 0.3);
        g.fillCircle(29 + col * 14 + random() * 3, 8 + row * 18, 3.5 + random() * 2);
        g.fillCircle(29 + col * 14 + random() * 3, 1020 + row * 18, 3.5 + random() * 2);
      }
    }
    g.fillStyle(0x031515, 0.65).fillRoundedRect(87, 92, 1426, 889, 10);
    const grass = document.createElement('canvas');
    grass.width = 1400; grass.height = 860;
    const ctx = grass.getContext('2d');
    for (let stripe = 0; stripe < 14; stripe++) {
      ctx.fillStyle = stripe % 2 ? '#245f4a' : '#205843';
      ctx.fillRect(stripe * 100, 0, 100, 860);
    }
    for (let n = 0; n < 65000; n++) {
      ctx.fillStyle = random() > 0.5 ? 'rgba(189,225,161,.035)' : 'rgba(5,25,24,.045)';
      ctx.fillRect(random() * 1400, random() * 860, 1 + random() * 2, 2 + random() * 4);
    }
    const vignette = ctx.createRadialGradient(700, 430, 200, 700, 430, 800);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(1,20,23,.35)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, 1400, 860);
    this.textures.addCanvas('grass', grass);
    this.add.image(PITCH.cx, PITCH.cy, 'grass');

    const field = this.add.graphics();
    field.lineStyle(3, 0xe6f1df, 0.78);
    field.strokeRect(PITCH.left + 12, PITCH.top + 12, 1376, 836);
    field.lineBetween(PITCH.cx, PITCH.top + 12, PITCH.cx, PITCH.bottom - 12);
    field.strokeCircle(PITCH.cx, PITCH.cy, 115);
    field.fillStyle(0xe6f1df, 0.8).fillCircle(PITCH.cx, PITCH.cy, 4);
    for (const right of [false, true]) {
      const gx = right ? PITCH.right : PITCH.left;
      field.strokeRect(right ? gx - 230 : gx, PITCH.cy - 230, 230, 460);
      field.strokeRect(right ? gx - 82 : gx, PITCH.cy - 148, 82, 296);
      field.fillCircle(right ? gx - 166 : gx + 166, PITCH.cy, 3.4);
      field.beginPath();
      field.arc(right ? gx - 166 : gx + 166, PITCH.cy, 115, right ? Math.PI * 0.69 : -Math.PI * 0.31, right ? Math.PI * 1.31 : Math.PI * 0.31, false);
      field.strokePath();
      const netX = right ? gx + 4 : gx - 44;
      field.fillStyle(0x102b35, 0.85).fillRect(netX, PITCH.cy - 110, 40, 220);
      field.lineStyle(1, 0xc3e1db, 0.24);
      for (let i = 0; i <= 4; i++) field.lineBetween(netX + i * 10, PITCH.cy - 110, netX + i * 10, PITCH.cy + 110);
      for (let i = 0; i <= 22; i++) field.lineBetween(netX, PITCH.cy - 110 + i * 10, netX + 40, PITCH.cy - 110 + i * 10);
      field.lineStyle(5, 0xf4f6ef, 0.95);
      field.lineBetween(gx, PITCH.cy - 112, gx + (right ? 43 : -43), PITCH.cy - 112);
      field.lineBetween(gx, PITCH.cy + 112, gx + (right ? 43 : -43), PITCH.cy + 112);
      field.lineBetween(gx + (right ? 43 : -43), PITCH.cy - 112, gx + (right ? 43 : -43), PITCH.cy + 112);
    }
    const boards = this.add.graphics();
    boards.fillStyle(0x15313e).fillRect(92, 75, 1416, 24).fillRect(92, 962, 1416, 24);
    boards.fillStyle(0x284552).fillRect(81, 80, 17, 350).fillRect(81, 640, 17, 340);
    boards.fillRect(1502, 80, 17, 350).fillRect(1502, 640, 17, 340);
    boards.lineStyle(2, 0x9bbdbd, 0.4).lineBetween(95, 99, 1505, 99).lineBetween(95, 961, 1505, 961);
    for (let i = 0; i < 7; i++) {
      const x = 190 + i * 204;
      this.add.text(x, 87, i % 2 ? 'PLAY THE POSSIBILITIES' : 'QUBIT FC', { fontFamily: FONT, fontSize: '12px', color: i % 2 ? '#7896a1' : '#b8d6da', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5);
      this.add.text(x, 974, i % 2 ? 'H Z H = X' : 'EVERY PASS IS A GATE', { fontFamily: FONT, fontSize: '12px', color: '#8eafb8', fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5);
    }
    this.add.text(PITCH.cx, PITCH.cy + 160, 'Q U B I T   F C', { fontFamily: FONT, fontSize: '30px', color: '#9ebdaa', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.11);
  }

  createPlayer(player) {
    const color = COLORS[player.team];
    const shadow = this.add.ellipse(2, 8, 48, 28, 0x031715, 0.42);
    const outer = this.add.circle(0, 0, 24, 0x0b2731).setStrokeStyle(2, color, 0.85);
    const body = this.add.circle(0, -1, 19, color).setStrokeStyle(2, 0xffffff, 0.45);
    const highlight = this.add.arc(-3, -4, 13, 205, 300, false, 0xffffff, 0).setStrokeStyle(2.5, 0xffffff, 0.5);
    const notch = this.add.triangle(0, 0, 22, -5, 30, 0, 22, 5, 0xf4fff5);
    const glyph = this.add.text(0, -2, player.gate === 'RESET' ? '↺' : player.gate, { fontFamily: FONT, fontSize: player.gate === 'RESET' ? '28px' : '27px', color: '#102837', fontStyle: 'bold' }).setOrigin(0.5);
    const arrow = this.add.triangle(0, -46, -7, -5, 7, -5, 0, 5, color).setStrokeStyle(1, 0xffffff, 0.8);
    const label = this.add.text(0, -68, `${player.team ? 'P2' : 'P1'}  ${player.gate === 'RESET' ? 'GK' : player.gate}`, { fontFamily: FONT, fontSize: '19px', color: HEX[player.team], fontStyle: 'bold', stroke: '#0b1c29', strokeThickness: 4 }).setOrigin(0.5);
    const container = this.add.container(player.x, player.y, [shadow, outer, body, highlight, notch, glyph, arrow, label]).setDepth(8);
    const bars = this.add.graphics().setDepth(9);
    const view = { container, body, glyph, arrow, label, notch, shadow, bars };
    this.playerViews.set(player.id, view);
    return view;
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.controller.tick(dt);
    const match = this.controller.match;
    if (!match) return;
    this.renderPlayers(match, time);
    this.renderBall(match, time);
    this.renderLocks(match);
    this.renderCamera(match, dt);
    this.renderFeedback(dt);
    if (time - this.lastHud > 50) {
      this.lastHud = time;
      this.controller.ui.update(match, dt);
      drawBloch(this.controller.ui.blochCanvas, match, this.controller.options?.expert);
      drawRadar(this.controller.ui.radarCanvas, match);
    }
  }

  renderPlayers(match, time) {
    this.dynamic.clear();
    this.passLabel.setVisible(false);
    for (const player of match.players) {
      const view = this.playerViews.get(player.id) || this.createPlayer(player);
      const selected = match.controlled[player.team] === player.id && this.controller.mode === 'match';
      view.container.setPosition(player.x, player.y);
      view.notch.setRotation(Math.atan2(player.fy, player.fx));
      view.arrow.setVisible(selected);
      view.label.setVisible(selected);
      const isAi = match.aiTeams.has(player.team);
      view.label.setText(`${isAi ? 'CPU' : player.team ? 'P2' : 'P1'}  ${player.gate === 'RESET' ? 'GK' : player.gate}`);
      view.arrow.y = -45 + (this.controller.reducedMotion ? 0 : Math.sin(time * 0.005) * 2);
      const run = !this.controller.reducedMotion && Math.hypot(player.vx, player.vy) > 20 ? Math.sin(time * 0.018 + player.id) * 0.035 : 0;
      view.body.setScale(1 + run, 1 - run);
      if (player.dive > 0) view.container.setScale(1.13, 0.77);
      else view.container.setScale(1);
      view.bars.clear();
      if (selected) {
        this.dynamic.lineStyle(2, COLORS[player.team], 0.5).strokeCircle(player.x, player.y, 30);
        view.bars.fillStyle(0x09212a, 0.86).fillRoundedRect(player.x - 29, player.y + 37, 58, 6, 3);
        const chance = match.shotChance(player.team);
        view.bars.fillStyle(chance >= 0.8 ? 0xb4efad : chance < 0.3 ? 0xff866d : 0xf4d38c).fillRoundedRect(player.x - 28, player.y + 38, 56 * chance, 4, 2);
        if (player.charge > 0) {
          view.bars.fillStyle(0x09212a, 0.86).fillRoundedRect(player.x - 29, player.y + 47, 58, 7, 3);
          view.bars.fillStyle(COLORS[player.team]).fillRoundedRect(player.x - 28, player.y + 48, 56 * player.charge, 5, 2);
        }
      }
    }
    const owner = match.player(match.ball.owner);
    if (owner && this.controller.mode === 'match') {
      const target = match.bestPass(owner);
      if (target) {
        const dx = target.x - owner.x, dy = target.y - owner.y, length = Math.hypot(dx, dy);
        this.dynamic.lineStyle(1.5, COLORS[owner.team], 0.27);
        for (let d = 45; d < length - 35; d += 22) this.dynamic.lineBetween(owner.x + dx * d / length, owner.y + dy * d / length, owner.x + dx * (d + 8) / length, owner.y + dy * (d + 8) / length);
        this.dynamic.lineStyle(2, COLORS[owner.team], 0.55).strokeCircle(target.x, target.y, 32);
        const preview = match.passPreview?.(owner);
        if (preview) this.passLabel.setPosition(target.x, target.y + 49).setText(`${preview.gate === 'RESET' ? 'Reset' : preview.gate} · ${Math.round(preview.after * 100)}%`).setVisible(true);
        const route = preview?.split?.route;
        if (route && !match.options.drill && match.splitCooldown[owner.team] <= 0) {
          for (let path = 0; path < 2; path++) {
            this.dynamic.lineStyle(1.5, path ? 0xc1baff : 0x81e6ff, 0.24);
            for (let sample = 1; sample < 32; sample += 2) {
              const a = splitLanePosition(route, path, sample / 32), b = splitLanePosition(route, path, (sample + 1) / 32);
              this.dynamic.lineBetween(a.x, a.y, b.x, b.y);
            }
          }
          this.dynamic.lineStyle(1.5, 0xf4d38c, 0.5).strokeCircle(route.merge.x, route.merge.y, 9);
        }
      }
      if (match.pressure > 0.1) {
        this.dynamic.lineStyle(2, 0xffaf92, 0.18 + match.pressure * 0.22).strokeCircle(owner.x, owner.y, 43 + Math.sin(time * 0.01) * 4);
      }
    }
  }

  renderBall(match, time) {
    const ball = match.ball;
    const split = ball.mode === 'split' ? ball.split : null;
    this.ballView.setVisible(!split);
    this.ballShadow.setVisible(!split);
    this.splitPaths.clear();
    this.splitViews.forEach(view => view.setVisible(Boolean(split)));
    this.portLabels.forEach(label => label.setVisible(false));
    if (split) {
      this.renderSplit(match, split, time);
      this.ballRing.clear(); this.trail.clear(); this.trailPoints.length = 0;
      return;
    }
    this.activeSplit = null;
    const length = stateLength(ball.state);
    const color = this.controller.options?.expert ? (ball.state.z > 0.2 ? 0x81e6ff : ball.state.z < -0.2 ? 0xff866d : 0xc1baff) : quantumColor(ball.state);
    const height = ball.height || (ball.mode === 'shot' ? Math.sin(Math.min(ball.age * 3, Math.PI)) * 7 : 0);
    this.ballView.setPosition(ball.x, ball.y - height).setRotation(ball.age * 7);
    this.ballShadow.setPosition(ball.x + height * 0.3, ball.y + 7).setScale(1 + height / 40).setAlpha(0.5 - height * 0.004);
    const ring = this.ballRing;
    ring.clear();
    ring.lineStyle(6, color, 0.07).strokeCircle(ball.x, ball.y - height, 20);
    ring.lineStyle(2.5, color, 0.9).beginPath().arc(ball.x, ball.y - height, 15, -Math.PI / 2, -Math.PI / 2 + Math.max(0.05, length) * Math.PI * 2).strokePath();
    if (length < 0.95) {
      ring.lineStyle(1, 0xdce9e5, (1 - length) * 0.4).strokeCircle(ball.x, ball.y - height, 24 + Math.sin(time * 0.017) * 3);
      for (let i = 0; i < 5; i++) {
        const angle = time * 0.003 + i * 1.25;
        ring.fillStyle(0xf9fff6, (1 - length) * 0.6).fillCircle(ball.x + Math.cos(angle) * 22, ball.y + Math.sin(angle) * 22 - height, 1.3);
      }
    }
    if (Math.hypot(ball.vx, ball.vy) > 100 && ball.owner === null) {
      this.trailPoints.unshift({ x: ball.x, y: ball.y - height });
      if (this.trailPoints.length > 10) this.trailPoints.pop();
    } else this.trailPoints.pop();
    this.trail.clear();
    for (let i = 1; i < this.trailPoints.length; i++) {
      this.trail.lineStyle(ball.mode === 'shot' ? 4 : 2, color, 0.3 * (1 - i / this.trailPoints.length));
      this.trail.lineBetween(this.trailPoints[i - 1].x, this.trailPoints[i - 1].y, this.trailPoints[i].x, this.trailPoints[i].y);
    }
  }

  renderSplit(match, split, time) {
    if (this.activeSplit !== split) { this.splitTrails = [[], []]; this.activeSplit = split; }
    const g = this.splitPaths;
    for (let path = 0; path < 2; path++) {
      const lane = split.lanes[path];
      const color = path ? 0xc1baff : 0x81e6ff;
      this.splitViews[path].setPosition(lane.x, lane.y - 6);
      const points = this.splitTrails[path];
      points.unshift({ x: lane.x, y: lane.y - 6 });
      if (points.length > 22) points.pop();
      for (let i = 1; i < points.length; i++) {
        g.lineStyle(3, color, 0.45 * (1 - i / points.length));
        g.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
      }
      g.lineStyle(1, color, 0.35).strokeCircle(lane.x, lane.y - 6, 19 + (this.controller.reducedMotion ? 0 : Math.sin(time * 0.008) * 2));
    }
    // The two ghosts belong to one state; the connecting line makes that readable.
    g.lineStyle(1, 0xd4d6ff, 0.16).lineBetween(split.lanes[0].x, split.lanes[0].y - 6, split.lanes[1].x, split.lanes[1].y - 6);
    const forecast = split.forecast;
    for (let port = 0; port < 2; port++) {
      const receiver = match.player(port ? split.outlet : split.target);
      if (!receiver) continue;
      const chance = forecast?.probabilities?.[port];
      g.lineStyle(2, port ? 0xc1baff : 0xf4d38c, 0.6).strokeCircle(receiver.x, receiver.y, 35);
      this.portLabels[port].setPosition(receiver.x, receiver.y + 51).setText(`${port ? 'Outlet' : 'Receiver'}${Number.isFinite(chance) ? ` · ${Math.round(chance * 100)}%` : ''}`).setVisible(true);
    }
  }

  renderLocks(match) {
    for (let side = 0; side < 2; side++) {
      const team = match.ownGoalX(0) === (side ? PITCH.right : PITCH.left) ? 0 : 1;
      const lock = match.locks[team];
      const axis = match.lockVector(team);
      const view = this.lockViews[side];
      view.disc.setStrokeStyle(2, COLORS[team], lock.frozen ? 0.35 : 0.8);
      const x = view.x, y = PITCH.cy;
      const ex = axis.x * 18, ey = -axis.z * 18;
      view.axis.clear().lineStyle(3, COLORS[team], 0.95).lineBetween(x - ex * 0.4, y - ey * 0.4, x + ex, y + ey);
      const angle = Math.atan2(ey, ex);
      view.axis.fillStyle(COLORS[team], 1).fillTriangle(x + ex, y + ey, x + ex - Math.cos(angle - 0.5) * 9, y + ey - Math.sin(angle - 0.5) * 9, x + ex - Math.cos(angle + 0.5) * 9, y + ey - Math.sin(angle + 0.5) * 9);
      const name = basis => basis === 'Z' ? lock.sign === -1 ? '|1〉' : '|0〉' : lock.sign === -1 ? '|−〉' : '|+〉';
      view.label.setText(lock.target ? `${name(lock.basis)} → ${name(lock.target)}` : name(lock.basis));
      view.label.setColor(HEX[team]);
    }
  }

  renderCamera(match, dt) {
    const camera = this.cameras.main;
    const width = this.scale.width, height = this.scale.height;
    const viewWidth = this.controller.mode === 'match' && width >= 1150 ? width - 250 : width;
    camera.setViewport(0, 0, viewWidth, height);
    const zoom = Math.min(viewWidth / (viewWidth < width ? 1720 : 1660), height / 1110) * (viewWidth === width && width > 1000 ? 1.08 : 1.01);
    camera.setZoom(zoom);
    const offset = this.controller.mode === 'menu' && width > 1000 ? -130 : 0;
    const targetX = PITCH.cx + (match.ball.x - PITCH.cx) * 0.17 + offset;
    const targetY = PITCH.cy + (match.ball.y - PITCH.cy) * 0.11 + 12;
    const smooth = 1 - Math.exp(-dt * 3.5);
    this.cameraX += (targetX - this.cameraX) * smooth;
    this.cameraY += (targetY - this.cameraY) * smooth;
    camera.centerOn(this.cameraX, this.cameraY);
  }

  event(event) {
    const reduced = this.controller.reducedMotion;
    const color = event.team === undefined ? 0xf4f6ef : COLORS[event.team];
    if (event.type === 'gate' || event.type === 'laneGate') {
      const view = this.playerViews.get(event.player);
      if (view && !reduced) this.tweens.add({ targets: view.glyph, scaleX: 1.4, scaleY: 1.4, duration: 110, yoyo: true, ease: 'Back.Out' });
      const gateText = event.gate === 'S' ? 'S · phase +90°' : event.gate === 'S†' ? 'S† · phase −90°' : event.gate === 'T' ? 'T · phase +45°' : `${event.gate} gate`;
      this.floatingText(event.x, event.y - 40, event.gate === 'RESET' ? '|0〉 reset' : `${gateText}${event.type === 'laneGate' ? ` · lane ${event.path ? 'B' : 'A'}` : ''}`, HEX[event.team], 23);
      this.burst(event.x, event.y, color, reduced ? 3 : 9, 80);
    }
    if (event.type === 'tackle' || event.type === 'reset') this.burst(event.x, event.y, color, reduced ? 3 : 12, 105);
    if (event.type === 'tackle') this.floatingText(event.x, event.y - 38, 'COLLAPSE', '#f4d38c', 20);
    if (event.type === 'split') {
      this.burst(event.x, event.y, 0xc1baff, reduced ? 4 : 15, 95);
      this.floatingText(event.x, event.y - 40, 'TWO PATHS · ONE BALL', '#c1baff', 22);
    }
    if (event.type === 'recombine') {
      this.burst(event.x, event.y, event.port ? 0xc1baff : 0xf4d38c, reduced ? 5 : 20, 110);
      this.floatingText(event.x, event.y - 40, event.port ? 'INTERFERENCE · OUTLET' : 'INTERFERENCE · RECEIVER', event.port ? '#c1baff' : '#f4d38c', 22);
    }
    if (event.type === 'pathCollapse') {
      this.burst(event.x, event.y, 0xd2d9e7, reduced ? 4 : 12, 95);
      this.floatingText(event.x, event.y - 40, event.caught ? 'PATH MEASURED · INTERCEPTED' : 'PATH MEASURED · OTHER LANE', '#f4d38c', 21);
    }
    if (event.type === 'rebound') this.floatingText(event.x, event.y - 48, 'COLLAPSED · REBOUND', '#dae4eb', 23);
    if (event.type === 'targets' && !this.controller.match.options.drill) this.controller.ui.toast('New goal targets · Check the glyphs before your next attack');
    if (event.type === 'save') {
      this.floatingText(event.x, event.y - 45, 'SAVED · RESET', '#f4f6ef', 25);
      if (!reduced) this.cameras.main.shake(100, 0.0018);
    }
    if (event.type === 'goal') {
      this.netPulse[event.x > PITCH.cx ? 1 : 0] = 1;
      this.burst(event.x, event.y, color, reduced ? 12 : 48, 240);
      if (!reduced) this.cameras.main.shake(350, 0.004);
    }
    if (event.type === 'miss') {
      this.burst(event.x, event.y, 0xd2d9e7, reduced ? 5 : 17, 125);
      if (event.reason === 'wide') this.floatingText(event.x, event.y - 48, 'WIDE · PLAY ON', '#dae4eb', 25);
    }
  }

  floatingText(x, y, text, color = '#f4f6ef', size = 23) {
    if (this.controller.mode === 'menu') return;
    const label = this.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#0b1c29', strokeThickness: 3 }).setOrigin(0.5).setDepth(18);
    this.tweens.add({ targets: label, y: y - (this.controller.reducedMotion ? 5 : 28), alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => label.destroy() });
  }

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.3 + Math.random() * 0.7);
      const dot = this.add.circle(x, y, 1.5 + Math.random() * 2, color).setDepth(17);
      this.fx.push({ dot, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: 0.6, age: 0 });
    }
  }

  renderFeedback(dt) {
    this.netGlow.clear();
    for (let side = 0; side < 2; side++) {
      const pulse = this.netPulse[side];
      if (pulse < 0.01) continue;
      this.netPulse[side] *= Math.exp(-dt * 5);
      const goalX = side ? PITCH.right : PITCH.left, sign = side ? 1 : -1;
      const stretch = this.controller.reducedMotion ? 0 : pulse * 20;
      this.netGlow.lineStyle(1.5, 0xf4f6ef, pulse * 0.7);
      for (let row = 0; row <= 11; row++) {
        const y = PITCH.cy - 110 + row * 20;
        const back = goalX + sign * (43 + Math.sin(row / 11 * Math.PI) * stretch);
        this.netGlow.lineBetween(goalX, y, back, y);
      }
      for (let col = 1; col <= 4; col++) {
        this.netGlow.beginPath();
        for (let row = 0; row <= 11; row++) {
          const y = PITCH.cy - 110 + row * 20;
          const x = goalX + sign * col / 4 * (43 + Math.sin(row / 11 * Math.PI) * stretch);
          if (row === 0) this.netGlow.moveTo(x, y); else this.netGlow.lineTo(x, y);
        }
        this.netGlow.strokePath();
      }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const fx = this.fx[i];
      fx.age += dt;
      fx.dot.x += fx.vx * dt; fx.dot.y += fx.vy * dt;
      fx.vx *= Math.exp(-dt * 2.5); fx.vy *= Math.exp(-dt * 2.5);
      fx.dot.setAlpha(1 - fx.age / fx.life);
      if (fx.age >= fx.life) { fx.dot.destroy(); this.fx.splice(i, 1); }
    }
  }
}

function canvasContext(canvas) {
  if (!canvas || !canvas.isConnected) return null;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return null;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(bounds.width * ratio), h = Math.round(bounds.height * ratio);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, bounds.width, bounds.height);
  return { ctx, width: bounds.width, height: bounds.height };
}

export function drawBloch(canvas, match, expert = false) {
  const c = canvasContext(canvas);
  if (!c) return;
  const { ctx, width, height } = c;
  const cx = width / 2, cy = height / 2, r = Math.min(width, height) * 0.345;
  const project = (x, y, z) => ({ x: cx + r * (x * 0.9 - y * 0.4), y: cy + r * (-z * 0.96 - y * 0.2) });
  const background = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
  background.addColorStop(0, 'rgba(129,230,255,.08)'); background.addColorStop(1, 'rgba(129,230,255,.015)');
  ctx.fillStyle = background; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(174,214,224,.25)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.28, -0.1, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.35, r, -0.1, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(174,214,224,.18)';
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
  ctx.font = `600 15px "Barlow Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#afc8d2';
  ctx.fillText('|0〉', cx, cy - r - 8); ctx.fillText('|1〉', cx, cy + r + 21);
  ctx.textAlign = 'left'; ctx.fillText('|+〉', cx + r + 5, cy + 4);
  ctx.textAlign = 'right'; ctx.fillText('|−〉', cx - r - 5, cy + 4);
  const lock = match.lockVector(1 - (match.ball.lastTeam ?? 0));
  const lockPoint = project(lock.x, lock.y, lock.z);
  ctx.strokeStyle = '#f4d38c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(lockPoint.x, lockPoint.y, 5.5, 0, Math.PI * 2); ctx.stroke();
  const state = match.ball.state;
  const point = project(expert ? 0 : state.x, expert ? 0 : state.y, state.z);
  const color = '#' + quantumColor(state).toString(16).padStart(6, '0');
  ctx.strokeStyle = expert ? '#81e6ff' : color;
  ctx.lineWidth = 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(point.x, point.y); ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  const angle = Math.atan2(point.y - cy, point.x - cx);
  if (Math.hypot(point.x - cx, point.y - cy) > 4) {
    ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(point.x - Math.cos(angle - 0.45) * 9, point.y - Math.sin(angle - 0.45) * 9); ctx.lineTo(point.x - Math.cos(angle + 0.45) * 9, point.y - Math.sin(angle + 0.45) * 9); ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  if (expert) { ctx.font = `600 13px "Barlow Condensed", sans-serif`; ctx.fillStyle = '#afc8d2'; ctx.textAlign = 'center'; ctx.fillText('Phase hidden', cx, height - 3); }
}

export function drawRadar(canvas, match) {
  const c = canvasContext(canvas);
  if (!c) return;
  const { ctx, width, height } = c;
  const pad = 8, w = width - pad * 2, h = height - pad * 2;
  const map = (p) => ({ x: pad + (p.x - PITCH.left) / 1400 * w, y: pad + (p.y - PITCH.top) / 860 * h });
  ctx.strokeStyle = 'rgba(194,220,217,.25)'; ctx.lineWidth = 1;
  ctx.strokeRect(pad, pad, w, h); ctx.beginPath(); ctx.moveTo(width / 2, pad); ctx.lineTo(width / 2, height - pad); ctx.stroke();
  ctx.beginPath(); ctx.arc(width / 2, height / 2, h * 0.12, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(pad, height / 2 - h * 0.24, w * 0.16, h * 0.48);
  ctx.strokeRect(width - pad - w * 0.16, height / 2 - h * 0.24, w * 0.16, h * 0.48);
  for (const player of match.players) {
    const p = map(player);
    ctx.fillStyle = HEX[player.team]; ctx.beginPath(); ctx.arc(p.x, p.y, 2.9, 0, Math.PI * 2); ctx.fill();
    if (match.controlled[player.team] === player.id) { ctx.strokeStyle = HEX[player.team]; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke(); }
  }
  const b = map(match.ball); ctx.fillStyle = '#f4f6ef'; ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill();
}

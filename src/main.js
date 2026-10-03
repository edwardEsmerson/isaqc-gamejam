import Phaser from 'phaser';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/900.css';
import './style.css';
import { Match } from './game/simulation.js';
import { PitchScene } from './game/scene.js';
import { GameUI } from './ui.js';
import { InputManager } from './input.js';
import { MatchAudio } from './audio.js';

const input = new InputManager();
const audio = new MatchAudio();
const controller = {
  scene: null,
  ui: null,
  match: new Match({ aiTeams: [0, 1], halfDuration: 60 }),
  mode: 'menu',
  paused: false,
  options: { expert: false },
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ready() { this.ui.showTitle(); },
  tick(dt) {
    const global = input.consumeGlobalActions();
    const joins = input.consumeJoinEvents();
    if (this.mode === 'menu' && this.ui.screen === 'join') {
      for (const pad of joins) {
        if (input.assignedPads.includes(pad.index)) continue;
        const team = input.assignedPads.findIndex(index => index === null);
        if (team !== -1 && input.assignPad(team, pad.index)) this.ui.setJoined(team, `Controller ${pad.index + 1}`);
      }
    }
    if (this.ui.isMenu && this.ui.screen !== 'join' && joins.length > 0) global.confirm = true;
    if (global.pause && this.mode === 'match' && !['halftime', 'fulltime'].includes(this.match.phase)) {
      if (this.paused) resume(); else pause();
    }
    if (global.confirm && this.ui.isMenu) {
      const focused = document.activeElement;
      // Keyboard Enter activates focused native buttons itself. Controller A uses this route.
      if (input.lastDevice === 'gamepad' || !['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(focused?.tagName)) {
        const overlay = document.querySelector('#ui .overlay:not([hidden])');
        const button = overlay?.querySelector('.primary') || overlay?.querySelector('[data-action="start"]') || overlay?.querySelector('button');
        if (button && !button.disabled) button.click();
      }
    }
    const sample = input.sample();
    if (this.mode === 'menu') {
      this.match.update(dt, []);
      this.match.drainEvents();
      if (this.match.phase === 'halftime') this.match.continueHalf();
      if (this.match.phase === 'fulltime') this.match = new Match({ aiTeams: [0, 1], halfDuration: 60 });
    } else if (!this.paused) {
      this.match.update(dt, sample);
      const events = this.match.drainEvents();
      const ending = events.some(event => event.type === 'halftime' || event.type === 'fulltime');
      if (ending) audio.stop();
      for (const event of events) {
        if (!(ending && event.type === 'whistle') && (event.type !== 'measure' || event.result === null)) audio.play(event.type, event);
        this.scene.event(event);
        if (event.type === 'goal') this.ui.showGoal?.(event.team, this.match.score);
        if (event.type === 'measure') this.ui.showMeasurement?.({ success: event.result, chance: event.probability, team: event.team });
        if (event.type === 'miss' && event.reason === 'measurement') this.ui.showMeasurement?.({ success: false, chance: event.probability, team: event.team });
        if (event.type === 'halftime') { this.ui.showHalftime(this.match); input.setActive(false); }
        if (event.type === 'fulltime') { this.ui.showFulltime(this.match); input.setActive(false); }
      }
      const goalDistance = Math.abs(this.match.opposingGoalX(this.match.ball.lastTeam) - this.match.ball.x);
      audio.setIntensity(Math.max(0.05, 1 - goalDistance / 1100));
    }
  },
};

function startMatch(options = {}) {
  controller.options = options;
  controller.match = new Match(options);
  controller.match.drainEvents(); // Initial kickoff whistle is played after the audio unlock below.
  controller.mode = 'match';
  controller.paused = false;
  input.setActive(true);
  input.clear();
  controller.ui.hideOverlay();
  if (options.aiTeams?.includes(1) && input.assignedPads[0] === null) {
    const pad = input.getGamepads().find(p => !input.assignedPads.includes(p.index));
    if (pad) input.assignPad(0, pad.index);
  }
  audio.unlock().then(unlocked => { if (unlocked && controller.mode === 'match' && !controller.paused) audio.play('whistle'); });
  controller.ui.toast(options.aiTeams?.length === 2 ? 'Spectator match · Pause to return to the menu' : 'Kickoff · Aim a pass toward H to change your state');
  if (controller.scene) controller.scene.trailPoints = [];
}

function pause() {
  if (controller.mode !== 'match' || controller.paused) return;
  controller.paused = true;
  input.setActive(false);
  audio.stop();
  controller.ui.showPause();
}

function resume() {
  controller.paused = false;
  input.setActive(true);
  controller.ui.hideOverlay();
  audio.unlock();
}

function menu() {
  controller.mode = 'menu';
  controller.paused = false;
  controller.match = new Match({ aiTeams: [0, 1], halfDuration: 60 });
  input.setActive(false);
  input.clearAssignments();
  audio.stop();
  controller.ui.joinedTeams = ['Keyboard', 'Keyboard'];
  controller.ui.showTitle();
}

controller.ui = new GameUI(document.getElementById('ui'), {
  onStart: startMatch,
  onKeyboard: team => { input.assignedPads[team] = null; input.clear(); },
  onPause: pause,
  onResume: resume,
  onMenu: menu,
  onContinue: () => {
    controller.match.continueHalf();
    input.setActive(true);
    controller.ui.hideOverlay();
    audio.unlock();
  },
  onSound: enabled => { audio.setEnabled(enabled); if (enabled && controller.mode === 'match' && !controller.paused) audio.unlock(); },
  onMotion: enabled => { controller.reducedMotion = !enabled; },
  onFullscreen: async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { controller.ui.toast('Fullscreen is unavailable in this browser'); }
  },
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b1724',
  width: window.innerWidth,
  height: window.innerHeight,
  antialias: true,
  powerPreference: 'high-performance',
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [new PitchScene(controller)],
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  render: { roundPixels: false, pixelArt: false },
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && controller.mode === 'match' && !['halftime', 'fulltime'].includes(controller.match.phase)) pause();
});
window.addEventListener('blur', () => { if (controller.mode === 'match' && !['halftime', 'fulltime'].includes(controller.match.phase)) pause(); });
window.addEventListener('pagehide', () => { input.destroy(); audio.destroy(); game.destroy(true); }, { once: true });

// Local development introspection for browser play checks; excluded from production builds.
if (import.meta.env.DEV) window.__qubitFC = { controller, input, audio, game, startMatch, pause, resume, menu };

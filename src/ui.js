const TEAMS = ['Qubit FC', 'Entangled FC'];
const fmt = value => String(Math.max(0, Math.floor(value))).padStart(2, '0');
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const icon = path => `<svg viewBox="0 0 24 24" aria-hidden="true" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const percent = value => `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
const lockName = (basis = 'Z', sign = 1) => basis === 'X'
  ? sign < 0 ? '|−〉 (−X)' : '|+〉 (+X)'
  : sign < 0 ? '|1〉 (−Z)' : '|0〉 (+Z)';
const gateDescription = gate => ({ H: 'H swaps north/south with front/back.', X: 'X flips north and south.', Z: 'Z rotates phase 180°.', S: 'S rotates phase +90°; north stays north.', 'S†': 'S† reverses S: phase −90°. S†S = I.', RESET: 'Keeper resets to fresh north.' }[gate] || 'Receiving the pass applies this gate.');
const keys = (team, compact = false) => team === 0
  ? `<span class="control-line"><kbd>W A S D</kbd> Move <kbd>F</kbd> Pass <kbd>G</kbd> Shoot${compact ? '' : ' <kbd>Q</kbd> Split'}</span><span class="control-line ${compact ? 'secondary-controls' : ''}"><kbd>H</kbd> Switch / press <kbd>R</kbd> Reading <kbd>⇧</kbd> Sprint</span>`
  : `<span class="control-line"><kbd>↑ ← ↓ →</kbd> Move <kbd>K</kbd> Pass <kbd>L</kbd> Shoot${compact ? '' : ' <kbd>O</kbd> Split'}</span><span class="control-line ${compact ? 'secondary-controls' : ''}"><kbd>J</kbd> Switch / press <kbd>U</kbd> Reading <kbd>⇧</kbd> Sprint</span>`;

export class GameUI {
  constructor(root, callbacks = {}) {
    this.root = root; this.callbacks = callbacks; this.screen = 'title'; this.isMenu = true;
    this.joinedTeams = ['Keyboard', 'Keyboard']; this.pendingOptions = { aiTeams: [] }; this.pads = [null, null];
    this.settings = { halfDuration: 180, expert: false, sound: true, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('qubit-fc-settings') || '{}')); } catch { /* Storage is optional. */ }
    this.settings.halfDuration = this.settings.halfDuration === 60 ? 60 : 180;
    root.innerHTML = `<div class="hud" hidden>
      <div class="scoreboard" aria-label="Match scoreboard"><div class="scorebox"><span class="team-label">QFC</span><strong id="score-0">0</strong></div><div class="scorebox"><span class="team-label">ENT</span><strong id="score-1">0</strong></div><div class="clock"><span id="half-label">1st half</span><strong id="match-clock">00:00</strong></div></div>
      <div class="match-tools"><button data-action="pause" aria-label="Pause match">${icon('<path d="M9 5v14M15 5v14"/>')}<span>Pause</span></button><button data-action="sound" aria-label="Toggle sound" aria-pressed="true">${icon('<path d="M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>')}</button><button data-action="fullscreen" aria-label="Toggle fullscreen">${icon('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>')}</button></div>
      <div class="reading-strip"><span id="reading-0">QFC net <strong>|0〉 (+Z)</strong></span><span id="reading-1">ENT net <strong>|0〉 (+Z)</strong></span></div>
      <aside class="quantum-panel" aria-label="Ball quantum state"><div class="quantum-heading"><span>State strength</span><span id="coherence-value" class="coherence-value">100%</span></div><div class="quantum-subtitle">Arrow length = state strength · Gold ring = target</div><canvas id="bloch-canvas" aria-label="Bloch sphere with ball state and goal target"></canvas><div class="chance-labels"><span id="chance-label">QFC shot chance</span><strong id="chance-value">100%</strong></div><div class="chance-track"><div id="chance-fill" class="chance-fill" style="width:100%"></div></div><div id="gate-history" class="gate-history">Fresh state <span class="gate-chip">|0〉</span></div><div id="pass-preview" class="pass-preview" hidden><div id="pass-preview-name" class="pass-preview-name"></div><div id="pass-preview-detail" class="pass-preview-detail"></div><div id="split-preview" class="split-preview" hidden></div></div><div id="split-forecast" class="split-forecast" hidden><div class="pass-preview-name">One ball · two paths</div><div id="split-outcomes" class="split-outcomes"></div><div id="split-lane-hint" class="split-lane-hint">Switch player to steer a gate into a lane.</div></div></aside>
      <div id="drill-instruction" class="drill-instruction" hidden aria-label="Gate drill instructions"><div class="drill-heading"><strong>Gate drill</strong><span id="drill-stage"></span></div><div id="drill-route" class="drill-route"></div><div id="drill-next" class="drill-next"></div><div id="drill-explanation" class="drill-explanation"></div></div>
      <div class="control-rail p1-controls"><strong id="control-label-0">P1 · Qubit FC</strong><div id="control-keys-0">${keys(0, true)}</div><div id="split-status-0" class="split-control"><kbd>Q</kbd> Split ready</div></div><div class="control-rail p2-controls"><strong id="control-label-1">P2 · Entangled FC</strong><div id="control-keys-1">${keys(1, true)}</div><div id="split-status-1" class="split-control"><kbd>O</kbd> Split ready</div></div>
      <div class="radar-panel"><canvas id="radar-canvas" aria-label="Pitch radar showing both teams and the ball"></canvas></div>
    </div><div class="overlay" hidden></div><div class="match-flash" hidden aria-live="polite"></div><div class="toast" hidden role="status"></div><div class="portrait-hint">Turn your screen sideways · Keyboard or controllers required</div>`;
    this.hud = root.querySelector('.hud'); this.overlay = root.querySelector('.overlay');
    this.blochCanvas = root.querySelector('#bloch-canvas'); this.radarCanvas = root.querySelector('#radar-canvas');
    this.flash = root.querySelector('.match-flash'); this.toastElement = root.querySelector('.toast');
    this.nodes = Object.fromEntries([...root.querySelectorAll('[id]')].map(node => [node.id, node]));
    root.addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (button && !button.disabled) this.action(button.dataset.action, button.dataset.team); });
    root.addEventListener('change', event => this.changeSetting(event.target));
    callbacks.onSound?.(this.settings.sound); callbacks.onMotion?.(!this.settings.reducedMotion);
    this.applySettings();
  }

  getSettings() { return { ...this.settings }; }
  setDevices(pads) { this.pads = pads; }
  applySettings() {
    this.root.classList.toggle('reduced-motion', this.settings.reducedMotion);
    this.root.querySelector('[data-action="sound"]').setAttribute('aria-pressed', String(this.settings.sound));
    try { localStorage.setItem('qubit-fc-settings', JSON.stringify(this.settings)); } catch { /* Storage is optional. */ }
  }
  optionsMarkup() {
    return `<div class="options-row"><label>Match length <select data-setting="halfDuration" aria-label="Match length"><option value="180" ${this.settings.halfDuration === 180 ? 'selected' : ''}>3-minute halves</option><option value="60" ${this.settings.halfDuration === 60 ? 'selected' : ''}>Showcase · 1-minute halves</option></select></label><label class="toggle"><input type="checkbox" data-setting="expert" ${this.settings.expert ? 'checked' : ''}> Expert · hide phase</label><label class="toggle"><input type="checkbox" data-setting="sound" ${this.settings.sound ? 'checked' : ''}> Stadium sound</label><label class="toggle"><input type="checkbox" data-setting="reducedMotion" ${this.settings.reducedMotion ? 'checked' : ''}> Reduce motion</label></div>`;
  }
  changeSetting(input) {
    const key = input.dataset.setting; if (!key) return;
    this.settings[key] = key === 'halfDuration' ? Number(input.value) : input.checked;
    if (key === 'sound') this.callbacks.onSound?.(this.settings.sound);
    if (key === 'reducedMotion') this.callbacks.onMotion?.(!this.settings.reducedMotion);
    this.applySettings();
  }
  action(action, team) {
    if (action === 'join') this.showJoin();
    if (action === 'practice') this.showHowto({ aiTeams: [1] });
    if (action === 'drill') this.callbacks.onDrill?.({ ...this.getSettings(), aiTeams: [], drill: true });
    if (action === 'drill-practice') this.start({ aiTeams: [1], drill: false });
    if (action === 'drill-local') { this.callbacks.onMenu?.(); this.showJoin(); }
    if (action === 'watch') this.start({ aiTeams: [0, 1] });
    if (action === 'howto-local') this.showHowto({ aiTeams: [] });
    if (action === 'start') this.start(this.pendingOptions);
    if (action === 'back-join') this.pendingOptions.aiTeams.length ? this.showTitle() : this.showJoin();
    if (action === 'title') this.showTitle();
    if (action === 'keyboard') { this.setJoined(Number(team), 'Keyboard'); this.callbacks.onKeyboard?.(Number(team)); }
    if (action === 'pause') this.callbacks.onPause?.();
    if (action === 'resume') this.callbacks.onResume?.();
    if (action === 'menu') this.callbacks.onMenu?.();
    if (action === 'continue') this.callbacks.onContinue?.();
    if (action === 'rematch') this.start(this.lastOptions || { aiTeams: [] });
    if (action === 'sound') { this.settings.sound = !this.settings.sound; this.callbacks.onSound?.(this.settings.sound); this.applySettings(); this.toast(`Stadium sound ${this.settings.sound ? 'on' : 'off'}`); }
    if (action === 'fullscreen') this.callbacks.onFullscreen?.();
  }
  start(options) {
    this.lastOptions = { ...options, ...this.getSettings(), aiTeams: options.aiTeams || [] };
    this.callbacks.onStart?.(this.lastOptions);
  }
  show(screen, html, title = false) {
    this.screen = screen; this.isMenu = true; this.overlay.hidden = false;
    this.overlay.className = `overlay ${title ? 'title-screen' : ''}`;
    this.overlay.innerHTML = html; this.flash.hidden = true; clearTimeout(this.flashTimer);
    if (['title', 'join', 'howto'].includes(screen)) this.hud.hidden = true;
    this.toastElement.hidden = true;
    this.overlay.scrollTop = 0;
  }
  hideOverlay() {
    this.screen = 'match'; this.isMenu = false; this.overlay.hidden = true; this.hud.hidden = false;
  }
  showTitle() {
    this.show('title', `<div class="title-panel"><div class="title-kicker">Six a side. Infinite possibilities.</div><h1 class="wordmark"><span>QUBIT</span><span class="fc">FC<span style="display:inline;color:var(--cyan)">.</span></span></h1><p class="title-description"><strong>Every pass is a quantum gate.</strong><br>Build your state. Beat the keeper.<br>Make the measurement.</p><div class="button-stack"><button class="primary" data-action="join">Kick off <span style="float:right;font-size:16px;margin-top:5px">2 players</span></button><button class="secondary" data-action="practice">Practice vs AI</button><button class="secondary" data-action="drill">Gate drill <span class="button-detail">Learn H → Z → H</span></button><button class="secondary" data-action="watch">Watch match</button></div><p class="title-note">Local football with a quantum ball.<br>Two controllers or one keyboard. No account, no waiting.</p></div><div class="title-footer">Move with WASD or arrows · Press A or Enter to begin<br>For the best view, play fullscreen in landscape.</div>`, true);
  }
  showJoin() {
    const cards = TEAMS.map((name, team) => `<div class="team-card"><div class="team-abbr">${team === 0 ? 'QFC · PLAYER 1' : 'ENT · PLAYER 2'}</div><div class="team-name">${name}</div><div class="join-state" id="join-${team}">${escape(this.joinedTeams[team])} ready</div><div class="gate-row" aria-label="Six-player roster: X, H, Z, S, S adjoint, keeper"><span>X</span><span>H</span><span>Z</span><span>S</span><span title="S adjoint · inverse of S">S†</span><span title="Keeper · reset">↺</span></div><p class="subtle">Press A on a controller to claim a team.</p><button class="secondary" style="min-height:28px;font-size:11px;padding:5px 9px" data-action="keyboard" data-team="${team}">Use keyboard</button></div>`).join('');
    this.show('join', `<section class="menu-panel"><div class="menu-top"><h2>Pick your side.</h2><button class="secondary" data-action="title">Back</button></div><p class="menu-intro">Two teams. One screen. Press A to join with a controller, or use the two keyboard layouts below.</p><div class="team-grid">${cards}</div>${this.optionsMarkup()}${this.controlsMarkup()}<div class="menu-actions"><button class="primary" data-action="howto-local">How to play &amp; kick off</button></div></section>`);
  }
  setJoined(team, label) {
    this.joinedTeams[team] = label;
    const node = this.root.querySelector(`#join-${team}`); if (node) node.textContent = `${label} ready`;
  }
  controlsMarkup() {
    return `<div class="controls-grid">${TEAMS.map((name, team) => `<div class="control-block"><h3>P${team + 1} · ${name}</h3><div class="keyboard-control">${keys(team)}</div></div>`).join('')}</div><p class="gamepad-controls">Controller: left stick move · A pass · hold B, release to shoot · X switch / press · Y keeper reading · LB split pass · RT sprint</p>`;
  }
  showHowto(options = {}) {
    this.pendingOptions = { aiTeams: [], ...options };
    this.show('howto', `<section class="menu-panel howto-panel"><div class="menu-top"><h2>Football. With a twist.</h2><button class="secondary" data-action="back-join">Back</button></div><p class="menu-intro">Getting past the keeper is half the challenge. Bring the ball in the right state when you shoot.</p><div class="instruction-grid split-guide">
      <article class="instruction"><div class="diagram"><svg viewBox="0 0 160 110"><circle cx="80" cy="53" r="42" fill="none" stroke="#81e6ff" opacity=".5"/><ellipse cx="80" cy="53" rx="42" ry="12" fill="none" stroke="#81e6ff" opacity=".3"/><ellipse cx="80" cy="53" rx="15" ry="42" fill="none" stroke="#81e6ff" opacity=".3"/><path d="M80 53 106 24m-13 4 13-4-3 13" stroke="#81e6ff" stroke-width="3" fill="none"/><circle cx="80" cy="53" r="3" fill="#81e6ff"/></svg></div><div class="instruction-number">1 · Build your state</div><h3 class="instruction-title">Passing is a circuit.</h3><p class="instruction-copy">Receiving a pass applies your shirt's gate. <strong>H</strong> swaps axes; <strong>Z</strong> rotates phase 180°. <strong>S</strong> rotates +90°; <strong>S†</strong> rotates −90°. S followed by S† cancels: <strong>S†S = I</strong>. <strong>H → Z → H</strong> flips north to south.</p></article>
      <article class="instruction"><div class="diagram"><svg viewBox="0 0 160 110"><rect x="15" y="19" width="130" height="72" fill="none" stroke="#bdd8df" stroke-width="2"/><path d="M15 37h130M15 55h130M15 73h130M41 19v72M67 19v72M93 19v72M119 19v72" stroke="#bdd8df" opacity=".2"/><circle cx="80" cy="55" r="21" fill="#0b1724" stroke="#f4d38c"/><path d="M80 68V42m-6 6 6-6 6 6" fill="none" stroke="#f4d38c" stroke-width="3"/></svg></div><div class="instruction-number">2 · Beat the reading</div><h3 class="instruction-title">Shooting is measuring.</h3><p class="instruction-copy">Net targets are <strong>|0〉 (+Z), |1〉 (−Z), |+〉 (+X), |−〉 (−X)</strong>. Each goal rerolls both targets. Keepers switch <strong>Z ↔ X</strong> in two seconds; it freezes in the box. Align for 100%. A rejected shot collapses and rebounds.</p></article>
      <article class="instruction"><div class="diagram"><svg viewBox="0 0 160 110"><circle cx="80" cy="53" r="42" fill="none" stroke="#ff866d" opacity=".3" stroke-dasharray="4 4"/><path d="M80 53 95 39m-10 1 10-1-1 10" fill="none" stroke="#ff866d" stroke-width="3"/><circle cx="28" cy="62" r="14" fill="#ff866d"/><circle cx="127" cy="38" r="14" fill="#ff866d"/><circle cx="80" cy="53" r="3" fill="#ff866d"/></svg></div><div class="instruction-number">3 · Keep it moving</div><h3 class="instruction-title">Pressure drains strength.</h3><p class="instruction-copy">Nearby defenders shrink the arrow and pull your odds toward <strong>50%</strong>. Passing can't regrow it. Tackles collapse to north or south. Recycle through your <strong>keeper to reset</strong> to fresh north.</p></article>
      <article class="instruction"><div class="diagram"><svg viewBox="0 0 160 110"><path d="M16 55H35Q50 55 57 31H91Q105 31 117 55h27M35 55Q50 55 57 79H91Q105 79 117 55" fill="none" stroke="#81e6ff" stroke-width="2"/><circle cx="17" cy="55" r="7" fill="#fff"/><circle cx="72" cy="31" r="10" fill="#81e6ff" fill-opacity=".3" stroke="#81e6ff"/><circle cx="72" cy="79" r="10" fill="#81e6ff" fill-opacity=".3" stroke="#81e6ff"/><circle cx="143" cy="55" r="7" fill="#fff"/><text x="72" y="35" text-anchor="middle" fill="#fff" font-size="11" font-family="sans-serif">H</text><text x="72" y="83" text-anchor="middle" fill="#fff" font-size="11" font-family="sans-serif">Z</text></svg></div><div class="instruction-number">4 · Split the play</div><h3 class="instruction-title">Two paths. One ball.</h3><p class="instruction-copy">A <strong>split pass</strong> carries one ball down two paths. <strong>Switch player</strong> and steer a gate into a ghost lane to change the exit odds. Defenders measure a path: catch the ball, or it continues along the other path. Either exit produces a real ball.</p></article>
      </div><p class="guide-note">Keeper mind game: a full-strength ball aligned for 100% in one reading has 50% odds when the keeper switches to the other.</p>${this.optionsMarkup()}${this.controlsMarkup()}<div class="menu-actions guide-actions"><button class="secondary" data-action="start">Skip guide</button><button class="primary" data-action="start">${this.pendingOptions.aiTeams.length ? 'Start practice' : 'Kick off'}</button></div></section>`);
  }

  showPause() {
    this.show('pause', `<section class="menu-panel pause-panel"><h2 class="pause-title">Match paused.</h2><p class="subtle">Take a breath. Your state is safe.</p><div class="button-stack"><button class="primary" data-action="resume">Resume match</button><button class="secondary" data-action="menu">Return to title</button></div><div class="options-row"><label><input type="checkbox" data-setting="sound" ${this.settings.sound ? 'checked' : ''}> Stadium sound</label><label><input type="checkbox" data-setting="reducedMotion" ${this.settings.reducedMotion ? 'checked' : ''}> Reduce motion</label></div></section>`);
  }
  showHalftime(match) { this.showResult(match, false); }
  showFulltime(match) { this.showResult(match, true); }
  showDrillComplete(match) {
    this.show('drill-complete', `<section class="menu-panel drill-complete-panel"><div class="menu-top"><h2>Circuit complete.</h2><span class="subtle">Gate drill</span></div><div class="drill-route completed-route"><span class="state-chip">|0〉</span><i>→</i><span class="done">H</span><i>→</i><span class="done">Z</span><i>→</i><span class="done">H</span><i>→</i><span class="state-chip south-state">|1〉</span></div><p class="result-title">North to south. Goal.</p><p class="menu-intro">You built H → Z → H. The first H made a superposition, Z changed its phase, and the second H turned that phase into a definite south state. Your shot matched the |1〉 (−Z) target.</p><div class="drill-result"><strong>100%</strong><span>Aligned scoring chance before pressure</span></div><div class="menu-actions"><button class="secondary" data-action="drill">Repeat drill</button><button class="secondary" data-action="drill-local">Play with a friend</button><button class="primary" data-action="drill-practice">Practice vs AI</button></div></section>`);
  }
  showResult(match, final) {
    this.show(final ? 'fulltime' : 'halftime', `<section class="menu-panel"><div class="menu-top"><h2>${final ? 'Full time.' : 'Half time.'}</h2><span class="subtle">${final ? 'The final measurement.' : 'Switch ends. Fresh state.'}</span></div><div class="result-score"><span class="team-one">${match.score[0]}</span> : <span class="team-two">${match.score[1]}</span></div><p class="result-title">${final ? match.score[0] === match.score[1] ? 'Honours even.' : `${TEAMS[match.score[0] > match.score[1] ? 0 : 1]} wins.` : 'A new half. A new circuit.'}</p><div class="stats-grid">${this.statsMarkup(match)}</div><div class="menu-actions"><button class="secondary" data-action="menu">Return to title</button><button class="primary" data-action="${final ? 'rematch' : 'continue'}">${final ? 'Play again' : 'Start second half'}</button></div></section>`);
  }
  statsMarkup(match) {
    const stats = match.stats;
    const total = stats[0].possession + stats[1].possession;
    const percent = value => `${Math.round(value * 100)}%`;
    const row = (label, values) => `<div class="stat-row"><span>${values[0]}</span><span>${label}</span><span>${values[1]}</span></div>`;
    return row('Match statistics', ['QFC', 'ENT'])
      + row('Shots', stats.map(s => s.shots))
      + row('Possession', stats.map(s => percent(total ? s.possession / total : 0.5)))
      + row('Passes attempted', stats.map(s => s.passes))
      + row('Keeper saves', stats.map(s => s.saves))
      + row('Average shot alignment', stats.map(s => s.shots ? percent(s.alignmentTotal / s.shots) : '—'))
      + row('Shots lost to measurement', stats.map(s => s.failedMeasurements))
      + row('State strength lost · summed arrow lengths', stats.map(s => s.stateLost.toFixed(2)));
  }
  update(match, dt) {
    if (this.hud.hidden) return;
    const nodes = this.nodes;
    nodes['score-0'].textContent = match.score[0]; nodes['score-1'].textContent = match.score[1];
    const elapsed = match.time + (match.half === 2 ? match.duration : 0);
    nodes['match-clock'].textContent = `${fmt(elapsed / 60)}:${fmt(elapsed % 60)}`;
    nodes['half-label'].textContent = match.half === 1 ? '1st half' : '2nd half';
    for (let team = 0; team < 2; team++) {
      const lock = match.locks[team];
      const signature = `${lock.basis}|${lock.sign}|${lock.target}|${Math.round(lock.progress * 100)}|${lock.frozen}`;
      if (this[`lock-${team}`] !== signature) {
        this[`lock-${team}`] = signature;
        nodes[`reading-${team}`].innerHTML = `${team ? 'ENT' : 'QFC'} net <strong>${lock.target ? `${lockName(lock.basis, lock.sign)} → ${lockName(lock.target, lock.sign)}` : lockName(lock.basis, lock.sign)}</strong>${lock.frozen ? ' · frozen' : lock.target ? ` · ${Math.round(lock.progress * 100)}%` : ''}`;
      }
      const player = match.getControlled(team);
      const ai = match.aiTeams.has(team);
      nodes[`control-label-${team}`].textContent = `${ai ? 'CPU' : `P${team + 1}`} · ${TEAMS[team]}${player ? ` · ${player.gate === 'RESET' ? 'keeper' : player.gate}` : ''}`;
      const device = ai ? 'ai' : this.pads[team] !== null ? 'pad' : 'keyboard';
      if (this[`control-device-${team}`] !== device) {
        this[`control-device-${team}`] = device;
        nodes[`control-keys-${team}`].innerHTML = ai ? '<span class="control-line">Tactical AI · passing, pressure &amp; keeper reads</span>' : device === 'pad' ? '<span class="control-line"><kbd>◉</kbd> Move <kbd>A</kbd> Pass <kbd>B</kbd> Shoot</span><span class="control-line secondary-controls"><kbd>X</kbd> Switch / press <kbd>Y</kbd> Reading <kbd>RT</kbd> Sprint</span>' : keys(team, true);
      }
      const splitStatus = nodes[`split-status-${team}`];
      splitStatus.hidden = Boolean(match.options?.drill);
      const remaining = Math.max(0, Number(match.splitCooldown?.[team]) || 0);
      const active = match.ball.split?.team === team;
      const ownsBall = match.player(match.ball.owner)?.team === team;
      const status = active ? 'Switch gate · steer into a lane' : remaining > 0 ? `Split · ${Math.ceil(remaining)}s` : ownsBall ? 'Split ready' : 'Split ready on possession';
      const splitSignature = `${device}|${status}`;
      if (this[`split-status-${team}`] !== splitSignature) {
        this[`split-status-${team}`] = splitSignature;
        const splitKey = active ? device === 'pad' ? 'X' : team ? 'J' : 'H' : device === 'pad' ? 'LB' : team ? 'O' : 'Q';
        splitStatus.innerHTML = `${ai ? '' : `<kbd>${splitKey}</kbd> `}${status}`;
        splitStatus.classList.toggle('ready', !active && remaining === 0 && ownsBall);
      }
    }
    const strength = Math.hypot(match.ball.state.x, match.ball.state.y, match.ball.state.z);
    const team = match.ball.lastTeam ?? 0, chance = match.shotChance(team);
    nodes['coherence-value'].textContent = `${Math.round(strength * 100)}%`;
    nodes['chance-value'].textContent = `${Math.round(chance * 100)}%`;
    nodes['chance-label'].textContent = match.ball.split ? 'Before split · shot chance' : `${team ? 'ENT' : 'QFC'} shot chance`;
    nodes['chance-fill'].style.width = `${chance * 100}%`;
    nodes['chance-fill'].style.backgroundColor = chance >= 0.8 ? '#b4efad' : chance < 0.3 ? '#ff866d' : '#f4d38c';
    const history = match.gatesHistory.join(' ');
    if (this.lastHistory !== history) {
      this.lastHistory = history;
      nodes['gate-history'].innerHTML = `Circuit ${match.gatesHistory.length ? match.gatesHistory.slice(-7).map(gate => `<span class="gate-chip">${gate === 'RESET' ? '↺' : gate}</span>`).join('') : '<span class="gate-chip">|0〉</span>'}`;
    }
    this.blochCanvas.setAttribute('aria-label', `Ball Bloch state: ${Math.round(strength * 100)}% state strength, ${Math.round(chance * 100)}% shot probability${this.settings.expert ? ', phase hidden' : ''}`);
    this.updatePassPreview(match);
    this.updateDrill(match);
  }
  updatePassPreview(match) {
    const nodes = this.nodes, owner = match.player(match.ball.owner);
    const preview = owner && match.ball.mode === 'held' && typeof match.passPreview === 'function' ? match.passPreview(owner) : null;
    nodes['pass-preview'].hidden = !preview;
    const targetGate = value => (typeof value === 'object' ? value : match.player(value))?.gate || '—';
    const gateName = gate => gate === 'RESET' ? 'Keeper' : gate;
    if (preview) {
      const gate = preview.gate || targetGate(preview.target);
      const title = `${gateName(gate)} pass · ${percent(preview.before)} → ${percent(preview.after)}`;
      if (nodes['pass-preview-name'].textContent !== title) nodes['pass-preview-name'].textContent = title;
      nodes['pass-preview-detail'].textContent = gateDescription(gate);
      const split = preview.split;
      nodes['split-preview'].hidden = !split || Boolean(match.options?.drill);
      if (split?.probabilities) nodes['split-preview'].textContent = `Split exits: ${gateName(targetGate(split.target))} ${percent(split.probabilities[0])} / ${gateName(targetGate(split.outlet))} ${percent(split.probabilities[1])}`;
    }
    const split = match.ball.split;
    nodes['split-forecast'].hidden = !split;
    if (split) {
      const switchKey = this.pads[split.team] !== null ? 'X' : split.team ? 'J' : 'H';
      if (this.lastSplitSwitchKey !== switchKey) {
        this.lastSplitSwitchKey = switchKey;
        nodes['split-lane-hint'].innerHTML = `<kbd>${switchKey}</kbd> Switch player to steer a gate into a lane.`;
      }
      const forecast = split.forecast || (split.probabilities ? split : null);
      const main = gateName(targetGate(split.target)), outlet = gateName(targetGate(split.outlet));
      const probabilities = forecast?.probabilities;
      const signature = probabilities ? `${main}|${outlet}|${percent(probabilities[0])}|${percent(probabilities[1])}` : 'awaiting';
      if (this.lastSplitForecast !== signature) {
        this.lastSplitForecast = signature;
        nodes['split-outcomes'].innerHTML = probabilities ? `<div><span>Main · ${escape(main)}</span><strong>${percent(probabilities[0])}</strong></div><div><span>Outlet · ${escape(outlet)}</span><strong>${percent(probabilities[1])}</strong></div>` : '<span>Reading the two paths…</span>';
      }
    } else this.lastSplitForecast = null;
  }
  updateDrill(match) {
    const nodes = this.nodes;
    this.hud.classList.toggle('drill-hud', Boolean(match.options?.drill));
    nodes['drill-instruction'].hidden = !match.options?.drill;
    if (!match.options?.drill) return;
    let fromHistory = 0;
    const expected = ['H', 'Z', 'H'];
    for (const gate of match.gatesHistory || []) {
      if (fromHistory >= 3) break;
      fromHistory = gate === expected[fromHistory] ? fromHistory + 1 : gate === 'H' ? 1 : 0;
    }
    const progress = match.drillProgress;
    const rawStep = typeof progress === 'number' ? progress : progress?.step ?? match.drillStep ?? fromHistory;
    const step = Math.max(0, Math.min(3, Number(rawStep) || 0));
    const completed = step >= 3 || progress?.complete;
    const pad = this.pads[0] !== null;
    const signature = `${step}|${completed}|${pad}`;
    if (this.lastDrill === signature) return;
    this.lastDrill = signature;
    nodes['drill-stage'].textContent = completed ? 'Now shoot' : `Pass ${step + 1} of 3`;
    nodes['drill-route'].innerHTML = `<span class="state-chip">|0〉</span><i>→</i>${expected.map((gate, index) => `<span class="${index < step ? 'done' : index === step ? 'next' : ''}">${gate}</span><i>→</i>`).join('')}<span class="state-chip ${completed ? 'south-state' : ''}">|1〉</span>`;
    nodes['drill-next'].textContent = completed ? `Hold ${pad ? 'B' : 'G'}, then release to shoot.` : `Pass to ${expected[step]} · tap ${pad ? 'A' : 'F'}`;
    nodes['drill-explanation'].textContent = completed ? 'South reached. Your shot matches the |1〉 (−Z) net.' : [
      'Start at north. H makes an equator state with 50% south odds.',
      'Z rotates phase 180°. The south odds stay at 50%.',
      'H turns the hidden phase into a definite south state.',
    ][step];
  }
  toast(text) {
    this.toastElement.textContent = text; this.toastElement.hidden = false; clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastElement.hidden = true; }, 4000);
  }
  showMeasurement({ success, chance = 0.5, team = 0 }) {
    this.showFlash(success === null ? 'MEASURING' : success ? 'ALIGNED' : 'REJECTED', `${success === false ? 'Collapsed ball rebounds · ' : ''}${TEAMS[team]} · ${Math.round(chance * 100)}% scoring chance`, success === false ? 'failure' : '', success === null ? 600 : success === false ? 1500 : 1100);
  }
  showGoal(team, score) { this.showFlash('GOAL', `${TEAMS[team]} · ${score[0]} : ${score[1]} · New targets at kickoff`, team === 0 ? 'success' : 'failure', 1900); }
  showFlash(title, caption, state, duration) {
    this.flash.innerHTML = `<h2>${title}</h2><div class="measurement-caption">${caption}</div>`; this.flash.className = `match-flash ${state}`; this.flash.hidden = false;
    clearTimeout(this.flashTimer); this.flashTimer = setTimeout(() => { this.flash.hidden = true; }, duration);
  }
}

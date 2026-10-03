"""Browser integration check. Requires a running development server and Python Playwright."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

url = os.environ.get('QUBIT_FC_URL', 'http://127.0.0.1:5173')
artifacts = Path(os.environ.get('QUBIT_FC_ARTIFACTS', '/tmp/qubit-fc-checks'))
artifacts.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('window.__qubitFC?.controller?.scene')
    assert page.locator('h1').inner_text().replace('\n', '') == 'QUBITFC.'
    page.screenshot(path=str(artifacts / 'title.png'))

    page.locator('[data-action="join"]').click()
    assert page.locator('.team-card').count() == 2
    page.get_by_label('Match length').select_option('60')
    page.locator('[data-action="howto-local"]').click()
    assert page.locator('.instruction').count() == 3
    page.screenshot(path=str(artifacts / 'tutorial.png'))
    page.locator('[data-action="start"]').click()
    page.wait_for_function('window.__qubitFC.controller.match.phase === "play"')
    assert page.evaluate('window.__qubitFC.controller.match.duration') == 60
    before = page.evaluate('window.__qubitFC.controller.match.getControlled(0).x')
    page.keyboard.down('d')
    page.wait_for_timeout(450)
    page.keyboard.up('d')
    after = page.evaluate('window.__qubitFC.controller.match.getControlled(0).x')
    assert after - before > 40, (before, after)

    page.keyboard.down('w')
    page.wait_for_timeout(100)
    page.keyboard.up('w')
    page.keyboard.press('f')
    page.wait_for_function('window.__qubitFC.controller.match.gatesHistory.length > 0')
    assert page.evaluate('window.__qubitFC.controller.match.stats[0].passes') > 0
    page.wait_for_timeout(200)
    assert page.locator('#gate-history .gate-chip').count() > 0
    page.screenshot(path=str(artifacts / 'match.png'))

    page.keyboard.press('r')
    page.wait_for_function('window.__qubitFC.controller.match.locks[0].target === "X"')
    page.wait_for_function('window.__qubitFC.controller.match.locks[0].basis === "X"')
    page.keyboard.down('g')
    page.wait_for_timeout(350)
    charge = page.evaluate('window.__qubitFC.controller.match.players.some(p => p.team === 0 && p.charge > 0.1)')
    assert charge, 'Holding G should charge the controlled ball carrier'
    page.keyboard.up('g')
    page.wait_for_function('window.__qubitFC.controller.match.stats[0].shots === 1')

    page.keyboard.press('Escape')
    page.wait_for_function('window.__qubitFC.controller.paused')
    time_before = page.evaluate('window.__qubitFC.controller.match.time')
    page.wait_for_timeout(400)
    assert page.evaluate('window.__qubitFC.controller.match.time') == time_before
    page.locator('[data-action="resume"]').click()
    page.wait_for_function('!window.__qubitFC.controller.paused')
    page.keyboard.press('Escape')
    page.locator('[data-action="menu"]').click()
    page.locator('[data-action="practice"]').click()
    page.locator('[data-setting="expert"]').check()
    page.locator('[data-action="start"]').click()
    page.wait_for_function('window.__qubitFC.controller.match.phase === "play"')
    assert page.evaluate('window.__qubitFC.controller.match.aiTeams.has(1)')
    assert page.evaluate('window.__qubitFC.controller.options.expert')

    # Complete an accelerated match through its public model update while preserving UI orchestration.
    page.evaluate('''() => {
      const c = window.__qubitFC.controller;
      c.match.duration = 0.3;
    }''')
    page.wait_for_function('window.__qubitFC.controller.ui.screen === "halftime"')
    page.locator('[data-action="continue"]').click()
    page.wait_for_function('window.__qubitFC.controller.ui.screen === "fulltime"')
    assert page.locator('.stat-row').count() >= 7
    page.screenshot(path=str(artifacts / 'results.png'))
    page.locator('[data-action="menu"]').click()

    # Compact landscape and portrait layouts should stay inside the viewport.
    for name, width, height in [('landscape', 900, 600), ('mobile', 844, 390), ('portrait', 390, 844)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(200)
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        page.screenshot(path=str(artifacts / f'{name}.png'))
    # Use browser gamepad events and menu actions through the same polling path as real pads.
    pads = browser.new_page(viewport={'width': 1440, 'height': 900})
    pads.on('pageerror', lambda error: errors.append(str(error)))
    pads.add_init_script('''
      window.checkPads = [0, 1].map(index => ({
        index, id: 'Standard controller ' + index, connected: true, mapping: 'standard',
        axes: [0, 0, 0, 0], buttons: Array.from({length: 17}, () => ({pressed: false, value: 0}))
      }));
      Object.defineProperty(navigator, 'getGamepads', {value: () => window.checkPads});
    ''')
    pads.goto(url, wait_until='networkidle')
    pads.wait_for_function('window.__qubitFC?.controller?.scene')
    def press_a(index):
        pads.evaluate('(i) => { checkPads[i].buttons[0] = {pressed: true, value: 1}; }', index)
        pads.wait_for_timeout(120)
        pads.evaluate('(i) => { checkPads[i].buttons[0] = {pressed: false, value: 0}; }', index)
        pads.wait_for_timeout(120)
    press_a(0)
    assert pads.evaluate('window.__qubitFC.controller.ui.screen') == 'join'
    press_a(0)
    press_a(1)
    assert pads.evaluate('window.__qubitFC.input.assignedPads') == [0, 1]
    press_a(0)
    assert pads.evaluate('window.__qubitFC.controller.ui.screen') == 'howto'
    press_a(0)
    pads.wait_for_function('window.__qubitFC.controller.match.phase === "play"')
    before_pad = pads.evaluate('window.__qubitFC.controller.match.getControlled(0).x')
    pads.evaluate('checkPads[0].axes[0] = 1')
    pads.wait_for_timeout(300)
    pads.evaluate('checkPads[0].axes[0] = 0')
    after_pad = pads.evaluate('window.__qubitFC.controller.match.getControlled(0).x')
    assert after_pad - before_pad > 30
    pads.close()
    assert not errors, errors
    print(json.dumps({'status': 'passed', 'page_errors': errors, 'artifacts': str(artifacts)}, indent=2))
    browser.close()

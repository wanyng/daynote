'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { app, dialog } = require('electron');
process.env.DAYNOTE_TEST = '1';
const root = path.resolve(__dirname, '..');
const verifyRestart = process.argv.includes('--verify-restart');
const homeFile = path.join(root, '.cache/latest-smoke-home.txt');
const testHome = verifyRestart ? fs.readFileSync(homeFile, 'utf8') : path.join(root, '.cache/smoke-' + Date.now());
if (!verifyRestart) fs.writeFileSync(homeFile, testHome);
process.argv.push('--daynote-home=' + testHome);
const errors = [];
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  contents.on('preload-error', (_event, file, error) => errors.push(file + ': ' + error.message));
  contents.on('did-fail-load', (_event, code, description) => errors.push('load ' + code + ': ' + description));
});
const main = require('../src/main.cjs');
const timeout = setTimeout(() => { console.error('Desktop test timeout', errors); app.exit(1); }, 45000);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready(window) {
  for (let i = 0; i < 120; i++) {
    if (!window.webContents.isLoading()) {
      const ok = await window.webContents.executeJavaScript("Boolean(window.daynote && document.body.classList.contains('native-app') && document.querySelector('.quadrant'))");
      if (ok) return;
    }
    await pause(100);
  }
  throw new Error('Renderer not ready: ' + JSON.stringify(errors));
}
app.whenReady().then(async () => {
  const { mainWindow: mw, widgetWindow: ww } = main.getWindows();
  await Promise.all([ready(mw), ready(ww)]);
  const evalMain = code => mw.webContents.executeJavaScript(code);
  const evalWidget = code => ww.webContents.executeJavaScript(code);
  if (verifyRestart) {
    assert.equal(await evalMain("state.tasks.some(t=>t.title==='桌面测试任务' && t.done)"), true);
    assert.equal(await evalMain("document.querySelector('#book-percent').textContent"), '50%');
    assert.equal(await evalMain("document.querySelector('#page-title').textContent"), '按自己的节奏前进');
    console.log('PASS actual process restart restored tasks, reading, and custom text');
  } else {
    assert.equal(await evalMain('state.tasks.length'), 0);
    assert.equal(await evalMain('state.goals.length'), 0);
    assert.equal(await evalMain("document.querySelector('#week-rate').textContent"), '—');
    assert.equal(await evalWidget("document.querySelector('#widget').hidden"), false);
    assert.notEqual(await evalWidget("getComputedStyle(document.querySelector('#pin-widget')).display"), 'none');
    assert.equal(await evalMain("typeof require"), 'undefined');
    assert.equal(await evalMain("typeof process"), 'undefined');
    await evalMain("var f=document.querySelector('[data-quadrant=\"1\"]'); f.elements.title.value='桌面测试任务'; f.requestSubmit();");
    await pause(120);
    assert.equal(await evalWidget('state.tasks[0].title'), '桌面测试任务');
    await evalWidget("document.querySelector('#widget-list input[type=checkbox]').click()");
    await pause(120);
    assert.equal(await evalMain('state.tasks[0].done'), true);
    assert.equal(await evalMain("document.querySelector('#week-rate').textContent"), '100%');
    await evalMain("editBook(); var f=document.querySelector('#editor-form');f.elements.title.value='深度工作';f.elements.author.value='卡尔·纽波特';f.elements.total.value='280';f.elements.current.value='140';f.requestSubmit();");
    assert.equal(await evalMain("document.querySelector('#book-percent').textContent"), '50%');
    await evalMain("editGoal(null);var f=document.querySelector('#editor-form');f.elements.name.value='阅读';f.elements.weekText.value='读完 100 页';f.elements.week.value='50';f.elements.totalText.value='读完 12 本书';f.elements.total.value='25';f.requestSubmit();");
    assert.equal(await evalMain('state.goals.length'), 1);
    await evalMain("document.querySelector('#edit-copy').click();var f=document.querySelector('#editor-form');f.elements.title.value='按自己的节奏前进';f.elements.q1.value='<img src=x onerror=alert(1)>';f.requestSubmit();");
    assert.equal(await evalMain("document.querySelector('.q-description').textContent"), '<img src=x onerror=alert(1)>');
    assert.equal(await evalMain("document.querySelectorAll('.q-description img').length"), 0);
    const settings = await evalMain('window.daynote.settings()');
    assert.equal(settings.dataRoot.toLowerCase().startsWith(testHome.toLowerCase()), true);
    for (const name of ['userData', 'sessionData', 'temp', 'logs', 'crashDumps']) assert.equal(app.getPath(name).toLowerCase().startsWith(testHome.toLowerCase()), true, name);
    const pin = await evalWidget('window.daynote.setPin(true)'); assert.equal(pin.pinned, true); assert.equal(ww.isAlwaysOnTop(), true);
    await evalWidget('window.daynote.setPin(false)');
    main.showMain(); await pause(100); mw.minimize(); await pause(300);
    assert.equal(ww.isVisible(), true); assert.equal(mw.isVisible(), false);
    await evalWidget("document.querySelector('#restore').click()"); await pause(200);
    assert.equal(mw.isVisible(), true); assert.equal(ww.isVisible(), false);
    await evalMain("addTask('用于验证删除',2,today);editTask(state.tasks.at(-1).id)");
    dialog.showMessageBox = async () => ({ response: 1 });
    await evalMain("document.querySelector('[data-delete-task]').click()"); await pause(200);
    assert.equal(await evalMain('state.tasks.length'), 1);
    const exportFile = path.join(testHome, 'export.json');
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: exportFile });
    assert.equal((await evalMain('window.daynote.exportData()')).ok, true);
    assert.equal(JSON.parse(fs.readFileSync(exportFile, 'utf8')).tasks.length, 1);
    await evalMain("state.copy.q1='优先处理 · 给当下一个交代';save();render();");
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    mw.setSize(1440, 970); await pause(200);
    fs.writeFileSync(path.join(root, 'test-results/main.png'), (await mw.webContents.capturePage()).toPNG());
    main.showWidget(); await pause(150);
    fs.writeFileSync(path.join(root, 'test-results/widget.png'), (await ww.webContents.capturePage()).toPNG());
    console.log('PASS empty start, sandboxed renderer, dual-window sync, checkbox, weekly rate, book, goal, custom copy, D-drive paths, pin, minimize, restore, delete, export');
  }
  assert.deepEqual(errors, []);
  console.log('DATA', main.getPaths().dataRoot);
  clearTimeout(timeout); app.quit();
}).catch(error => { console.error(error); console.error('Renderer errors:', errors); clearTimeout(timeout); app.exit(1); });

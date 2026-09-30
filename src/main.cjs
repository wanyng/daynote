'use strict';
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, shell, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Store, atomicWrite } = require('./store.cjs');

const homeArgument = process.argv.find(arg => arg.startsWith('--daynote-home='));
const appHome = homeArgument ? path.resolve(homeArgument.slice('--daynote-home='.length)) : app.isPackaged ? path.dirname(process.execPath) : path.resolve(__dirname, '../.local');
const configFile = path.join(appHome, 'daynote.config.json');
let config, store, dataRoot, mainWindow, widgetWindow, tray, quitting = false, configTimer;
const testMode = process.env.DAYNOTE_TEST === '1';

function persistConfig() { atomicWrite(configFile, config); }
function startupFailure(title, error) {
  if (testMode) { console.error(title, error.message); app.exit(1); return; }
  app.whenReady().then(() => { dialog.showErrorBox(title, error.message); app.quit(); });
}
try {
  fs.mkdirSync(appHome, { recursive: true });
  config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : { dataDir: 'data', pinned: false };
  if (!config || typeof config.dataDir !== 'string') throw new Error('daynote.config.json 中的数据目录无效');
  dataRoot = path.resolve(appHome, config.dataDir);
  const runtime = path.join(dataRoot, 'runtime');
  for (const [name, suffix] of [['appData', 'appdata'], ['userData', 'profile'], ['sessionData', 'session'], ['temp', 'temp'], ['crashDumps', 'crashes']]) {
    const directory = path.join(runtime, suffix);
    fs.mkdirSync(directory, { recursive: true });
    app.setPath(name, directory);
  }
  app.setAppLogsPath(path.join(runtime, 'logs'));
  process.env.TEMP = app.getPath('temp');
  process.env.TMP = app.getPath('temp');
  process.env.CHROME_LOG_FILE = path.join(runtime, 'logs', 'chromium.log');
  app.commandLine.appendSwitch('disk-cache-dir', path.join(runtime, 'cache'));
  persistConfig();
} catch (error) {
  startupFailure('序日无法打开存储目录', new Error('请把程序放到可写目录，或检查 daynote.config.json。不会自动切换到 C 盘保存。\n\n' + error.message));
  module.exports = {};
  return;
}

app.setName('Daynote');
app.setAppUserModelId('org.daynote.desktop');
if (!app.requestSingleInstanceLock()) { app.quit(); module.exports = {}; return; }
try { store = new Store(dataRoot); }
catch (error) { startupFailure('序日数据读取失败', error); module.exports = {}; return; }

function sendState(except) {
  const snapshot = store.snapshot();
  for (const window of [mainWindow, widgetWindow]) if (window && !window.isDestroyed() && window.webContents !== except) window.webContents.send('state:changed', snapshot);
}
function safeBounds(saved, fallback) {
  const bounds = { ...fallback };
  if (saved && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(saved[key]))) Object.assign(bounds, saved);
  const area = screen.getDisplayMatching(bounds).workArea;
  bounds.width = Math.min(area.width, Math.max(fallback.minWidth || 320, bounds.width));
  bounds.height = Math.min(area.height, Math.max(fallback.minHeight || 300, bounds.height));
  bounds.x = Math.max(area.x, Math.min(bounds.x, area.x + area.width - bounds.width));
  bounds.y = Math.max(area.y, Math.min(bounds.y, area.y + area.height - bounds.height));
  delete bounds.minWidth; delete bounds.minHeight;
  return bounds;
}
function rememberBounds(key, window) {
  const update = () => {
    if (window.isDestroyed() || window.isMinimized() || window.isMaximized()) return;
    config[key] = window.getBounds();
    clearTimeout(configTimer);
    configTimer = setTimeout(() => { try { persistConfig(); } catch (error) { console.error('Window settings could not be saved:', error.message); } }, 250);
  };
  window.on('moved', update); window.on('resized', update);
}
function showMain() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  widgetWindow?.hide();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
}
function showWidget() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  mainWindow.hide(); widgetWindow.show();
}
function pin(value) {
  config.pinned = Boolean(value);
  widgetWindow?.setAlwaysOnTop(config.pinned);
  persistConfig(); updateTray();
  return config.pinned;
}
function updateTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开序日', click: showMain },
    { label: '显示今日待办板', click: showWidget },
    { label: '待办板始终置顶', type: 'checkbox', checked: Boolean(config.pinned), click: item => pin(item.checked) },
    { type: 'separator' },
    { label: '打开数据目录', click: () => shell.openPath(dataRoot) },
    { label: '退出序日', click: () => app.quit() }
  ]));
}
function createWindow(mode, bounds) {
  const acrylic = process.platform === 'win32' && Number(os.release().split('.')[2]) >= 22621;
  const window = new BrowserWindow({
    ...bounds, minWidth: mode === 'main' ? 1000 : 320, minHeight: mode === 'main' ? 720 : 330,
    show: false, frame: false, resizable: true, maximizable: mode === 'main',
    skipTaskbar: mode === 'widget', alwaysOnTop: mode === 'widget' && Boolean(config.pinned),
    title: mode === 'main' ? '序日 Daynote' : '序日 · 今日待办',
    icon: path.resolve(__dirname, '../build/icon.png'),
    backgroundColor: acrylic ? '#00000000' : '#ffffff',
    ...(acrylic ? { backgroundMaterial: 'acrylic' } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false, spellcheck: false }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.on('render-process-gone', (_event, details) => {
    if (!quitting && !testMode) dialog.showErrorBox('界面已停止运行', '已保存的数据仍在。请退出后重新打开序日。\n' + details.reason);
  });
  window.loadFile(path.join(__dirname, 'renderer/index.html'), { query: { mode } });
  rememberBounds(mode + 'Bounds', window);
  return window;
}
function trusted(event) {
  return [mainWindow, widgetWindow].some(window => window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame);
}
function registerIPC() {
  ipcMain.on('state:read', event => { event.returnValue = trusted(event) ? { ok: true, ...store.snapshot() } : { ok: false, error: '未授权的窗口' }; });
  ipcMain.on('state:save', (event, payload) => {
    if (!trusted(event)) { event.returnValue = { ok: false, error: '未授权的窗口' }; return; }
    try {
      const result = store.save(payload.state, payload.revision);
      event.returnValue = result;
      if (result.ok) sendState(event.sender);
    } catch (error) { event.returnValue = { ok: false, error: '保存失败：' + error.message }; }
  });
  ipcMain.on('window:action', (event, action) => {
    if (!trusted(event)) return;
    const source = BrowserWindow.fromWebContents(event.sender);
    if (action === 'main') showMain();
    else if (action === 'widget') showWidget();
    else if (action === 'maximize' && source === mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    else if (action === 'close') source.close();
    else if (action === 'quit') app.quit();
  });
  const handle = (name, fn) => ipcMain.handle(name, async (event, ...args) => {
    if (!trusted(event)) return { ok: false, error: '未授权的窗口' };
    try { return await fn(BrowserWindow.fromWebContents(event.sender), ...args); }
    catch (error) { return { ok: false, error: error.message }; }
  });
  handle('settings:read', () => ({ ok: true, dataRoot, appHome, pinned: Boolean(config.pinned), version: app.getVersion() }));
  handle('settings:pin', (_window, value) => ({ ok: true, pinned: pin(value) }));
  handle('storage:open', async () => { const error = await shell.openPath(dataRoot); return error ? { ok: false, error } : { ok: true }; });
  handle('data:export', async window => {
    const result = await dialog.showSaveDialog(window, { title: '导出序日备份', defaultPath: path.join(dataRoot, 'Daynote-backup-' + new Date().toISOString().slice(0, 10) + '.json'), filters: [{ name: '序日 JSON 备份', extensions: ['json'] }] });
    if (result.canceled) return { ok: true, canceled: true };
    store.export(result.filePath); return { ok: true };
  });
  handle('data:import', async window => {
    const result = await dialog.showOpenDialog(window, { title: '选择序日备份', defaultPath: dataRoot, properties: ['openFile'], filters: [{ name: '序日 JSON 备份', extensions: ['json'] }] });
    if (result.canceled) return { ok: true, canceled: true };
    const answer = await dialog.showMessageBox(window, { type: 'question', title: '导入备份', message: '使用备份替换当前数据？', detail: '替换前会自动备份当前数据到数据目录的 backups 文件夹。', buttons: ['取消', '备份并导入'], defaultId: 0, cancelId: 0 });
    if (answer.response !== 1) return { ok: true, canceled: true };
    store.import(result.filePaths[0]); sendState(); return { ok: true };
  });
  handle('storage:choose', async window => {
    const result = await dialog.showOpenDialog(window, { title: '选择新的空数据文件夹', defaultPath: path.dirname(dataRoot), properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return { ok: true, canceled: true };
    const target = result.filePaths[0];
    const answer = await dialog.showMessageBox(window, { type: 'question', title: '更换数据目录', message: '复制数据并重新启动？', detail: target + '\n\n原目录会保留作为备份；旧缓存不复制，新缓存将在所选目录创建。', buttons: ['取消', '复制并重启'], defaultId: 0, cancelId: 0 });
    if (answer.response !== 1) return { ok: true, canceled: true };
    const copied = store.copyTo(target);
    const previous = config.dataDir;
    config.dataDir = copied;
    try { persistConfig(); }
    catch (error) { config.dataDir = previous; throw new Error('数据已复制，但无法保存新目录设置，应用仍使用原目录：' + error.message); }
    app.relaunch(); app.quit(); return { ok: true };
  });
  handle('task:confirm-delete', async (window, title) => {
    const answer = await dialog.showMessageBox(window, { type: 'question', title: '删除任务', message: '删除这条任务？', detail: String(title).slice(0, 120), buttons: ['取消', '删除'], defaultId: 0, cancelId: 0 });
    return { ok: true, confirmed: answer.response === 1 };
  });
}

app.on('second-instance', () => showMain());
app.on('before-quit', () => { quitting = true; clearTimeout(configTimer); try { persistConfig(); } catch {} });
app.on('window-all-closed', () => {});
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const area = screen.getPrimaryDisplay().workArea;
  mainWindow = createWindow('main', safeBounds(config.mainBounds, { x: area.x + 30, y: area.y + 30, width: Math.min(1480, area.width - 60), height: Math.min(970, area.height - 60), minWidth: 1000, minHeight: 720 }));
  widgetWindow = createWindow('widget', safeBounds(config.widgetBounds, { x: area.x + area.width - 410, y: area.y + 60, width: 370, height: 660, minWidth: 320, minHeight: 330 }));
  registerIPC();
  mainWindow.once('ready-to-show', () => { if (!testMode) mainWindow.show(); });
  mainWindow.on('minimize', () => showWidget());
  mainWindow.on('close', event => { if (!quitting) { event.preventDefault(); showWidget(); } });
  widgetWindow.on('close', event => { if (!quitting) { event.preventDefault(); widgetWindow.hide(); } });
  if (!testMode) {
    tray = new Tray(nativeImage.createFromPath(path.resolve(__dirname, '../build/icon.png')).resize({ width: 20, height: 20 }));
    tray.setToolTip('序日 Daynote'); tray.on('double-click', showMain); updateTray();
  }
  if (store.recovered && !testMode) dialog.showMessageBox(mainWindow, { type: 'info', title: '已恢复备份', message: '数据已从上一份有效备份恢复。', detail: '原文件保留在数据目录，文件名以 state.corrupt 开头。' });
});
module.exports = { getWindows: () => ({ mainWindow, widgetWindow }), getStore: () => store, getPaths: () => ({ appHome, dataRoot }), showMain, showWidget };

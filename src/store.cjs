'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function text(value, limit, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > limit) throw new Error('文字格式或长度不正确');
  return value;
}
function number(value, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error('数值超出允许范围');
  return value;
}
function emptyState() {
  return { version: 1, tasks: [], book: { title: '', author: '', current: 0, total: 1, cover: '' }, finishedBooks: [], notes: {}, goals: [], opacity: .85, copy: {} };
}
function coverImage(value = '') {
  if (value === '') return '';
  if (typeof value !== 'string' || value.length > 180000) throw new Error('封面图片过大');
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new Error('封面图片格式无效');
  const bytes = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error('封面图片内容无效');
  return value;
}
function validateState(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.tasks) || !Array.isArray(input.goals)) throw new Error('不是有效的序日数据文件');
  if (input.tasks.length > 50000 || input.goals.length > 100) throw new Error('数据量超过限制');
  const ids = new Set();
  const tasks = input.tasks.map(t => {
    const id = text(t.id, 100);
    if (!id || ids.has(id) || !validDate(t.planned) || !validDate(t.due)) throw new Error('任务编号或日期无效');
    ids.add(id);
    const q = number(t.q, 1, 4);
    if (!Number.isInteger(q) || typeof t.done !== 'boolean') throw new Error('任务状态无效');
    return { id, title: text(t.title, 120), q, planned: t.planned, due: t.due, done: t.done };
  });
  const book = input.book;
  if (!book) throw new Error('阅读数据缺失');
  const total = number(book.total, 1, 10000000), current = number(book.current, 0, total);
  const cover = coverImage(book.cover);
  const finishedIds = new Set();
  if (input.finishedBooks !== undefined && (!Array.isArray(input.finishedBooks) || input.finishedBooks.length > 500)) throw new Error('已读书架数据无效或超过 500 本');
  const finishedBooks = (input.finishedBooks || []).map(b => {
    if (!b || typeof b !== 'object') throw new Error('已读书籍无效');
    const id = text(b.id, 100), title = text(b.title, 80);
    if (!id || finishedIds.has(id) || !title.trim() || !validDate(b.finishedOn)) throw new Error('已读书籍编号、书名或日期无效');
    finishedIds.add(id);
    return { id, title, author: text(b.author, 60), total: number(b.total ?? 1, 1, 10000000), finishedOn: b.finishedOn, cover: coverImage(b.cover) };
  });
  if (finishedBooks.reduce((size, b) => size + b.cover.length, cover.length) > 16 * 1024 * 1024) throw new Error('书架封面总量超过限制，请移除一些封面后重试');
  const goalIds = new Set();
  const goals = input.goals.map(g => {
    const id = text(g.id, 100);
    if (!id || goalIds.has(id)) throw new Error('目标编号无效');
    goalIds.add(id);
    return { id, name: text(g.name, 20), icon: text(g.icon, 30, 'target'), weekText: text(g.weekText, 80), week: number(g.week, 0, 100), totalText: text(g.totalText, 80), total: number(g.total, 0, 100) };
  });
  const notes = {};
  if (!input.notes || typeof input.notes !== 'object' || Array.isArray(input.notes)) throw new Error('总结数据无效');
  for (const [key, value] of Object.entries(input.notes)) {
    if (!validDate(key)) throw new Error('总结日期无效');
    notes[key] = text(value, 10000);
  }
  const copy = {};
  if (input.copy && typeof input.copy === 'object' && !Array.isArray(input.copy)) {
    for (const [key, value] of Object.entries(input.copy)) if (/^[a-zA-Z0-9]{1,40}$/.test(key) && !['constructor', 'prototype', '__proto__'].includes(key)) copy[key] = text(value, 120);
  }
  return { version: 1, tasks, book: { title: text(book.title, 80), author: text(book.author, 60), current, total, cover }, finishedBooks, goals, notes, copy, opacity: number(input.opacity ?? .85, .4, .95) };
}
function atomicWrite(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  try {
    const handle = fs.openSync(tmp, 'wx');
    try { fs.writeFileSync(handle, JSON.stringify(data, null, 2), 'utf8'); fs.fsyncSync(handle); }
    finally { fs.closeSync(handle); }
    fs.renameSync(tmp, file);
  } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
class Store {
  constructor(root) {
    this.root = root;
    this.file = path.join(root, 'state.json');
    this.backupFile = path.join(root, 'state.backup.json');
    this.revision = 0;
    fs.mkdirSync(root, { recursive: true });
    this.recovered = false;
    if (!fs.existsSync(this.file)) {
      this.state = emptyState();
      atomicWrite(this.file, this.state);
    } else {
      try { this.state = validateState(JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
      catch (originalError) {
        try {
          this.state = validateState(JSON.parse(fs.readFileSync(this.backupFile, 'utf8')));
          fs.copyFileSync(this.file, path.join(root, 'state.corrupt-' + Date.now() + '.json'));
          atomicWrite(this.file, this.state);
          this.recovered = true;
        } catch { throw new Error('数据文件无法读取，原文件已保留。请先备份数据目录，再检查 state.json 和 state.backup.json。原因：' + originalError.message); }
      }
    }
  }
  snapshot() { return { state: structuredClone(this.state), revision: this.revision }; }
  save(input, revision) {
    if (revision !== this.revision) return { ok: false, error: '数据刚刚在另一个窗口更新，请重试本次修改。', ...this.snapshot() };
    const next = validateState(input);
    atomicWrite(this.backupFile, this.state);
    atomicWrite(this.file, next);
    this.state = next;
    this.revision += 1;
    return { ok: true, ...this.snapshot() };
  }
  export(file) { atomicWrite(file, this.state); }
  import(file) {
    if (fs.statSync(file).size > 64 * 1024 * 1024) throw new Error('导入文件过大');
    const next = validateState(JSON.parse(fs.readFileSync(file, 'utf8')));
    const archive = path.join(this.root, 'backups', 'before-import-' + Date.now() + '.json');
    atomicWrite(archive, this.state);
    return this.save(next, this.revision);
  }
  copyTo(directory) {
    const target = path.resolve(directory), current = path.resolve(this.root);
    const folded = value => process.platform === 'win32' ? value.toLowerCase() : value;
    if (folded(target) === folded(current)) throw new Error('这已经是当前数据目录');
    const relative = path.relative(current, target);
    if (!(relative === '..' || relative.startsWith('..' + path.sep)) && !path.isAbsolute(relative)) throw new Error('请选择当前数据目录以外的位置');
    fs.mkdirSync(target, { recursive: true });
    if (fs.readdirSync(target).length) throw new Error('请选择空文件夹，避免覆盖已有文件');
    atomicWrite(path.join(target, 'state.json'), this.state);
    if (fs.existsSync(this.backupFile)) fs.copyFileSync(this.backupFile, path.join(target, 'state.backup.json'));
    const archives = path.join(this.root, 'backups');
    if (fs.existsSync(archives)) fs.cpSync(archives, path.join(target, 'backups'), { recursive: true });
    return target;
  }
}
module.exports = { Store, emptyState, validateState, validDate, atomicWrite };

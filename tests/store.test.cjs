'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Store, emptyState, validDate } = require('../src/store.cjs');
const testRoot = path.resolve(__dirname, '../.cache/tests');
fs.mkdirSync(testRoot, { recursive: true });
function store() { return new Store(fs.mkdtempSync(path.join(testRoot, 'store-'))); }
function task() { return { id: 'a', title: '安排今天', q: 2, planned: '2026-09-30', due: '2026-10-02', done: false }; }
test('empty first launch, atomic save and restart preserve real data', () => {
  const s = store(); assert.equal(s.state.tasks.length, 0);
  const next = emptyState(); next.tasks.push(task());
  assert.equal(s.save(next, 0).ok, true);
  assert.equal(new Store(s.root).state.tasks[0].title, '安排今天');
  assert.equal(fs.readdirSync(s.root).some(name => name.endsWith('.tmp')), false);
});
test('stale second-window snapshot cannot overwrite newer changes', () => {
  const s = store(), first = emptyState(); first.tasks.push(task()); s.save(first, 0);
  assert.equal(s.save(emptyState(), 0).ok, false); assert.equal(s.state.tasks.length, 1);
});
test('invalid imports leave data intact', () => {
  const s = store(), next = emptyState(); next.tasks.push(task()); s.save(next, 0);
  const invalid = path.join(s.root, 'invalid.json'); fs.writeFileSync(invalid, '{invalid');
  assert.throws(() => s.import(invalid)); assert.equal(s.state.tasks.length, 1);
});
test('corrupt primary recovers the last valid backup and retains corrupt file', () => {
  const s = store(), first = emptyState(); first.tasks.push(task()); s.save(first, 0);
  const second = structuredClone(first); second.tasks[0].done = true; s.save(second, 1);
  fs.writeFileSync(s.file, 'corrupted'); const reopened = new Store(s.root);
  assert.equal(reopened.recovered, true); assert.equal(reopened.state.tasks[0].title, '安排今天');
  assert.equal(reopened.state.tasks[0].done, false); assert.ok(fs.readdirSync(s.root).some(name => name.startsWith('state.corrupt-')));
});
test('changing directories copies data, preserves source, refuses existing files', () => {
  const s = store(), first = emptyState(); first.tasks.push(task()); s.save(first, 0);
  const target = fs.mkdtempSync(path.join(testRoot, 'destination-')); s.copyTo(target);
  assert.equal(new Store(target).state.tasks.length, 1); assert.ok(fs.existsSync(s.file));
  assert.throws(() => s.copyTo(target), /空文件夹/);
  assert.throws(() => s.copyTo(path.join(s.root, 'nested')), /以外/);
});
test('validate real dates, bounds and ignore legacy categories', () => {
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2028-02-29'), true);
  const s = store(), next = emptyState(); next.tasks.push({ ...task(), category: 'work' });
  assert.equal(s.save(next, 0).ok, true); assert.equal('category' in s.state.tasks[0], false);
  next.book.current = 2; assert.throws(() => s.save(next, 1));
});

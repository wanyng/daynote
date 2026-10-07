'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Store,emptyState,validateState}=require('../src/store.cjs');
const root=path.resolve(__dirname,'../.cache/tests');fs.mkdirSync(root,{recursive:true});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';
const book=()=>({id:'read-1',title:'深度工作',author:'卡尔·纽波特',finishedOn:'2026-10-07',total:280,cover:png});
test('legacy data without shelf or covers loads without losing plans or reading progress',()=>{
 const old=emptyState();delete old.finishedBooks;delete old.book.cover;
 old.book={title:'正在读的书',author:'作者',current:12,total:100};
 old.tasks=[{id:'old',title:'原有计划',q:1,done:false,planned:'2026-10-01',due:'2026-10-07'}];
 const next=validateState(old);assert.deepEqual(next.finishedBooks,[]);assert.equal(next.book.cover,'');assert.equal(next.book.current,12);assert.equal(next.tasks[0].title,'原有计划');
});
test('shelf and covers survive restart, self-contained export/import, and directory change',()=>{
 const s=new Store(fs.mkdtempSync(path.join(root,'books-'))),next=emptyState();next.finishedBooks.push(book());next.book={title:'下一本',author:'',current:1,total:100,cover:png};
 s.save(next,0);const reopened=new Store(s.root);assert.deepEqual(reopened.state.finishedBooks,next.finishedBooks);
 const output=path.join(s.root,'export.json');reopened.export(output);
 const imported=new Store(fs.mkdtempSync(path.join(root,'book-import-')));imported.import(output);
 assert.equal(imported.state.finishedBooks[0].cover,png);assert.equal(imported.state.book.cover,png);
 const destination=fs.mkdtempSync(path.join(root,'book-move-'));imported.copyTo(destination);
 assert.deepEqual(new Store(destination).state.finishedBooks,next.finishedBooks);
});
test('malformed shelf records and unsafe/oversized covers never replace saved data',()=>{
 const s=new Store(fs.mkdtempSync(path.join(root,'book-guard-'))),good=emptyState();good.finishedBooks.push(book());s.save(good,0);
 for(const patch of [{cover:'file:///C:/private.png'},{cover:'data:image/svg+xml;base64,PHN2Zz4='},{cover:'data:image/png;base64,AAAA'},{cover:'x'.repeat(180001)},{finishedOn:'2026-02-30'},{title:''}]){
  const bad=structuredClone(good);Object.assign(bad.finishedBooks[0],patch);assert.throws(()=>s.save(bad,s.revision));assert.equal(s.state.finishedBooks[0].cover,png);
 }
 const duplicate=structuredClone(good);duplicate.finishedBooks.push(book());assert.throws(()=>s.save(duplicate,s.revision));
 assert.equal(new Store(s.root).state.finishedBooks.length,1);
});

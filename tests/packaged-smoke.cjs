'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const executable=process.env.DAYNOTE_TEST_EXE || path.join(root,'app-portable/Daynote.exe');
const home=path.join(root,'.cache/packaged-smoke-'+Date.now());
const results=path.join(root,'test-results');
fs.mkdirSync(home,{recursive:true});fs.mkdirSync(results,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function getPort(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
async function connect(url){
 const socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let id=0;const pending=new Map();
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const p=pending.get(message.id);if(!p)return;pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);};
 return {close:()=>socket.close(),send(method,params={}){return new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout: '+method));},8000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});}};
}
async function run(restart){
 const port=await getPort();
 const output=fs.openSync(path.join(results,'packaged-runtime.log'),'a');
 const child=spawn(executable,['--daynote-home='+home,'--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1'],{stdio:['ignore',output,output]});
 const exited=new Promise(resolve=>{child.once('exit',resolve);child.once('error',resolve);});
 let main,widget;
 try{
  for(let i=0;i<150;i++){
   if(child.exitCode!==null)throw Error('Packaged app exited before loading');
   try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(500)});const pages=await response.json();const a=pages.find(p=>p.type==='page'&&p.url.includes('mode=main')),b=pages.find(p=>p.type==='page'&&p.url.includes('mode=widget'));if(a&&b){main=await connect(a.webSocketDebuggerUrl);widget=await connect(b.webSocketDebuggerUrl);break;}}catch{}
   await pause(100);
  }
  assert.ok(main&&widget,'packaged renderer targets available');
  const evaluate=async(connection,expression)=>{const r=await connection.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+': '+JSON.stringify(r.exceptionDetails.exception));return r.result.value;};
  for(const connection of [main,widget]){
   let loaded=false;
   for(let i=0;i<150;i++){if(await evaluate(connection,"Boolean(window.daynote && document.body?.classList.contains('native-app'))")){loaded=true;break;}await pause(100);}
   assert.equal(loaded,true,'renderer finished initializing');
  }
  assert.equal(await evaluate(main,'typeof require'),'undefined');
  const settings=await evaluate(main,'window.daynote.settings()');
  assert.equal(settings.version,require('../package.json').version);assert.equal(settings.appHome,home);
  if(restart){assert.equal(await evaluate(main,"state.tasks.some(t=>t.title==='安装包验证任务'&&t.done)"),true);assert.equal(await evaluate(main,'state.finishedBooks.length'),2);assert.equal(await evaluate(main,"state.finishedBooks[0].cover.startsWith('data:image/jpeg;base64,')"),true);console.log('PASS packaged executable restart persistence including shelf and covers');}
  else{
   assert.equal(await evaluate(main,'state.tasks.length'),0);
   await evaluate(main,"addTask('安装包验证任务',1,today)");await pause(200);
   assert.equal(await evaluate(widget,'state.tasks.length'),1);
   await evaluate(widget,"document.querySelector('#widget-list input').click()");await pause(200);
   assert.equal(await evaluate(main,'state.tasks[0].done'),true);
   assert.equal(await evaluate(main,"getComputedStyle(document.querySelector('#nav-today')).backgroundColor"),'rgb(75, 75, 75)');
   assert.notEqual(await evaluate(widget,"getComputedStyle(document.querySelector('#pin-widget')).display"),'none');
   await evaluate(main,"editBook();var f=document.querySelector('#editor-form');f.elements.title.value='深度工作';f.elements.author.value='卡尔·纽波特';f.elements.current.value='280';f.elements.total.value='280';");
   const documentRoot=await main.send('DOM.getDocument');
   const fileInput=await main.send('DOM.querySelector',{nodeId:documentRoot.root.nodeId,selector:'#cover-file'});
   await main.send('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[path.join(root,'assets/cat.png')]});
   for(let i=0;i<100;i++){if(await evaluate(main,"bookCoverDraft.startsWith('data:image/jpeg;base64,')"))break;await pause(100);}
   assert.equal(await evaluate(main,"bookCoverDraft.startsWith('data:image/jpeg;base64,')"),true);
   await evaluate(main,"document.querySelector('#editor-form').requestSubmit(document.querySelector('#editor-form > .dialog-actions .primary-button'))");
   assert.equal(await evaluate(main,'state.finishedBooks.length'),0,'normal save does not finish a book');
   assert.equal(await evaluate(main,'state.book.current'),280);
   await evaluate(main,"document.querySelector('#finish-reading').click();document.querySelector('#editor-form').requestSubmit(document.querySelector('#editor-form > .dialog-actions .primary-button'))");
   assert.equal(await evaluate(main,'state.finishedBooks.length'),1);
   assert.equal(await evaluate(main,'state.book.title'),'');
   await evaluate(main,"editFinishedBook();var f=document.querySelector('#editor-form');f.elements.title.value='以前读完的一本书';f.elements.author.value='作者';f.elements.finishedOn.value=plusDays(today,-3);f.requestSubmit()");
   assert.equal(await evaluate(main,'state.finishedBooks.length'),2);
   await evaluate(main,"editFinishedBook(state.finishedBooks[0].id);document.querySelector('#remove-cover').click();closeEditor()");
   assert.equal(await evaluate(main,"state.finishedBooks[0].cover.startsWith('data:image/jpeg;base64,')"),true,'cancel keeps the saved cover');
   const todayWidths=await evaluate(main,"[document.querySelector('#quadrants').getBoundingClientRect().width,document.querySelector('.right-column').getBoundingClientRect().width]");
   await evaluate(main,"addTask('回顾昨天完成的计划',2,plusDays(today,-1));document.querySelector('#nav-history').click()");
   const historyWidths=await evaluate(main,"[document.querySelector('.history-records').getBoundingClientRect().width,document.querySelector('.bookshelf').getBoundingClientRect().width]");
   assert.deepEqual(historyWidths,todayWidths,'history and dashboard share column proportions');
   assert.equal(await evaluate(main,"document.querySelectorAll('.finished-book').length"),2);
   assert.equal(await evaluate(main,"document.querySelector('.finished-book img').naturalWidth>0"),true);
   await pause(2400);
   fs.writeFileSync(path.join(results,'history-books.png'),Buffer.from((await main.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   console.log('PASS actual cover file upload, normal save, completion archive, manual entry, cancel edits, history layout and cover display');
   await evaluate(main,"document.querySelector('#nav-today').click()");
   await pause(500);
   const screenshot=await main.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(results,'packaged-main.png'),Buffer.from(screenshot.data,'base64'));
   await evaluate(main,"window.daynote.window('widget')");await pause(300);
   const widgetShot=await widget.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(results,'packaged-widget.png'),Buffer.from(widgetShot.data,'base64'));
   console.log('PASS packaged launch, preload, empty data, two-window sync, task completion, dark selected button and visible pin');
  }
  await evaluate(main,"window.daynote.window('quit')").catch(()=>{});
  await Promise.race([exited,pause(3000)]);
 }finally{main?.close();widget?.close();if(child.exitCode===null)child.kill();await exited;fs.closeSync(output);}
}
(async()=>{await run(false);await run(true);console.log('PASS all packaged executable tests');})().catch(error=>{console.error(error);process.exitCode=1});

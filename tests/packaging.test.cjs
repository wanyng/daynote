'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const afterPack=require('../scripts/after-pack.cjs');
const root=path.resolve(__dirname,'../.cache/tests');
fs.mkdirSync(root,{recursive:true});
test('uninstall manifest only deletes packaged files and never recursively removes user directories',async()=>{
 const project=fs.mkdtempSync(path.join(root,'pack-'));
 const appOutDir=path.join(project,'app');fs.mkdirSync(path.join(appOutDir,'resources'),{recursive:true});fs.mkdirSync(path.join(project,'build'));
 fs.writeFileSync(path.join(appOutDir,'Daynote.exe'),'fixture');fs.writeFileSync(path.join(appOutDir,'resources/app.asar'),'fixture');
 await afterPack({electronPlatformName:'win32',appOutDir,packager:{projectDir:project}});
 const script=fs.readFileSync(path.join(project,'build/remove-files.nsh'),'utf8');
 assert.match(script,/Delete .*Daynote\.exe/);assert.match(script,/Delete .*app\.asar/);
 assert.doesNotMatch(script,/RMDir\s+\/r/i);assert.doesNotMatch(script,/Delete.*\*/);assert.doesNotMatch(script,/state\.json/);
 fs.writeFileSync(path.join(appOutDir,'daynote.config.json'),'{}');
 await assert.rejects(()=>afterPack({electronPlatformName:'win32',appOutDir,packager:{projectDir:project}}),/Personal data/);
});

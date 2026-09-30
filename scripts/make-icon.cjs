'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const size=256,raw=Buffer.alloc((size*4+1)*size);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const offset=y*(size*4+1)+1+x*4;
 const edge=(x<24&&y<24&&Math.hypot(x-24,y-24)>24)||(x>231&&y<24&&Math.hypot(x-231,y-24)>24)||(x<24&&y>231&&Math.hypot(x-24,y-231)>24)||(x>231&&y>231&&Math.hypot(x-231,y-231)>24);
 let shade=238;
 for(const [left,top] of [[49,49],[141,49],[49,141],[141,141]]){if(x>=left&&x<left+66&&y>=top&&y<top+66)shade=(x<left+7||x>=left+59||y<top+7||y>=top+59)?85:225;}
 raw[offset]=shade;raw[offset+1]=shade;raw[offset+2]=shade;raw[offset+3]=edge?0:255;
}
function crc(buffer){let c=0xffffffff;for(const byte of buffer){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),sum=Buffer.alloc(4);length.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([length,name,data,sum])}
const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
const dir=path.resolve(__dirname,'../build');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'icon.png'),png);fs.writeFileSync(path.join(dir,'icon.ico'),Buffer.concat([ico,png]));

'use strict';
// Dependency-free ASAR patcher. All source application bytes stay on the user's PC.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {parseArgs} = require('node:util');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
function fileHash(file) {
  const hash=crypto.createHash('sha256'), fd=fs.openSync(file,'r'), block=Buffer.alloc(4*1024*1024);
  try { let n; while((n=fs.readSync(fd,block,0,block.length,null)))hash.update(block.subarray(0,n)); }
  finally {fs.closeSync(fd);}
  return hash.digest('hex');
}
function openArchive(file) {
  const fd=fs.openSync(file,'r');
  try {
    const size=fs.fstatSync(fd).size, preamble=Buffer.alloc(16);
    if(fs.readSync(fd,preamble,0,16,0)!==16 || preamble.readUInt32LE(0)!==4)throw Error('Invalid ASAR preamble.');
    const headerSize=preamble.readUInt32LE(4), jsonLength=preamble.readUInt32LE(12);
    if(jsonLength<2 || jsonLength>32*1024*1024 || headerSize<jsonLength+8 || 8+headerSize>size)throw Error('Invalid ASAR header bounds.');
    const json=Buffer.alloc(jsonLength);
    if(fs.readSync(fd,json,0,jsonLength,16)!==jsonLength)throw Error('Incomplete ASAR header.');
    const header=JSON.parse(json.toString('utf8')), entries=[];
    function walk(node,prefix='') {
      for(const [name,entry] of Object.entries(node.files??{})) {
        if(!name || ['.','..'].includes(name) || /[\\/]/.test(name))throw Error('Unsafe ASAR entry.');
        const key=prefix?prefix+'/'+name:name;
        if(entry.files)walk(entry,key);
        else {
          if(!entry.unpacked&&!entry.link && (!Number.isSafeInteger(entry.size)||entry.size<0||!/^\d+$/.test(String(entry.offset))||!Number.isSafeInteger(Number(entry.offset))||8+headerSize+Number(entry.offset)+entry.size>size))throw Error('Invalid ASAR entry bounds: '+key);
          entries.push({key,entry,originalOffset:entry.offset});
        }
      }
    }
    walk(header);
    const read=key=>{
      const item=entries.find(e=>e.key===key);
      if(!item || item.entry.unpacked || item.entry.link)throw Error('Packed application file is missing: '+key);
      if(item.entry.size>64*1024*1024)throw Error('Unexpectedly large patch candidate: '+key);
      const b=Buffer.alloc(item.entry.size);
      if(fs.readSync(fd,b,0,b.length,8+headerSize+Number(item.originalOffset))!==b.length)throw Error('Incomplete ASAR entry.');
      return b;
    };
    return {fd,header,json,headerSize,entries,read,close:()=>fs.closeSync(fd)};
  } catch(error) {fs.closeSync(fd);throw error;}
}
function inspect(appDir,projectRoot,compatibility) {
  const archive=path.join(appDir,'resources','app.asar'), exePath=path.join(appDir,'ChatGPT.exe');
  const sourceHash=fileHash(archive);
  const support=compatibility.sourcePackages.find(p=>p.archiveSha256===sourceHash);
  if(!support)throw Error('This Codex version is not supported by Liquid Glass '+compatibility.releaseVersion+'. No application files were changed. Install a compatible release or check this project for an update. Detected archive SHA256: '+sourceHash);
  const source=openArchive(archive);
  try {
    const needle='applyWindowBackdrop(e,t,n){';
    const candidates=source.entries.filter(e=>/^\.vite\/build\/main-[^/]+\.js$/.test(e.key))
      .map(e=>({key:e.key,body:source.read(e.key).toString('utf8')})).filter(e=>e.body.includes(needle));
    if(candidates.length!==1 || candidates[0].body.split(needle).length!==2)throw Error('The native backdrop integration point is not unique. No files were changed.');
    const main=candidates[0];
    if(main.body.includes('glass-main.cjs'))throw Error('This local source already contains Liquid Glass. Use the original official installation.');
    const preloadKey='.vite/build/preload.js',preload=source.read(preloadKey).toString('utf8');
    if(preload.includes('codexLiquidGlass'))throw Error('This local source is already customized.');
    const exe=fs.readFileSync(exePath), previousHash=digest(source.json);
    const hashOffset=exe.indexOf(previousHash);
    if(hashOffset<0 || exe.indexOf(previousHash,hashOffset+1)>=0)throw Error('The executable archive-integrity metadata is not unique. No files were changed.');
    if(exe.toString('ascii',0,2)!=='MZ' || exe.readUInt16LE(exe.readUInt32LE(0x3c)+4)!==0x8664)throw Error('Only the verified Windows x64 executable is supported.');
    for(const name of ['glass-main.cjs','glass-preload.cjs','glass-renderer.js','glass.css'])fs.accessSync(path.join(projectRoot,'src',name));
    return {sourceHash,support,mainKey:main.key,preloadKey,hashOffset,headerSha256:previousHash};
  } finally {source.close();}
}
function patch(appDir,projectRoot,compatibility) {
  const info=inspect(appDir,projectRoot,compatibility);
  const archive=path.join(appDir,'resources','app.asar'),exePath=path.join(appDir,'ChatGPT.exe');
  const source=openArchive(archive), replacements=new Map();
  const tempArchive=archive+'.glass.tmp',tempExe=exePath+'.glass.tmp';
  let dest;
  try {
    const original=source.read(info.mainKey).toString('utf8'),needle='applyWindowBackdrop(e,t,n){';
    replacements.set(info.mainKey,Buffer.from('const __codexGlass=require("./glass-main.cjs");\n'+original.replace(needle,needle+'if(__codexGlass.applyWindow(e,t,()=>this.applyWindowBackdrop(e,t,!0)))return;')));
    replacements.set(info.preloadKey,Buffer.concat([source.read(info.preloadKey),Buffer.from('\n'),fs.readFileSync(path.join(projectRoot,'src','glass-preload.cjs'))]));
    for(const name of ['glass-main.cjs','glass-renderer.js','glass.css'])replacements.set('.vite/build/'+name,fs.readFileSync(path.join(projectRoot,'src',name)));
    for(const key of replacements.keys())if(!source.entries.some(e=>e.key===key)){
      let node=source.header;const names=key.split('/');
      for(const name of names.slice(0,-1)) {node.files??={};node.files[name]??={files:{}};node=node.files[name];}
      const entry=node.files[names.at(-1)]={size:0,offset:'0'};
      source.entries.push({key,entry,originalOffset:null});
    }
    const packed=source.entries.filter(e=>!e.entry.unpacked&&!e.entry.link).sort((a,b)=>Number(a.originalOffset??Number.MAX_SAFE_INTEGER)-Number(b.originalOffset??Number.MAX_SAFE_INTEGER));
    let offset=0;
    for(const item of packed){
      const data=replacements.get(item.key);
      if(data){
        const blocks=[];for(let n=0;n<data.length;n+=4194304)blocks.push(digest(data.subarray(n,n+4194304)));
        item.entry.size=data.length;item.entry.integrity={algorithm:'SHA256',hash:digest(data),blockSize:4194304,blocks};
      }
      item.entry.offset=String(offset);offset+=item.entry.size;
    }
    const payload=Buffer.from(JSON.stringify(source.header)),aligned=(payload.length+3)&~3;
    const headerBuffer=Buffer.alloc(8+aligned);headerBuffer.writeUInt32LE(4+aligned,0);headerBuffer.writeUInt32LE(payload.length,4);payload.copy(headerBuffer,8);
    const sizeBuffer=Buffer.alloc(8);sizeBuffer.writeUInt32LE(4,0);sizeBuffer.writeUInt32LE(headerBuffer.length,4);
    dest=fs.openSync(tempArchive,'wx');fs.writeSync(dest,sizeBuffer);fs.writeSync(dest,headerBuffer);
    const block=Buffer.alloc(4194304);
    for(const item of packed){
      const data=replacements.get(item.key);if(data){fs.writeSync(dest,data);continue;}
      let done=0;
      while(done<item.entry.size){const bytes=Math.min(block.length,item.entry.size-done);const n=fs.readSync(source.fd,block,0,bytes,8+source.headerSize+Number(item.originalOffset)+done);if(n!==bytes)throw Error('Unexpected end of source archive.');fs.writeSync(dest,block,0,n);done+=n;}
    }
    fs.closeSync(dest);dest=undefined;
    const exe=fs.readFileSync(exePath),nextHash=digest(payload);exe.write(nextHash,info.hashOffset,64,'ascii');fs.writeFileSync(tempExe,exe,{flag:'wx'});
    source.close();
    // This function is run only in a disposable installation staging directory.
    fs.renameSync(tempArchive,archive);fs.renameSync(tempExe,exePath);
    const iniPath=path.join(appDir,'resources','owl-app.ini');
    const ini=fs.readFileSync(iniPath,'utf8');
    if(!/^UserDataDirectoryName=.*$/m.test(ini))throw Error('Missing isolated-profile configuration.');
    fs.writeFileSync(iniPath,ini.replace(/^UserDataDirectoryName=.*$/m,'UserDataDirectoryName=CodexLiquidGlass'));
    return {releaseVersion:compatibility.releaseVersion,customizationRevision:compatibility.customizationRevision,sourcePackageVersion:info.support.storePackageVersion,sourceArchiveSha256:info.sourceHash,archiveSha256:fileHash(archive),executableSha256:fileHash(exePath),headerSha256:nextHash,integrityVerificationEnabled:true,officialSignatureValid:false,profileName:'CodexLiquidGlass',modifiedFiles:[...replacements.keys(),'ChatGPT.exe archive-integrity metadata','resources/owl-app.ini']};
  } finally {
    if(dest!==undefined)fs.closeSync(dest);
    try{source.close();}catch{}
    for(const file of [tempArchive,tempExe])if(fs.existsSync(file))fs.unlinkSync(file);
  }
}
module.exports={openArchive,fileHash,inspect,patch};
if(require.main===module){
  try {
    const {values}=parseArgs({options:{app:{type:'string'},project:{type:'string'},check:{type:'boolean'},output:{type:'string'}}});
    if(!values.app||!values.project)throw Error('Usage: node patch.cjs --app <local app directory> --project <project directory> [--check] [--output <manifest.json>]');
    const project=path.resolve(values.project),compatibility=JSON.parse(fs.readFileSync(path.join(project,'compatibility.json'),'utf8'));
    const result=values.check?inspect(path.resolve(values.app),project,compatibility):patch(path.resolve(values.app),project,compatibility);
    if(values.output)fs.writeFileSync(values.output,JSON.stringify(result,null,2));
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch(error){process.stderr.write('Liquid Glass: '+error.message+'\n');process.exitCode=1;}
}

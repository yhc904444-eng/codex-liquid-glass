'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {openArchive,fileHash,inspect,patch}=require('../scripts/patch.cjs');
const project=path.resolve(__dirname,'..');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function makeFixture(t,options={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'glass-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const app=path.join(root,'app'),resources=path.join(app,'resources');fs.mkdirSync(resources,{recursive:true});
  const main=Buffer.from('class Example{applyWindowBackdrop(e,t,n){return n;} }'+(options.duplicate?'class Another{applyWindowBackdrop(e,t,n){}}':''));
  const preload=Buffer.from('const x = 1;'),other=Buffer.from([0,1,2,3,255]);
  const header={files:{'.vite':{files:{build:{files:{
    'main-fixture.js':{size:main.length,offset:'0'},
    'preload.js':{size:preload.length,offset:String(main.length)},
    'untouched.bin':{size:other.length,offset:String(main.length+preload.length)},
    'native.node':{size:10,unpacked:true},
    'alias':{link:'.vite/build/untouched.bin'}
  }}}}}};
  const json=Buffer.from(JSON.stringify(header)),aligned=(json.length+3)&~3;
  const pre=Buffer.alloc(16+aligned);pre.writeUInt32LE(4,0);pre.writeUInt32LE(8+aligned,4);pre.writeUInt32LE(4+aligned,8);pre.writeUInt32LE(json.length,12);json.copy(pre,16);
  const archive=path.join(resources,'app.asar');fs.writeFileSync(archive,Buffer.concat([pre,main,preload,other]));
  const exe=Buffer.alloc(8192);exe.write('MZ');exe.writeUInt32LE(0x80,0x3c);exe.write('PE\0\0',0x80);exe.writeUInt16LE(0x8664,0x84);exe.write(sha(json),0x1000);
  fs.writeFileSync(path.join(app,'ChatGPT.exe'),exe);fs.writeFileSync(path.join(resources,'owl-app.ini'),'[Owl]\r\nUserDataDirectoryName=Codex\r\nAppVersion=fixture\r\n');
  const compatibility={releaseVersion:'1.0.0-test',customizationRevision:'test',sourcePackages:[{storePackageVersion:'fixture',archiveSha256:fileHash(archive)}]};
  return {root,app,archive,exe:path.join(app,'ChatGPT.exe'),compatibility,main,preload,other};
}
test('known source detects the main file without relying on its hashed filename',t=>{
  const f=makeFixture(t),before=fileHash(f.archive),info=inspect(f.app,project,f.compatibility);
  assert.equal(info.mainKey,'.vite/build/main-fixture.js');assert.equal(before,fileHash(f.archive));
});
test('unsupported source fails before changing either application file',t=>{
  const f=makeFixture(t),before=[fileHash(f.archive),fileHash(f.exe)];
  f.compatibility.sourcePackages=[];
  assert.throws(()=>patch(f.app,project,f.compatibility),/not supported/);
  assert.deepEqual([fileHash(f.archive),fileHash(f.exe)],before);
  assert.equal(fs.readdirSync(path.dirname(f.archive)).some(name=>name.endsWith('.tmp')),false);
});
test('nonunique native integration point is rejected without modifying source',t=>{
  const f=makeFixture(t,{duplicate:true}),before=fileHash(f.archive);
  assert.throws(()=>patch(f.app,project,f.compatibility),/not unique/);assert.equal(fileHash(f.archive),before);
});
test('repackaging preserves unrelated packed, unpacked and link entries and matches executable integrity metadata',t=>{
  const f=makeFixture(t),manifest=patch(f.app,project,f.compatibility),a=openArchive(f.archive);
  try {
    assert.deepEqual(a.read('.vite/build/untouched.bin'),f.other);
    assert.equal(a.entries.find(e=>e.key.endsWith('native.node')).entry.unpacked,true);
    assert.equal(a.entries.find(e=>e.key.endsWith('alias')).entry.link,'.vite/build/untouched.bin');
    for(const name of ['glass-main.cjs','glass-renderer.js','glass.css']){
      const key='.vite/build/'+name,data=a.read(key),entry=a.entries.find(e=>e.key===key).entry;
      assert.deepEqual(data,fs.readFileSync(path.join(project,'src',name)));
      assert.equal(entry.integrity.hash,sha(data));assert.equal(entry.integrity.blocks[0],sha(data));
    }
    assert.match(a.read('.vite/build/main-fixture.js').toString(),/__codexGlass\.applyWindow/);
    assert.match(a.read('.vite/build/preload.js').toString(),/codexLiquidGlass/);
    const headerHash=sha(a.json);
    assert.equal(manifest.headerSha256,headerHash);
    assert.equal(fs.readFileSync(f.exe).toString('ascii',0x1000,0x1040),headerHash);
    assert.equal(manifest.integrityVerificationEnabled,true);assert.equal(manifest.officialSignatureValid,false);
    assert.match(fs.readFileSync(path.join(f.app,'resources','owl-app.ini'),'utf8'),/UserDataDirectoryName=CodexLiquidGlass/);
  }finally{a.close();}
});
test('malformed archive bounds are rejected',t=>{
  const f=makeFixture(t),data=fs.readFileSync(f.archive);data.writeUInt32LE(0x7fffffff,12);fs.writeFileSync(f.archive,data);
  assert.throws(()=>openArchive(f.archive),/bounds/);
});
test('release renderer compiles and English controls retain the settings integration',()=>{
  const renderer=fs.readFileSync(path.join(project,'src','glass-renderer.js'),'utf8');
  assert.doesNotThrow(()=>new vm.Script('('+renderer+')'));
  assert.match(renderer,/Workspace transparency/);assert.match(renderer,/mountSettingsGlass\(\)/);
  const css=fs.readFileSync(path.join(project,'src','glass.css'),'utf8');
  assert.match(css,/html\.lg-enabled \[data-lg-settings-shell\]/);assert.match(css,/\[role="tooltip"\]/);
});

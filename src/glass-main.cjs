'use strict';
const {app, BrowserWindow, ipcMain, screen} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const managed = new Map();
const defaults={enabled:true, opacity:8, highlights:48, workspaceTransparency:94, composerTransparency:90, blur:3};
let state = {...defaults};
let settingsPath;
const renderer = fs.readFileSync(path.join(__dirname,'glass-renderer.js'),'utf8');
const css = fs.readFileSync(path.join(__dirname,'glass.css'),'utf8');
function normalize(input) {
  if (!input || typeof input.enabled !== 'boolean') throw new Error('Invalid glass settings');
  for (const key of ['opacity','highlights']) if (!Number.isFinite(input[key])) throw new Error('Invalid '+key);
  const composerTransparency=input.composerTransparency??defaults.composerTransparency;
  if(!Number.isFinite(composerTransparency))throw new Error('Invalid composer transparency');
  const workspaceTransparency=input.workspaceTransparency??defaults.workspaceTransparency;
  if(!Number.isFinite(workspaceTransparency))throw new Error('Invalid workspace transparency');
  const blur=input.blur??defaults.blur;
  if(!Number.isFinite(blur))throw new Error('Invalid blur');
  return {enabled:input.enabled,opacity:Math.round(Math.max(0,Math.min(85,input.opacity))),highlights:Math.round(Math.max(0,Math.min(100,input.highlights))),workspaceTransparency:Math.round(Math.max(0,Math.min(95,workspaceTransparency))),composerTransparency:Math.round(Math.max(0,Math.min(95,composerTransparency))),blur:Math.round(Math.max(0,Math.min(16,blur)))};
}
function allowed(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const url=new URL(event.sender.getURL());
  const localApp=url.protocol==='app:' && url.hostname==='-' && ['/index.html','/detached-window.html'].includes(url.pathname);
  if (!win || !managed.has(win.id) || !localApp || event.senderFrame?.parent) throw new Error('Glass settings unavailable in this window');
}
function inject(win) {
  if(win.isDestroyed()) return;
  win.webContents.executeJavaScript(`(${renderer})(${JSON.stringify(state)},${JSON.stringify(css)},${app.commandLine.hasSwitch('liquid-glass-settings')})`).then(()=>syncWindowFrame(win)).catch(error=>console.error('[Liquid Glass] Renderer:',error.message));
}
function syncWindowFrame(win) {
  if(win.isDestroyed())return;
  const expanded=win.isMaximized()||win.isFullScreen();
  win.webContents.executeJavaScript(`document.documentElement.classList.toggle('lg-window-expanded',${expanded})`).catch(()=>{});
}
app.whenReady().then(()=>{
  try { if(process.platform==='win32'&&typeof app.setAppUserModelId==='function')app.setAppUserModelId('CodexGlass.Desktop'); } catch(error) { console.error('[Glass] Window identity:',error.message); }
  settingsPath = path.join(app.getPath('userData'),'liquid-glass.json');
  try { state=normalize(JSON.parse(fs.readFileSync(settingsPath,'utf8'))); } catch(error) { if(error.code!=='ENOENT') console.error('[Liquid Glass] Settings:',error.message); }
  ipcMain.handle('codex-preview:glass:get',event=>{allowed(event);return state;});
  ipcMain.handle('codex-preview:glass:set',(event,input)=>{
    allowed(event);
    const next=normalize(input);
    fs.writeFileSync(settingsPath+'.tmp',JSON.stringify(next,null,2));
    fs.renameSync(settingsPath+'.tmp',settingsPath);
    state=next;
    for(const [id,restore] of managed) {
      const win=BrowserWindow.fromId(id);
      if(!win || win.isDestroyed()) continue;
      restore();
      if(win.webContents.id!==event.sender.id)win.webContents.send('codex-preview:glass:changed',state);
    }
    return state;
  });
});
exports.applyWindow = function(win,appearance,restore) {
  if(process.platform!=='win32' || !['primary','detached'].includes(appearance)) return false;
  if(!managed.has(win.id)) {
    if(appearance==='primary'&&app.commandLine.hasSwitch('liquid-glass-preview-4-3'))win.webContents.once('dom-ready',()=>{
      const area=screen.getDisplayMatching(win.getBounds()).workArea;
      const width=Math.floor(Math.min(1280,area.width*.9,area.height*.88*4/3)/4)*4;
      const height=width*3/4;
      if(win.isMaximized())win.unmaximize();
      win.setBounds({x:Math.round(area.x+(area.width-width)/2),y:Math.round(area.y+(area.height-height)/2),width,height});
    });
    win.webContents.on('dom-ready',()=>inject(win));
    for(const event of ['maximize','unmaximize','enter-full-screen','leave-full-screen'])win.on(event,()=>syncWindowFrame(win));
    win.once('closed',()=>managed.delete(win.id));
  }
  managed.set(win.id,restore);
  if(!state.enabled) return false;
  win.setBackgroundColor('#00000000');
  win.setBackgroundMaterial('acrylic');
  return true;
};

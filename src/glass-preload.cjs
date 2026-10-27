;(()=>{
  const {contextBridge,ipcRenderer}=require('electron');
  contextBridge.exposeInMainWorld('codexLiquidGlass',Object.freeze({
    get:()=>ipcRenderer.invoke('codex-preview:glass:get'),
    set:value=>ipcRenderer.invoke('codex-preview:glass:set',value),
    onChange:callback=>{
      const handler=(_event,value)=>callback(value);
      ipcRenderer.on('codex-preview:glass:changed',handler);
      return ()=>ipcRenderer.removeListener('codex-preview:glass:changed',handler);
    }
  }));
})();

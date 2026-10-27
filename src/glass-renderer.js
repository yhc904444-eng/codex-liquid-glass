function(initial,css,openSettings) {
  if(window.__codexGlassPreview) return;
  window.__codexGlassPreview=true;
  let state={...initial},pending=Promise.resolve(),saveTimer;
  const root=document.documentElement;
  const style=document.createElement('style');
  style.id='codex-liquid-glass-style';style.textContent=css;document.head.append(style);
  // Settings is a route with nested opaque containers, rather than one dialog.
  // Tag its layout surfaces without moving React nodes or fading their text.
  const mountSettingsGlass=()=>{
    const page=document.querySelector('[class~="group/settings"]');
    const shell=page?.closest('main');
    for(const previous of document.querySelectorAll('[data-lg-settings-shell]')){
      if(previous===shell)continue;
      previous.removeAttribute('data-lg-settings-shell');
      for(const layer of previous.querySelectorAll('[data-lg-settings-layer]'))layer.removeAttribute('data-lg-settings-layer');
    }
    if(!shell)return;
    shell.setAttribute('data-lg-settings-shell','');
    for(const el of shell.querySelectorAll('div,main,section,aside,nav,header')){
      if(el.hasAttribute('data-lg-settings-layer')||el.id==='lg-settings'||el.closest('#lg-settings,button,input,textarea,select,[role="button"],[role="tab"],[role="switch"]'))continue;
      const fill=getComputedStyle(el).backgroundColor;
      const values=fill.match(/[\d.]+/g)?.map(Number);
      if(values&&values.length>=3&&(values.length===3||values[3]>.94))el.setAttribute('data-lg-settings-layer','');
    }
  };
  // Paint one material behind the native project rail and editor without moving React nodes.
  const homeComposers=new Map();
  let homeFrame;
  const syncHomeGlass=()=>{
    homeFrame=undefined;
    for(const [host,entry] of homeComposers){
      if(!host.isConnected){entry.resize.disconnect();homeComposers.delete(host);continue;}
      const {rail,body}=entry;
      const railRect=rail.getBoundingClientRect(),bodyRect=body.getBoundingClientRect();
      const joined=railRect.height>0&&bodyRect.height>0&&!host.querySelector('[data-expanded-composer]');
      host.toggleAttribute('data-lg-home-glass',joined);
      if(!joined)continue;
      const hostRect=host.getBoundingClientRect();
      host.style.setProperty('--lg-home-glass-top',(railRect.top-hostRect.top)+'px');
      host.style.setProperty('--lg-home-glass-height',(bodyRect.bottom-railRect.top)+'px');
    }
  };
  const queueHomeGlass=()=>{if(homeFrame===undefined)homeFrame=requestAnimationFrame(syncHomeGlass);};
  const mountHomeGlass=()=>{
    for(const host of document.querySelectorAll('[data-codex-composer-root][data-composer-placement="home"]')){
      const rail=host.querySelector(':scope > [data-composer-rail][data-composer-rail-placement="above"]');
      const body=host.querySelector('[data-composer-body]');
      const previous=homeComposers.get(host);
      if(previous?.rail===rail&&previous?.body===body)continue;
      previous?.resize.disconnect();homeComposers.delete(host);host.removeAttribute('data-lg-home-glass');
      if(!rail?.querySelector('[data-composer-utility-rail]')||!body)continue;
      const resize=new ResizeObserver(()=>{
        if(homeFrame!==undefined)cancelAnimationFrame(homeFrame);
        syncHomeGlass();
      });
      homeComposers.set(host,{rail,body,resize});
      for(const element of [host,rail,body])resize.observe(element);
    }
    queueHomeGlass();
  };
  const apply=()=>{
    root.classList.toggle('lg-enabled',state.enabled);
    root.style.setProperty('--lg-tint',String(state.opacity/100));
    root.style.setProperty('--lg-light',String(state.highlights/100));
    root.style.setProperty('--lg-workspace-alpha',String(1-(state.workspaceTransparency??94)/100));
    root.style.setProperty('--lg-composer-alpha',String(1-(state.composerTransparency??90)/100));
    root.style.setProperty('--lg-blur',(state.blur??3)+'px');
    for(const [key,value] of Object.entries(state)) {
      const element=document.getElementById('lg-'+key);
      if(!element) continue;
      if(element.type==='checkbox') element.checked=value;
      else element.value=value;
      const output=document.getElementById('lg-'+key+'-value');
      if(output)output.textContent=value+(key==='blur'?'px':'%');
    }
  };
  const save=()=>{
    const snapshot={...state};
    pending=pending.then(()=>window.codexLiquidGlass.set(snapshot)).then(saved=>{
      const status=document.getElementById('lg-status');if(status)status.textContent='Saved - applied immediately';
    }).catch(async error=>{
      const status=document.getElementById('lg-status');if(status)status.textContent='Could not save: '+error.message;
      try{state=await window.codexLiquidGlass.get();apply();}catch{}
    });
  };
  const update=(key,value)=>{
    state={...state,[key]:value};apply();
    clearTimeout(saveTimer);saveTimer=setTimeout(save,key==='enabled'?0:160);
  };
  const mount=()=>{
    if(document.getElementById('lg-settings'))return;
    const headings=[...document.querySelectorAll('h1,h2,h3,[role="heading"]')];
    const title=headings.find(e=>/^(外观|Appearance)$/.test(e.textContent.trim()));
    if(!title)return;
    const section=document.createElement('section');section.id='lg-settings';section.setAttribute('aria-label','Liquid Glass settings');
    section.innerHTML=`<div class="lg-card-title"><span class="lg-glint">◈</span><div><h3>Liquid Glass</h3><p>Clear materials, soft blur, and a continuous window surface</p></div></div>
      <label class="lg-setting"><span><strong>Enable Liquid Glass</strong><small>Windows composites the desktop backdrop in real time</small></span><input id="lg-enabled" type="checkbox" role="switch" aria-label="Enable Liquid Glass"></label>
      <label class="lg-setting"><span><strong>Glass tint</strong><small>Lower values make the neutral tint more transparent</small></span><span class="lg-slider"><input id="lg-opacity" type="range" min="0" max="85" step="1" aria-label="Glass tint"><output id="lg-opacity-value"></output></span></label>
      <label class="lg-setting"><span><strong>Edge highlights</strong><small>Adjust the soft highlights around glass edges</small></span><span class="lg-slider"><input id="lg-highlights" type="range" min="0" max="100" step="1" aria-label="Edge highlights"><output id="lg-highlights-value"></output></span></label>
      <label class="lg-setting"><span><strong>Workspace transparency</strong><small>Set the conversation and sidebar transparency independently</small></span><span class="lg-slider"><input id="lg-workspaceTransparency" type="range" min="0" max="95" step="1" aria-label="Workspace transparency"><output id="lg-workspaceTransparency-value"></output></span></label>
      <label class="lg-setting"><span><strong>Composer transparency</strong><small>Higher values are clearer; text and controls stay readable</small></span><span class="lg-slider"><input id="lg-composerTransparency" type="range" min="0" max="95" step="1" aria-label="Composer transparency"><output id="lg-composerTransparency-value"></output></span></label>
      <div class="lg-composer-demo"><div class="lg-composer-preview" aria-hidden="true"><span>Glass composer preview</span><span class="lg-demo-send">↑</span></div></div>
      <label class="lg-setting"><span><strong>Additional blur</strong><small>Adjust panel blur; Windows controls the desktop backdrop blur</small></span><span class="lg-slider"><input id="lg-blur" type="range" min="0" max="16" step="1" aria-label="Additional blur"><output id="lg-blur-value"></output></span></label>
      <div class="lg-card-footer"><span id="lg-status">Settings are saved on this device</span><button id="lg-reset" type="button">Restore defaults</button></div>`;
    const host=title.closest('header')??title;
    host.insertAdjacentElement('afterend',section);
    for(const key of ['enabled','opacity','highlights','workspaceTransparency','composerTransparency','blur']) {
      const el=section.querySelector('#lg-'+key);
      el.addEventListener('input',()=>update(key,key==='enabled'?el.checked:Number(el.value)));
    }
    section.querySelector('#lg-reset').addEventListener('click',()=>{state={enabled:true,opacity:8,highlights:48,workspaceTransparency:94,composerTransparency:90,blur:3};apply();save();});
    apply();
  };
  apply();mount();mountHomeGlass();mountSettingsGlass();
  const observer=new MutationObserver(()=>{mount();mountHomeGlass();mountSettingsGlass();});observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',queueHomeGlass,{passive:true});
  if(window.codexLiquidGlass) {
    window.codexLiquidGlass.get().then(value=>{state=value;apply();}).catch(console.error);
    window.codexLiquidGlass.onChange(value=>{state=value;apply();});
  }
  if(openSettings){
    let attempts=0;
    const timer=setInterval(()=>{
      if(document.getElementById('lg-settings') || ++attempts>480){clearInterval(timer);return;}
      const appearance=[...document.querySelectorAll('button')].find(e=>['外观','Appearance'].includes(e.innerText.trim()));
      if(appearance){appearance.click();return;}
      const settings=[...document.querySelectorAll('[role="menuitem"]')].find(e=>/^(设置|Settings)(\s|$)/.test(e.innerText));
      if(settings){settings.click();return;}
      const profile=document.querySelector('button[aria-label="打开个人资料菜单"],button[aria-label="Open profile menu"]');
      if(profile && profile.getAttribute('aria-expanded')==='false')profile.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse',isPrimary:true}));
    },250);
  }
}

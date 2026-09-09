function fitAll(){
  document.querySelectorAll('.frame').forEach(f=>{
    const st=f.querySelector('.stage'); if(!st) return;
    st.style.transform='scale('+(f.clientWidth/1280)+')';
  });
}

function render(){
  const app=document.getElementById('app');
  app.innerHTML = S.view==='editor' ? viewEditor() : (S.wizard ? viewWizard() : viewHome());
  document.getElementById('layer').innerHTML =
    (S.modal==='settings'?viewSettings():'') +
    (S.modal==='ownai'?viewOwnAI():'') +
    (S.modal==='chartAi'?viewChartAI():'') +
    (S.busy?`<div class="toast"><span class="dot"></span>${esc(S.busy)}…</div>`:'') +
    (S.err?`<div class="toast bad"><span>${esc(S.err)}</span><button data-act="clearErr" style="background:none;border:none;color:var(--mute);cursor:pointer;font-size:16px">×</button></div>`:'');
  fitAll();
  if(S.modal==='chartAi')refreshChartSelectionSummary();
  requestAnimationFrame(()=>{
    const rail=document.getElementById('rail'), active=rail&&rail.querySelector('.rail-item.is-active');
    if(!rail||!active) return;
    if(window.matchMedia('(max-width:900px)').matches){
      rail.scrollLeft=Math.max(0,active.offsetLeft-(rail.clientWidth-active.offsetWidth)/2);
    }else{
      rail.scrollTop=Math.max(0,active.offsetTop-(rail.clientHeight-active.offsetHeight)/2);
    }
  });
}

function readHome(){
  const g=x=>{const el=document.getElementById(x);return el?el.value:null;};
  if(g('fBrief')!==null) S.brief=g('fBrief');
  if(g('fTopic')!==null) S.topic=g('fTopic');
  if(g('fAud')!==null) S.audience=g('fAud');
  if(g('fTone')!==null) S.tone=g('fTone');
  const p=g('fPages'); if(p!==null) S.pages=+p;
}

function syncStep(){
  const m=document.getElementById('wMat'); if(m) S.brief=m.value;
  const d2=document.getElementById('wMD'); if(d2) S.md=d2.value;
  if(document.getElementById('rRole')) saveRulesForm();
}

function readManual(){
  const g=x=>{const el=document.getElementById(x);return el?el.value:null;};
  if(g('msName')!==null) S.msName=g('msName');
  if(g('msBg')!==null) S.msBg=g('msBg');
  if(g('msInk')!==null) S.msInk=g('msInk');
  if(g('msAccent')!==null) S.msAccent=g('msAccent');
  if(g('msRadius')!==null) S.msRadius=clampNumber(g('msRadius'),0,16,0);
  const c=document.getElementById('msSerif'); if(c) S.msSerif=c.checked;
}

function readCfgFields(){
  const g=x=>{const el=document.getElementById(x);return el?el.value:null;};
  if(g('cKey')!==null) S.cfg.key=g('cKey').trim();
  if(g('cBase')!==null) S.cfg.base=g('cBase').trim();
  if(g('cModel')!==null) S.cfg.model=g('cModel').trim();
  if(g('cMax')!==null) S.cfg.maxTokens=clampNumber(g('cMax'),500,16000,S.cfg.maxTokens);
  if(g('cGap')!==null) S.cfg.gapMs=clampNumber(g('cGap'),0,30000,S.cfg.gapMs);
}

function readEditorFields(){
  const n=document.getElementById('fNote'), ins=document.getElementById('fIns');
  if(n && S.slides[S.cursor]) S.slides[S.cursor].note=n.value;
  if(ins) S.instruction=ins.value;
}

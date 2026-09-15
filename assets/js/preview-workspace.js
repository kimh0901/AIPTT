/* Read-only slide preview. No changes to AI, chart data or export modules. */
let previewSession=null;
present=function(fromWizard=false){
  const source=fromWizard?wizardPreviewDeck():S.slides;
  if(!source.length)return;
  const copies=JSON.parse(JSON.stringify(source));
  const assignments={...DESIGN_ASSIGN};
  let deck;
  try{deck=S.pptTemplate?prepareTemplateSlides(copies):(typeof prepareAdvancedSlides==='function'?prepareAdvancedSlides(copies):copies);}
  finally{DESIGN_ASSIGN=assignments;}
  previewSession={deck,source,wizard:fromWizard,focus:document.activeElement};
  const root=document.getElementById('present');
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','投影片預覽');
  root.innerHTML=`<header class="slide-preview-toolbar"><b>簡報預覽</b><span id="previewSlideTitle"></span><button class="btn" data-preview="fullscreen">全螢幕</button><button class="btn pri" data-preview="close">${fromWizard?'返回風格設定':'逐頁微調'}</button></header>
    <div class="slide-preview-viewport"><div id="presentWrap"></div></div>
    <footer class="slide-preview-footer"><div class="slide-preview-navigation"><button class="btn" data-preview="prev" aria-label="上一頁">← 上一頁</button><select id="previewPageSelect" aria-label="跳至投影片">${deck.map((s,i)=>`<option value="${i}">${i+1} / ${deck.length}　${esc(s.title||'未命名')}${s.exportContinuation?'（續頁）':''}</option>`).join('')}</select><button class="btn" data-preview="next" aria-label="下一頁">下一頁 →</button></div><div id="presentHud" role="status" aria-live="polite"></div><small>依目前套版與續頁結果預覽。字型、原生母片元素與動畫仍以 PowerPoint 匯出檔為準。</small></footer>`;
  document.getElementById('app').inert=true;
  root.classList.add('on');
  const selected=source[fromWizard?(S.wizardPreviewIndex||0):S.cursor];
  const start=deck.findIndex(s=>s.id===selected?.id||s.exportOrigin===selected?.id);
  pShow(Math.max(0,start));
  root.querySelector('[data-preview="close"]').focus();
};
pShow=function(n){
  if(!previewSession)return;
  const {deck}=previewSession;
  pIdx=Math.max(0,Math.min(deck.length-1,n));
  const assignments={...DESIGN_ASSIGN};
  try{
    document.getElementById('presentWrap').innerHTML=`<div class="ps" style="width:1280px;height:720px;position:relative">${renderSlide(deck[pIdx],previewStyle(),pIdx,deck.length,false)}</div>`;
  }finally{DESIGN_ASSIGN=assignments;}
  document.getElementById('previewPageSelect').value=String(pIdx);
  document.getElementById('previewSlideTitle').textContent=deck[pIdx].title||'未命名';
  document.getElementById('presentHud').textContent=`第 ${pIdx+1}／${deck.length} 頁${deck[pIdx].exportContinuation?'（自動續頁）':''}　方向鍵翻頁 · Esc 返回`;
  document.querySelector('[data-preview="prev"]').disabled=pIdx===0;
  document.querySelector('[data-preview="next"]').disabled=pIdx===deck.length-1;
  pFit();
};
pFit=function(){
  const viewport=document.querySelector('.slide-preview-viewport'),wrap=document.getElementById('presentWrap');
  if(!viewport||!wrap)return;
  const scale=Math.max(.05,Math.min((viewport.clientWidth-24)/1280,(viewport.clientHeight-24)/720));
  wrap.style.transform=`scale(${scale})`;
};
pClose=function(){
  if(!previewSession)return;
  const session=previewSession,slide=session.deck[pIdx];
  const originalIndex=session.source.findIndex(s=>s.id===(slide.exportOrigin||slide.id)||s.id===slide.id);
  if(session.wizard)S.wizardPreviewIndex=Math.max(0,originalIndex);else S.cursor=Math.max(0,originalIndex);
  const root=document.getElementById('present');
  if(document.fullscreenElement===root)document.exitFullscreen().catch(()=>{});
  root.classList.remove('on');document.getElementById('app').inert=false;
  previewSession=null;render();
  const button=session.wizard?document.querySelector('[data-preview="wizard"]'):document.querySelector('[data-act="present"]');
  (button||session.focus)?.focus();
};
document.addEventListener('click',e=>{
  const action=e.target.closest('[data-preview]')?.dataset.preview;if(!action)return;
  if(action==='wizard')present(true);
  else if(action==='close')pClose();
  else if(action==='prev')pShow(pIdx-1);
  else if(action==='next')pShow(pIdx+1);
  else if(action==='fullscreen'){
    const root=document.getElementById('present');
    if(document.fullscreenElement===root)document.exitFullscreen().catch(()=>{});
    else if(root.requestFullscreen)root.requestFullscreen().catch(()=>toast('此瀏覽器不支援全螢幕，仍可使用視窗內預覽'));
  }
});
document.addEventListener('change',e=>{if(e.target.id==='previewPageSelect')pShow(Number(e.target.value));});
addEventListener('fullscreenchange',()=>requestAnimationFrame(pFit));
addEventListener('keydown',e=>{
  if(!previewSession)return;
  if(e.key==='Tab'){
    const buttons=[...document.getElementById('present').querySelectorAll('button:not(:disabled),select')];
    const first=buttons[0],last=buttons[buttons.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    return;
  }
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();pClose();return;}
  if(['SELECT','INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName)&&e.key===' '){e.stopImmediatePropagation();return;}
  if(e.target.tagName==='SELECT'){e.stopImmediatePropagation();return;}
  const moves={ArrowRight:1,PageDown:1,' ':1,ArrowLeft:-1,PageUp:-1};
  if(e.key in moves){e.preventDefault();e.stopImmediatePropagation();pShow(pIdx+moves[e.key]);}
  if(e.key==='Home'||e.key==='End'){e.preventDefault();e.stopImmediatePropagation();pShow(e.key==='Home'?0:previewSession.deck.length-1);}
},true);

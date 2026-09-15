/* Presentation flow only. No chart/data/template geometry mutations. */
const WorkflowUI=(()=>{
  function help(title,text){return `<button type="button" class="workflow-tip-trigger" aria-label="${esc('說明：'+title)}" data-tip-title="${esc(title)}" data-tip-text="${esc(text)}">i</button>`;}
  let tip=null,tipOwner=null,tipTimer=null;
  function hideTip(){clearTimeout(tipTimer);if(tipOwner)tipOwner.removeAttribute('aria-describedby');if(tip)tip.remove();tip=null;tipOwner=null;}
  function showTip(button){
    clearTimeout(tipTimer);if(tipOwner===button)return;hideTip();tipOwner=button;
    tip=document.createElement('div');tip.className='workflow-floating-tip';tip.id='workflow-active-tip';tip.setAttribute('role','tooltip');
    const heading=document.createElement('strong'),body=document.createElement('p');heading.textContent=button.dataset.tipTitle;body.textContent=button.dataset.tipText;tip.append(heading,body);document.body.appendChild(tip);button.setAttribute('aria-describedby',tip.id);
    const r=button.getBoundingClientRect(),bounds=tip.getBoundingClientRect();
    tip.style.left=Math.max(8,Math.min(r.left,window.innerWidth-bounds.width-8))+'px';
    tip.style.top=Math.max(8,r.bottom+bounds.height+8<=window.innerHeight?r.bottom+6:r.top-bounds.height-6)+'px';
    tip.addEventListener('pointerenter',()=>clearTimeout(tipTimer));tip.addEventListener('pointerleave',()=>{tipTimer=setTimeout(hideTip,180);});
  }
  document.addEventListener('pointerover',e=>{const b=e.target.closest?.('.workflow-tip-trigger');if(b)showTip(b);});
  document.addEventListener('pointerout',e=>{const b=e.target.closest?.('.workflow-tip-trigger');if(b&&!b.contains(e.relatedTarget))tipTimer=setTimeout(hideTip,180);});
  document.addEventListener('focusin',e=>{const b=e.target.closest?.('.workflow-tip-trigger');if(b)showTip(b);});
  document.addEventListener('focusout',e=>{if(e.target===tipOwner)hideTip();});
  document.addEventListener('click',e=>{const b=e.target.closest?.('.workflow-tip-trigger');if(b)showTip(b);else if(!tip?.contains(e.target))hideTip();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tip){hideTip();e.stopImmediatePropagation();}},true);
  document.addEventListener('scroll',e=>{if(tip&&!tip.contains(e.target))hideTip();},true);
  if(typeof window!=='undefined')window.addEventListener('resize',hideTip);
  function withBookends(slides){
    const saved=S.optionalBookends;if(!saved||saved.basis!==S.md)return slides;
    const deck=slides.slice();
    if(saved.cover&&!deck.some(s=>s.layout==='cover'))deck.unshift(saved.cover);
    if(saved.closing&&!deck.some(s=>s.layout==='closing'||/^(THANK\s*YOU|謝謝|感謝)/i.test(s.title||'')))deck.push(saved.closing);
    return deck;
  }
  function bookendPanel(){
    const deck=wizardPreviewDeck(),saved=S.optionalBookends&&S.optionalBookends.basis===S.md?S.optionalBookends:{};
    return `<section class="workflow-section"><div class="workflow-heading"><h2>2. 封面與感謝頁（選用）</h2>${help('封面與感謝頁','自行補入，不需重新生成大綱或呼叫 AI。已有相同頁型就不重複新增；新增頁計入總頁數，並沿用目前母片配版。進入逐頁微調後可改標題與文字。')}</div><div class="workflow-bookends">`+
      ['cover','closing'].map(kind=>{const exists=deck.some(s=>s.layout===kind||(kind==='closing'&&/^(THANK\s*YOU|謝謝|感謝)/i.test(s.title||'')));const removable=saved[kind]&&deck.some(s=>s.id===saved[kind].id);return `<div><button class="btn" data-bookend-add="${kind}" ${exists?'disabled':''}>${exists?'已包含':'新增'}${kind==='cover'?'封面':'感謝頁'}</button>${removable?`<button class="btn sm" data-bookend-remove="${kind}">撤回本次新增</button>`:''}</div>`;}).join('')+`</div>${deck.filter(s=>s.userBookend).map(s=>`<fieldset><legend>${s.layout==='cover'?'封面':'感謝頁'}文字</legend><label>標題<input data-bookend-id="${esc(s.id)}" data-bookend-field="title" value="${esc(s.title||'')}" maxlength="200"></label><label>副標題<input data-bookend-id="${esc(s.id)}" data-bookend-field="subtitle" value="${esc(s.subtitle||'')}" maxlength="400"></label><small>離開欄位後更新預覽；文字仍需核對是否適合母片空間。</small></fieldset>`).join('')}<p class="hint">目前共 ${deck.length} 頁；新增頁不會取代原大綱。</p></section>`;
  }
  function changeBookend(kind,remove=false){
    if(!S.wizard||S.step!==5||!['cover','closing'].includes(kind))return;
    const deck=wizardPreviewDeck();
    if(!S.optionalBookends||S.optionalBookends.basis!==S.md)S.optionalBookends={basis:S.md};
    const saved=S.optionalBookends;
    if(remove){const at=deck.findIndex(s=>s.id===saved[kind]?.id);if(at>=0)deck.splice(at,1);delete saved[kind];S.wizardPreviewIndex=Math.min(S.wizardPreviewIndex||0,Math.max(0,deck.length-1));}
    else{
      if(deck.some(s=>s.layout===kind||(kind==='closing'&&/^(THANK\s*YOU|謝謝|感謝)/i.test(s.title||''))))return;
      const slide=normalize({layout:kind,title:kind==='cover'?(S.topic||deck[0]?.title||'簡報主題'):'THANK YOU',subtitle:kind==='cover'?(currentScenario()?.coverSubtitle||''):'',bullets:[],note:'由使用者於風格與母片階段新增。'});
      slide.status='generated';slide.userBookend=true;saved[kind]=slide;
      if(kind==='cover'){deck.unshift(slide);S.wizardPreviewIndex=0;}else{deck.push(slide);S.wizardPreviewIndex=deck.length-1;}
    }
    saveDraft();render();
  }
  document.addEventListener('click',e=>{const add=e.target.closest('[data-bookend-add]'),remove=e.target.closest('[data-bookend-remove]');if(add||remove)changeBookend((add||remove).dataset[add?'bookendAdd':'bookendRemove'],!!remove);});
  document.addEventListener('change',e=>{
    const field=e.target.dataset?.bookendField;if(!['title','subtitle'].includes(field)||!S.wizard||S.step!==5)return;
    const slide=wizardPreviewDeck().find(s=>s.id===e.target.dataset.bookendId&&s.userBookend);if(!slide)return;
    slide[field]=e.target.value;
    const saved=S.optionalBookends;if(saved?.basis===S.md)for(const kind of ['cover','closing'])if(saved[kind]?.id===slide.id)saved[kind][field]=slide[field];
    saveDraft();render();
  });
  function returnToStyle(){
    if(S.wizard||!S.slides?.length)return;
    S.styleReturnSession={basis:S.md,slides:JSON.parse(JSON.stringify(S.slides)),cursor:S.cursor||0};
    S.wizardPreviewIndex=S.cursor||0;S.wizard=true;S.step=5;S.view='wizard';saveDraft();render();
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-return-style]'))returnToStyle();});
  document.addEventListener('click',e=>{if(e.target.closest('[data-open-mascot]')){S.tab='mascot';render();}});
  function disclosure(key,title,body){
    const open=!!S.workflowPanels?.[key];
    return `<details class="workflow-disclosure" data-workflow-panel="${esc(key)}" ${open?'open':''}><summary>${esc(title)}</summary><div class="workflow-disclosure-body">${body}</div></details>`;
  }
  document.addEventListener('toggle',e=>{
    const key=e.target?.dataset?.workflowPanel;if(!key)return;
    S.workflowPanels=S.workflowPanels||{};S.workflowPanels[key]=e.target.open;
  },true);
  function styleSetup(){
    const t=S.pptTemplate;
    const status=t?`<p><b>目前母片：${esc(t.name)}</b></p><p class="hint">${esc(templateModeInfo(t).label)}。逐頁效果請看右側預覽。</p>${t.canMergeMasters===false||t.placeholderFit===false?'<p role="status" class="hint">此母片有相容性限制，請展開「母片詳細設定與相容性提醒」核對，再查看逐頁結果。</p>':''}`:`<p>目前使用網站風格：<b>${esc(curStyle().name||'目前風格')}</b></p><p class="hint">沒有單位母片也可繼續。上傳 PPTX 為選用。</p>`;
    return `<section class="workflow-section"><div class="workflow-heading"><h2>1. 選擇整份外觀</h2>${help('風格與母片','PPTX 母片為選用。變更外觀不重新生成大綱；特殊母片的相容限制仍會直接提醒。')}</div><p role="status"><b>${t?'外觀來源：上傳的 PPTX 母片優先':'外觀來源：網站風格'}</b></p>${t?'<p class="hint">網站配色不會完整取代母片背景、Logo 與原有版面；實際結果請核對預覽。</p>':''}${S.styleReturnSession?'<p role="status">已保留逐頁微調內容。更換母片不重新生成大綱；按「完成簡報」套用並返回。</p>':''}${status}<button class="btn full" data-act="upTemplate">${t?'更換 PPTX 母片':'上傳 PPTX 母片（選用）'}</button>`+
      (t?disclosure('wizard-template','母片詳細設定與相容性提醒',templateBox()):'')+
      disclosure('wizard-style',t?'網站配色與 AI 風格（母片優先）':'更換網站配色與 AI 風格',styleBox())+'</section>'+
      bookendPanel()+
      `<div class="workflow-heading"><span>確認外觀後，按「完成簡報」。</span>${help('下一步','進入逐頁微調後可預覽整份簡報；吉祥物圖片、AI 建議與配置統一由「進階工具」開啟，最後匯出 PPTX。')}</div>`;
  }
  return {disclosure,styleSetup,help,withBookends,changeBookend,returnToStyle};
})();

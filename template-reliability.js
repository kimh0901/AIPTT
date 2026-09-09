/* Template reliability layer.
   This file intentionally wraps the existing parser and layout engine instead of
   replacing them. If analysis fails, the original template flow remains usable. */
(function(){
'use strict';

const REL_ROLES=['TITLE','SUBTITLE','BODY','IMAGE','CHART','KPI','CAPTION','FOOTER','LOGO','DECORATION','IGNORE'];
const REL_LABEL={TITLE:'標題',SUBTITLE:'副標題',BODY:'內文',IMAGE:'圖片',CHART:'圖表',KPI:'KPI',CAPTION:'圖說',FOOTER:'頁尾',LOGO:'Logo',DECORATION:'裝飾',IGNORE:'忽略'};
const REL_COLOR={TITLE:'#FF3D7F',SUBTITLE:'#FF9BBE',BODY:'#35D8C8',IMAGE:'#62A9FF',CHART:'#B38AFF',KPI:'#FFB84D',CAPTION:'#90A4AE',FOOTER:'#78909C',LOGO:'#F06292',DECORATION:'#66737F',IGNORE:'#424B52'};

function relEsc(v){return typeof esc==='function'?esc(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function relClamp(v,a,b){return Math.max(a,Math.min(b,Number(v)||0));}
function relRect(r){return r&&Number(r.w)>0&&Number(r.h)>0?{x:Number(r.x)||0,y:Number(r.y)||0,w:Number(r.w)||0,h:Number(r.h)||0}:null;}
function relArea(r){return r?r.w*r.h:0;}

async function relHash(buffer){
  try{
    if(crypto&&crypto.subtle){
      const d=await crypto.subtle.digest('SHA-256',buffer.slice(0));
      return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');
    }
  }catch(e){}
  const a=new Uint8Array(buffer), step=Math.max(1,Math.floor(a.length/50000));let h=2166136261;
  for(let i=0;i<a.length;i+=step){h^=a[i];h=Math.imul(h,16777619);}
  return 'local-'+(h>>>0).toString(16)+'-'+a.length;
}

function relPlaceholderRole(type,name){
  const t=String(type||'').toLowerCase(), n=String(name||'').toLowerCase();
  if(t==='title'||t==='ctrtitle')return ['TITLE',.99];
  if(t==='subtitle')return ['SUBTITLE',.99];
  if(t==='pic'||t==='media')return ['IMAGE',.98];
  if(t==='chart')return ['CHART',.99];
  if(t==='ftr'||/footer|頁尾/.test(n))return ['FOOTER',.98];
  if(t==='sldnum'||t==='dt')return ['FOOTER',.96];
  if(t==='body'||t==='obj'||t==='tbl'||t==='dgm')return ['BODY',.93];
  return ['BODY',.62];
}

function relTextRole(shape,W,H,isLargest){
  const r=shape.rect, size=Number(shape.fontSize)||0, len=Number(shape.textLength)||0;
  if(r.y+r.h>H*.93&&r.h<H*.14)return ['FOOTER',.90];
  if(size>=38&&len>0&&len<=18)return ['KPI',.88];
  if(isLargest&&r.y<H*.52&&r.w>W*.28)return ['TITLE',size?relClamp(.72+size/180,.72,.95):.74];
  if(r.h<H*.10&&r.w<W*.40)return ['CAPTION',.66];
  if(r.w>W*.20&&r.h>H*.08)return ['BODY',.76];
  return ['DECORATION',.55];
}

function relLayoutFromMaster(layout,index){
  const shapes=(layout.placeholders||[]).map((p,i)=>{
    const rr=relPlaceholderRole(p.type,p.name), rect=relRect(p.rect);
    return {id:'ph-'+i,shapeType:'placeholder',placeholderType:p.type||'body',name:p.name||('Shape '+(i+1)),rect,
      role:rr[0],autoRole:rr[0],confidence:rr[1],confirmed:false};
  }).filter(x=>x.rect);
  for(let i=0;i<(Number(layout.decoCount)||0);i++)shapes.push({id:'deco-'+i,shapeType:'decoration',name:'裝飾 '+(i+1),rect:null,role:'DECORATION',autoRole:'DECORATION',confidence:.82,confirmed:false});
  return {id:'layout:'+layout.path,name:layout.name||('Layout '+(index+1)),source:'layout',sourcePath:layout.path,layoutRole:layout.role,shapes};
}

function relLayoutFromDesign(design,index,W,H){
  const texts=(design.texts||[]).filter(x=>relRect(x.rect));
  const largest=texts.slice().sort((a,b)=>(Number(b.size)||0)-(Number(a.size)||0)||relArea(b.rect)-relArea(a.rect))[0];
  const shapes=[];
  texts.forEach((t,i)=>{
    const rr=relTextRole({rect:t.rect,fontSize:t.size,textLength:t.len},W,H,t===largest);
    shapes.push({id:'text-'+i,shapeType:'textbox',name:'文字區 '+(i+1),rect:relRect(t.rect),fontSize:Number(t.size)||null,
      textLength:Number(t.len)||0,role:rr[0],autoRole:rr[0],confidence:rr[1],confirmed:false});
  });
  (design.preview||[]).forEach((p,i)=>{
    const role=p.src?(p.w<W*.24&&p.h<H*.18?'LOGO':'IMAGE'):'DECORATION';
    shapes.push({id:'visual-'+i,shapeType:p.src?'image':(p.lineObject?'line':'shape'),name:(p.src?'圖片 ':'裝飾 ')+(i+1),rect:relRect(p),rotation:Number(p.rot)||0,
      role,autoRole:role,confidence:p.src?.84:.80,confirmed:false});
  });
  return {id:'design:'+design.index,name:'範例投影片 '+design.index,source:'design',designIndex:design.index,layoutRole:'sample',shapes};
}

function relMetrics(t,layouts){
  const shapes=layouts.flatMap(x=>x.shapes||[]), groups=(t.designSlides||[]).reduce((n,d)=>n+(d.preview||[]).filter(x=>x.group).length,0);
  const unknown=shapes.filter(x=>x.confidence<.7).length, free=shapes.filter(x=>x.shapeType==='textbox'||x.shapeType==='shape').length;
  const lowRatio=shapes.length?unknown/shapes.length:0,freeRatio=shapes.length?free/shapes.length:0,perLayout=shapes.length/Math.max(1,layouts.length);
  /* 看「每頁密度與自由物件比例」，不是單純把整份模板 Shape 數相加。
     否則頁數較多但每頁很單純的企業公版也會一律被判為複雜。 */
  let score=Math.round(Math.min(100,Math.min(35,perLayout*2.4)+freeRatio*22+lowRatio*20+
    Math.min(10,groups*2)+((t.designSlides||[]).some(d=>Number(d.complexity)>45)?18:0)+(!t.placeholderFit?12:0)+(!t.canMergeMasters?8:0)));
  const level=score>=65?'複雜':score>=32?'中等':'簡單';
  return {score,level,shapeCount:shapes.length,freeShapeCount:free,groupCount:groups,lowConfidence:unknown};
}

function relSavedKey(hash){return 'templateSchema:'+hash;}
function relLoadSaved(hash){try{return LS.get(relSavedKey(hash),null);}catch(e){return null;}}
function relSave(){
  const a=S.pptTemplate&&S.pptTemplate.reliability;if(!a)return false;
  const clean={version:1,hash:a.hash,templateName:S.pptTemplate.name,updatedAt:new Date().toISOString(),layouts:a.layouts.map(l=>({
    id:l.id,name:l.name,source:l.source,sourcePath:l.sourcePath||'',designIndex:l.designIndex||0,layoutRole:l.layoutRole,
    /* 只保存人工變更。複雜市售模板可能有上萬個裝飾 Shape；把全部自動結果
       寫進 localStorage 會超過瀏覽器容量，反而造成模板無法保存。 */
    confirmed:!!l.confirmed,shapes:(l.shapes||[]).filter(s=>s.confirmed||s.role!==s.autoRole)
      .map(s=>({id:s.id,role:s.role,confirmed:!!s.confirmed}))}))};
  try{LS.set(relSavedKey(a.hash),clean);a.saved=true;return true;}catch(e){return false;}
}

function relApplySaved(a,saved){
  if(!saved||saved.hash!==a.hash||!Array.isArray(saved.layouts))return;
  const lm=new Map(saved.layouts.map(x=>[x.id,x]));
  a.layouts.forEach(l=>{const old=lm.get(l.id);if(!old)return;l.confirmed=!!old.confirmed;const sm=new Map((old.shapes||[]).map(x=>[x.id,x]));
    (l.shapes||[]).forEach(s=>{const x=sm.get(s.id);if(x&&REL_ROLES.includes(x.role)){s.role=x.role;s.confirmed=!!x.confirmed;s.confidence=s.confirmed?1:s.confidence;}});});
  a.saved=true;
}

function relAttach(t,a){
  (t.layouts||[]).forEach(l=>{l.reliability=(a.layouts||[]).find(x=>x.sourcePath===l.path)||null;});
  (t.designSlides||[]).forEach(d=>{d.reliability=(a.layouts||[]).find(x=>x.designIndex===d.index)||null;});
}

async function analyzeTemplateReliability(t){
  const hash=await relHash(t.buffer), layouts=(t.layouts||[]).map(relLayoutFromMaster)
    .concat((t.designSlides||[]).map((d,i)=>relLayoutFromDesign(d,i,t.width,t.height)));
  const a={version:1,hash,layouts,metrics:relMetrics(t,layouts),saved:false};
  relApplySaved(a,relLoadSaved(hash));relAttach(t,a);t.reliability=a;return a;
}

function relCounts(a){
  const total=(a&&a.layouts||[]).length, confirmed=(a&&a.layouts||[]).filter(x=>x.confirmed).length;
  const needs=(a&&a.layouts||[]).filter(x=>!x.confirmed&&(x.shapes||[]).some(s=>s.confidence<.75)).length;
  return {total,confirmed,pending:Math.max(0,total-confirmed),needs};
}

function relStatusText(a){
  if(!a)return '尚未分析';const c=relCounts(a);
  if(c.total&&c.confirmed===c.total)return '✓ 已校正模板';
  if(c.confirmed)return `⚠ 部分版型需確認（${c.confirmed}/${c.total}）`;
  return '⚠ 尚未校正版型';
}

function relRoleOptions(shape){return REL_ROLES.map(r=>`<option value="${r}" ${shape.role===r?'selected':''}>${REL_LABEL[r]}</option>`).join('');}
function relOverlay(layout,t){
  const W=t.width||13.333,H=t.height||7.5;
  return (layout.shapes||[]).filter(s=>s.rect).map(s=>{
    const r=s.rect,c=REL_COLOR[s.role]||'#fff';
    return `<span title="${relEsc(REL_LABEL[s.role])} ${Math.round(s.confidence*100)}%" style="position:absolute;left:${r.x/W*100}%;top:${r.y/H*100}%;width:${r.w/W*100}%;height:${r.h/H*100}%;border:2px solid ${c};background:${c}18;box-sizing:border-box;overflow:hidden;color:${c};font-size:10px;font-weight:700;padding:2px">${relEsc(REL_LABEL[s.role])}</span>`;
  }).join('');
}

function relAnalysisModal(){
  const t=S.pptTemplate,a=t&&t.reliability;if(!t||!a)return '';
  const selected=(a.layouts||[]).find(x=>x.id===S.tplReliabilityLayoutId)||a.layouts[0],c=relCounts(a),m=a.metrics;
  if(selected&&!S.tplReliabilityLayoutId)S.tplReliabilityLayoutId=selected.id;
  const layouts=(a.layouts||[]).map(l=>{
    const low=(l.shapes||[]).filter(s=>s.confidence<.75).length;
    return `<button data-act="tplRelSelect" data-layout="${relEsc(l.id)}" style="text-align:left;padding:10px;border:1px solid ${selected===l?'var(--cy)':'var(--line)'};border-radius:7px;background:${selected===l?'#0C2224':'var(--panel)'};color:var(--paper);cursor:pointer">
      <b>${relEsc(l.name)}</b><br><span class="hint">${l.source==='layout'?'母片版面':'範例頁'} · ${l.confirmed?'已確認':low?'建議確認':'待確認'}${low?' · '+low+' 個低信心區':''}</span></button>`;
  }).join('');
  /* 校正介面先列內容候選，再列裝飾；超大型素材模板避免一次建立數千個 select。 */
  const selectedShapes=selected?(selected.shapes||[]).slice().sort((a,b)=>(a.role==='DECORATION')-(b.role==='DECORATION')||a.confidence-b.confidence):[];
  const visibleShapes=selectedShapes.slice(0,300);
  const rows=selected?visibleShapes.map(s=>`<tr><td>${relEsc(s.name)}</td><td>${s.rect?`${s.rect.x.toFixed(2)}, ${s.rect.y.toFixed(2)}<br>${s.rect.w.toFixed(2)} × ${s.rect.h.toFixed(2)}`:'由母片繼承'}</td>
    <td><select data-template-role="1" data-layout="${relEsc(selected.id)}" data-shape="${relEsc(s.id)}" style="min-height:34px;font-size:14px;padding:4px">${relRoleOptions(s)}</select></td>
    <td style="color:${s.confidence<.75?'var(--warn)':'var(--cy)'}">${Math.round(s.confidence*100)}%${s.confirmed?' ✓':''}</td></tr>`).join(''):'';
  return `<div class="modal" data-act="tplRelClose"><div class="box" data-stop="1" style="width:min(1050px,100%);max-height:92vh">
    <div style="display:flex;gap:12px;align-items:flex-start"><div style="flex:1"><div class="lbl">模板分析與校正</div><h2 style="margin:2px 0 6px;font-size:24px">${relEsc(t.name)}</h2>
      <div class="hint">模板複雜度：<b style="color:${m.level==='複雜'?'var(--warn)':'var(--cy)'}">${m.level}</b>（${m.score}/100） · 已分析 ${c.total} 種版面 · 已確認 ${c.confirmed} 種 · 待確認 ${c.pending} 種</div></div>
      <button data-act="tplRelClose" style="background:none;border:none;color:var(--mute);font-size:22px;cursor:pointer">×</button></div>
    <div style="margin-top:14px;border-left:3px solid ${m.level==='複雜'?'var(--warn)':'var(--cy)'};padding:9px 11px;color:var(--paper);font-size:14px;line-height:1.65">${m.level==='複雜'?'此模板自由文字框或裝飾較多，建議先確認常用版面；仍可直接生成，系統會保留現有安全重排。':'系統已先完成版位辨識。可直接生成，或先確認常用版面的角色。'}</div>
    <div style="display:grid;grid-template-columns:minmax(220px,280px) 1fr;gap:16px;margin-top:16px">
      <div style="display:grid;gap:7px;align-content:start;max-height:60vh;overflow:auto">${layouts}</div>
      <div style="min-width:0"><div style="position:relative;background:#fff;aspect-ratio:${t.width}/${t.height};border-radius:6px;overflow:hidden;border:1px solid var(--line)">${selected?relOverlay(selected,t):''}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0"><span class="hint">${selected?relEsc(selected.name):''}</span><span style="flex:1"></span>
          ${selected?`<button class="btn sm pri" data-act="tplRelConfirm" data-layout="${relEsc(selected.id)}">確認此版面</button><button class="btn sm" data-act="tplRelReset" data-layout="${relEsc(selected.id)}">恢復自動判斷</button>`:''}</div>
        <div style="max-height:28vh;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left">區塊</th><th style="text-align:left">位置與大小</th><th style="text-align:left">角色</th><th style="text-align:left">信心</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${selectedShapes.length>visibleShapes.length?`<div class="hint" style="margin-top:7px">此頁共有 ${selectedShapes.length} 個物件。為維持操作順暢，先顯示內容候選與前 ${visibleShapes.length} 個物件；其餘低風險裝飾仍納入碰撞檢查。</div>`:''}
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px"><button class="btn pri" data-act="tplRelSave">儲存模板設定</button><button class="btn" data-act="tplRelClose">完成</button><span class="hint" style="align-self:center">設定只存在這台電腦的瀏覽器，不會輸出 JSON。</span></div>
  </div></div>`;
}

function relGuidanceModal(){return `<div class="modal" data-act="tplRelClose"><div class="box" data-stop="1" style="width:min(760px,100%);max-height:90vh">
  <div style="display:flex;align-items:flex-start;gap:12px"><div style="flex:1"><div class="lbl">適用情境與使用提醒</div><h2 style="margin:2px 0 8px;font-size:24px">AI 協助完成簡報初稿，再由使用者確認內容與版面</h2></div><button data-act="tplRelClose" style="background:none;border:none;color:var(--mute);font-size:22px;cursor:pointer">×</button></div>
  <p class="hint" style="font-size:14.5px;line-height:1.75">本工具協助把文字、大綱與結構化資料轉成可編輯的 PowerPoint 初稿，也能套用企業公版與一般母片。</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px"><section style="border:1px solid var(--cy);border-radius:8px;padding:14px"><b style="color:var(--cy)">較適合使用</b><div class="hint" style="line-height:1.8;margin-top:7px">工作報告、專案簡報、教育訓練、研究成果、政策資訊、企業固定公版，以及文字、圖片、KPI 或圖表位置明確的版型。</div></section>
  <section style="border:1px solid var(--warn);border-radius:8px;padding:14px"><b style="color:var(--warn)">建議預留人工確認</b><div class="hint" style="line-height:1.8;margin-top:7px">海報式或雜誌式排版、複雜資訊圖、多層群組、自由形狀、特殊遮罩、動畫、Morph、Zoom、VBA 或特殊外掛。</div></section></div>
  <div style="margin-top:16px;border-left:3px solid var(--mark);padding:10px 12px;font-size:14px;line-height:1.7">複雜模板不會被阻擋。系統會先分析，必要時改用安全版面；匯出後仍建議逐頁確認字型、圖片裁切與特殊物件。</div>
  <button class="btn pri" data-act="tplRelClose" style="margin-top:18px">了解，繼續使用</button></div></div>`;}

function relPageQA(slide){
  if(!slide||!S.pptTemplate||typeof templatePlan!=='function')return null;
  let plan;try{plan=templatePlan(slide,S.cursor||0);}catch(e){return {score:55,status:'FAIL',issues:['版面檢查無法完成']};}
  const issues=[];let score=100;
  const known=typeof templatePlanIssues==='function'?templatePlanIssues(plan):[];
  known.forEach(x=>issues.push(x));score-=known.length*14;
  /* 頁碼、圖表座標與裝飾標籤可小於 16 pt；只檢查使用者可編輯的正文。 */
  const texts=(plan.ops||[]).filter(o=>o.kind==='text'&&o.args[1]&&o.args[1].edit).map(o=>({text:Array.isArray(o.args[0])?o.args[0].map(x=>x.text||'').join(''):String(o.args[0]||''),o:o.args[1]||{}}));
  texts.forEach(x=>{if(Number(x.o.fontSize)>0&&Number(x.o.fontSize)<16){issues.push('正文或標題字級小於 16 pt');score-=10;}if(x.o.edit==='title'&&x.text.length>42){issues.push('標題可能超過兩行');score-=8;}});
  for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
    const a=texts[i].o,b=texts[j].o;if([a.x,a.y,a.w,a.h,b.x,b.y,b.w,b.h].some(v=>!Number.isFinite(Number(v))))continue;
    const w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    if(w*h>.035){issues.push('文字區可能重疊');score-=16;}
  }
  score=relClamp(score,0,100);const status=score>=85?'PASS':score>=70?'WARNING':'FAIL';
  return {score,status,issues:Array.from(new Set(issues)).slice(0,4)};
}

function relDataStatus(){
  const n=typeof availableTables==='function'?availableTables().length:0, numeric=typeof availableTables==='function'&&typeof numericColumns==='function'?availableTables().filter(t=>numericColumns(t).length).length:0;
  const wait=(S.slides||[]).filter(s=>JSON.stringify(s).includes('資料待補')).length;
  return {tables:n,numeric,wait};
}

/* Extend parser while preserving its original fallback and error handling. */
const originalParsePptTemplate=parsePptTemplate;
parsePptTemplate=async function(file){
  const t=await originalParsePptTemplate(file);
  try{await analyzeTemplateReliability(t);}catch(e){t.reliabilityError=e&&e.message||String(e);}
  return t;
};

/* Manual semantic roles only override slots that have a usable rectangle. */
const originalTemplateRect=templateRect;
templateRect=function(layout,types,index,fallback){
  try{
    const wanted=types.some(x=>x==='title'||x==='ctrTitle')?['TITLE']:
      types.some(x=>x==='subTitle')?['SUBTITLE']:
      types.some(x=>x==='pic'||x==='media')?['IMAGE']:
      types.some(x=>x==='chart')?['CHART']:['BODY'];
    const slots=layout&&layout.reliability&&(layout.reliability.shapes||[]).filter(s=>wanted.includes(s.role)&&s.rect);
    if(slots&&slots[index||0])return Object.assign({},slots[index||0].rect);
  }catch(e){}
  return originalTemplateRect(layout,types,index,fallback);
};

const originalDesignBoxes=designBoxes;
designBoxes=function(design,W,H){
  try{
    const shapes=design&&design.reliability&&design.reliability.shapes||[],title=shapes.find(s=>s.role==='TITLE'&&s.rect),bodies=shapes.filter(s=>['BODY','IMAGE','CHART'].includes(s.role)&&s.rect);
    if(title&&bodies.length)return {title:title.rect,bodies:bodies.map(x=>x.rect)};
  }catch(e){}
  return originalDesignBoxes(design,W,H);
};

const originalTemplateBox=templateBox;
templateBox=function(){
  const html=originalTemplateBox(),t=S.pptTemplate,a=t&&t.reliability;
  if(!t)return html;
  const c=relCounts(a),m=a&&a.metrics,status=relStatusText(a);
  const panel=`<div style="margin-top:11px;border:1px solid ${m&&m.level==='複雜'?'var(--warn)':'var(--line)'};border-radius:8px;padding:11px;background:#101821">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>${relEsc(status)}</b><span class="hint">模板複雜度：${m?m.level:'尚未完成'}${m?' '+m.score+'/100':''}${a?' · '+c.confirmed+'/'+c.total+' 種版面已確認':''}</span><span style="flex:1"></span><button class="btn sm pri" data-act="tplRelOpen">模板分析與校正</button></div>
    ${m&&m.level==='複雜'?`<div style="color:var(--warn);font-size:13.5px;line-height:1.6;margin-top:7px">此模板結構較複雜，建議先確認常用版面；仍可直接生成，不會被阻擋。</div>`:''}</div>`;
  return html.replace(/<\/div>\s*$/,panel+'</div>');
};

const originalTemplateChoicePanel=templateChoicePanel;
templateChoicePanel=function(s){
  const html=originalTemplateChoicePanel(s),qa=relPageQA(s),ds=relDataStatus();
  if(!qa)return html;
  const color=qa.status==='PASS'?'#82E8CC':qa.status==='WARNING'?'#FFD993':'#FF8B8B';
  return html+`<div style="margin-top:8px;border-left:3px solid ${color};padding:7px 9px;font-size:13.5px;line-height:1.55"><b style="color:${color}">本頁 Layout Score：${qa.score} · ${qa.status}</b>${qa.issues.length?'<br>'+qa.issues.map(relEsc).join('；'):' · 基本溢出、越界與重疊檢查通過'}<br><span class="hint">資料表 ${ds.tables} 個（可繪圖 ${ds.numeric} 個）${ds.wait?' · 目前仍有 '+ds.wait+' 頁含「資料待補」':''}</span></div>`;
};

const originalChartPanel=chartPanel;
chartPanel=function(cur){
  const ds=relDataStatus(),ready=ds.numeric>0;
  const diag=S.lastChartAiError?`<details style="margin-top:6px"><summary style="cursor:pointer">查看上一次 AI 圖表診斷</summary><div class="hint" style="margin-top:5px;word-break:break-word">${relEsc(S.lastChartAiError)}</div></details>`:'';
  const note=`<div style="border-left:3px solid ${ready?'var(--cy)':'var(--warn)'};padding:8px 10px;margin-bottom:12px;font-size:13.5px;line-height:1.6"><b>${ready?'已找到可繪圖資料':'目前沒有可繪圖數值表'}</b><br>${ready?`已讀取 ${ds.numeric} 個含數值的資料表；會先嘗試相容格式，AI 失敗時才改用本機規則。`:'仍可依目前頁面文字建立內容結構圖；系統不會虛構數值。'}${diag}</div>`;
  return note+originalChartPanel(cur);
};

const originalViewHome=viewHome;
viewHome=function(){
  const card=`<section style="border:1px solid var(--line);border-radius:10px;padding:15px 18px;margin:0 0 18px;background:#101821"><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:260px"><b style="font-size:16px">適用情境與使用提醒</b><div class="hint" style="margin-top:4px;line-height:1.65">適合工作報告、教育訓練、研究與企業公版。複雜資訊圖或大量自由形狀的模板，建議先完成模板校正。</div></div><button class="btn sm" data-act="tplGuideOpen">查看詳細說明</button></div></section>`;
  return originalViewHome().replace('<details data-home-free',card+'<details data-home-free');
};

const originalWizardCheckpoint=wizardCheckpoint;
wizardCheckpoint=function(step){
  const r=originalWizardCheckpoint(step);
  if(step===5&&r&&r.ok&&S.pptTemplate&&S.pptTemplate.reliability){
    const a=S.pptTemplate.reliability,c=relCounts(a);
    if(a.metrics.level==='複雜'&&c.confirmed===0)return {ok:true,warn:true,msg:'模板結構較複雜；可繼續生成，建議先按「模板分析與校正」確認常用版面'};
  }
  return r;
};

const originalRender=render;
render=function(){
  originalRender();
  const layer=document.getElementById('layer');if(!layer)return;
  if(S.modal==='templateReliability')layer.insertAdjacentHTML('afterbegin',relAnalysisModal());
  if(S.modal==='templateGuidance')layer.insertAdjacentHTML('afterbegin',relGuidanceModal());
};

document.addEventListener('click',function(e){
  const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act;
  if(a==='tplRelOpen'){S.modal='templateReliability';render();}
  else if(a==='tplGuideOpen'){S.modal='templateGuidance';render();}
  else if(a==='tplRelClose'){S.modal=null;render();}
  else if(a==='tplRelSelect'){S.tplReliabilityLayoutId=t.dataset.layout;render();}
  else if(a==='tplRelConfirm'){
    const rel=S.pptTemplate&&S.pptTemplate.reliability,l=rel&&(rel.layouts||[]).find(x=>x.id===t.dataset.layout);if(!l)return;
    l.confirmed=true;relSave();saveDraft();render();
  }else if(a==='tplRelReset'){
    const rel=S.pptTemplate&&S.pptTemplate.reliability,l=rel&&(rel.layouts||[]).find(x=>x.id===t.dataset.layout);if(!l)return;
    l.confirmed=false;(l.shapes||[]).forEach(s=>{s.role=s.autoRole;s.confirmed=false;});relSave();saveDraft();render();
  }else if(a==='tplRelSave'){
    if(relSave()){toast('模板設定已儲存');setTimeout(()=>done(),1400);}else fail('模板設定無法儲存，請確認瀏覽器允許本機儲存。');render();
  }
});

document.addEventListener('change',function(e){
  const el=e.target;if(!el.matches||!el.matches('[data-template-role]'))return;
  const rel=S.pptTemplate&&S.pptTemplate.reliability,l=rel&&(rel.layouts||[]).find(x=>x.id===el.dataset.layout),shape=l&&(l.shapes||[]).find(x=>x.id===el.dataset.shape);
  if(!shape||!REL_ROLES.includes(el.value))return;shape.role=el.value;shape.confirmed=true;shape.confidence=1;l.confirmed=(l.shapes||[]).every(x=>x.confirmed||x.confidence>=.75);relAttach(S.pptTemplate,rel);relSave();saveDraft();render();
});

window.templateReliability={analyzeTemplateReliability,relPageQA,relDataStatus,relCounts,roles:REL_ROLES};
})();

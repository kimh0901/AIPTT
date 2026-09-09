function clipText(value,max){
  const text=String(value==null?'':value).replace(/\s+/g,' ').trim();
  if(text.length<=max) return text;
  let cut=max;
  const token=/((?:NT\$|US\$|\$)?\s*[+-]?\d[\d,]*(?:\.\d+)?\s*(?:%|％|GWh|MWh|kWh|GW|MW|kW|億元|萬元|億|萬|度|元|人次|人|戶|件|次|倍|個百分點|百分點)?)/gi;
  for(const match of text.matchAll(token)){
    const start=match.index, end=start+match[0].length;
    if(start<cut&&end>cut){ cut=start>0?start:Math.min(end,max+12); break; }
  }
  return text.slice(0,cut).trim();
}

function stripLegacyUploadBlocks(raw,uploads){
  let text=String(raw||'');
  (uploads||[]).forEach(u=>{
    const block=String(u&&u.block||((u&&u.blockHeader&&u.text)?u.blockHeader+'\n'+u.text:''));
    if(block&&text.includes(block)) text=text.replace(block,'');
  });
  return text.replace(/\n{3,}/g,'\n\n').trim();
}

function persistCfg(){
  const saved=Object.assign({},S.cfg);
  LS.set('rememberKey',!!S.rememberKey);
  try{
    if(S.rememberKey){ sessionStorage.removeItem(sessionKeyName(S.cfg.provider)); }
    else { sessionStorage.setItem(sessionKeyName(S.cfg.provider),S.cfg.key||''); sessionStorage.removeItem('sf:apiKey'); delete saved.key; }
  }catch(e){ if(!S.rememberKey) delete saved.key; }
  LS.set('cfg',saved);
}

function today(){
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}

function usage(){
  const u = LS.get('usage',{d:today(),n:0});
  if(u.d!==today()){ u.d=today(); u.n=0; LS.set('usage',u); }
  return u;
}

function bumpUsage(){ const u=usage(); u.n++; LS.set('usage',u); return u.n; }

function previewStyle(){
  const st=curStyle(), t=S.pptTemplate, c=t&&t.colors||{};
  if(!t) return st;
  return Object.assign({},st,{
    bg:c.lt1||st.bg,surface:c.lt2||c.lt1||st.surface,ink:c.dk1||st.ink,
    sub:c.dk2||st.sub,accent:c.accent1||st.accent,accent2:c.accent2||st.accent2,
    rule:c.accent3||st.rule
  });
}

function sourceYear(name){
  const text=String(name||''), maxYear=new Date().getFullYear()+1, years=[];
  const push=n=>{ if(Number.isFinite(n)&&n>=1990&&n<=maxYear) years.push(n); };
  /* 民國年 */
  (text.match(/(?:民國\s*)?(1\d{2})\s*年/g)||[]).forEach(token=>{
    const n=Number((token.match(/1\d{2}/)||[])[0]); if(n>=100&&n<=199) push(n+1911);
  });
  /* YYYYMMDD／YYYYMM 前綴，例如 20260806_國際節能家電補助方案研析.pptx。
     舊版的 (?!\d) 會讓這種公文常用命名完全讀不到年份。 */
  const stamp=text.match(/(?:^|[^\d])((?:19|20)\d{2})(?:0[1-9]|1[0-2])(?:[0-3]\d)?(?!\d)/);
  if(stamp) push(Number(stamp[1]));
  /* 一般年份。年份區間（2024年-2025年、2021-2026）兩端都要收：
     舊版把半形連字號當雜訊排除，會漏掉區間的後半段。 */
  const re=/(?:^|[^\d])((?:19|20)\d{2})(?!\d)/g; let m;
  while((m=re.exec(text))){
    const at=m.index+m[0].length-4, after=text[at+4]||'';
    if(/[戶件人萬元場次度]/.test(after)) continue;
    push(Number(m[1]));
  }
  return years.length?Math.max(...years):null;
}

function enabledUploads(){ return (S.uploads||[]).filter(u=>u.enabled!==false); }

function activeUploads(){
  const enabled=enabledUploads();
  /* 只有「最新資料優先」會依年份剔除來源；跨年度與跨國比較都必須保留全部 */
  if(S.sourceMode!=='latest') return enabled;
  const dated=enabled.map(u=>Number(u.year)||sourceYear(u.name)).filter(Boolean), newest=dated.length?Math.max(...dated):null;
  return newest?enabled.filter(u=>!(Number(u.year)||sourceYear(u.name))||(Number(u.year)||sourceYear(u.name))===newest):enabled;
}

function uploadBlock(u){ return String(u&&u.block||((u&&u.blockHeader&&u.text)?u.blockHeader+'\n'+u.text:u&&u.text||'')); }

function manualBrief(){ return String(S.brief||'').trim(); }

function sourceModeLabel(k){ return (SOURCE_MODES[k]||{}).label||String(k||''); }

function sourcePolicyText(){
  if(S.sourceMode==='crosscountry') return SOURCE_MODES.crosscountry.policy+'\n'+SOURCE_MODES.compare.policy;
  if(S.sourceMode==='compare') return SOURCE_MODES.compare.policy;
  if(S.sourceMode==='selected') return SOURCE_MODES.selected.policy;
  const years=activeUploads().map(u=>Number(u.year)||sourceYear(u.name)).filter(Boolean), newest=years.length?Math.max(...years):null;
  return `最新資料優先：${newest?`以 ${newest} 年資料為主；`:''}較舊資料只可作歷史背景，不得冒充現況。`;
}

function buildSourceMaterial(limit){
  limit=Math.max(2000,Number(limit)||12000);
  const manual=manualBrief(), files=activeUploads().filter(u=>String(u.text||'').trim()||(u.tableIds||[]).length), reserve=Math.min(manual.length,files.length?Math.min(3000,Math.floor(limit*.25)):limit);
  const available=Math.max(0,limit-reserve), headerCost=files.reduce((n,u)=>n+String(u.blockHeader||u.name||'').length+4,0);
  const each=files.length?Math.max(80,Math.floor(Math.max(0,available-headerCost)/files.length)):0, parts=[], ids=[];
  if(manual) parts.push(`【使用者直接輸入】\n${manual.slice(0,reserve||limit)}`);
  files.forEach(u=>{ const header=u.blockHeader||`【來源檔案：${u.name}】`, room=Math.max(0,limit-parts.join('\n\n').length-header.length-2);
    if(room<=0) return; parts.push(`${header}\n${String(u.text||'').slice(0,Math.min(each,room))}`); ids.push(u.id); });
  return {text:parts.join('\n\n').slice(0,limit),ids,reduced:files.length>0&&each<600};
}

function sourceMaterial(limit){ return buildSourceMaterial(limit).text; }

function activeTableIds(){
  const managed=new Set((S.uploads||[]).flatMap(u=>u.tableIds||[])), active=new Set(activeUploads().flatMap(u=>u.tableIds||[]));
  return {managed,active};
}

function availableTables(){
  const sets=activeTableIds();
  return (S.tables||[]).filter(t=>!sets.managed.has(t.id)||sets.active.has(t.id));
}

function slidePlainText(s){
  s=s||{};
  return [s.title,s.subtitle,s.kicker,s.note,
    ...(s.bullets||[]).flatMap(b=>[b.h,b.d]),...(s.columns||[]).flatMap(c=>[c.h,...(c.items||[])]),
    s.stat&&s.stat.value,s.stat&&s.stat.label,s.quote&&s.quote.text,s.quote&&s.quote.by].filter(Boolean).join(' ');
}

function sourceReference(u,context){
  const segments=(u.segments||[]).map(seg=>({seg,score:chartRelevance(context,seg.text)})).sort((a,b)=>b.score-a.score);
  const best=segments[0];
  return {score:chartRelevance(context,`${u.name} ${String(u.text||'')}`)+(best&&best.score||0),
    label:`${u.name}${best&&best.score>0?`｜投影片 ${best.seg.page}`:''}`};
}

function attachSourceNotes(slides){
  const uploads=activeUploads();
  const sc=currentScenario();
  (slides||[]).forEach(s=>{
    /* 封面只保留封面講稿，不硬掛資料來源或時效警語；否則標題含「節能策略」時，
       會被誤判成第三個分析主題群。 */
    if(s&&s.layout==='cover'){
      s.note=String(s.note||'').replace(/\n*\[Sources·auto\][\s\S]*$/,'').trim();
      return;
    }
    const context=slidePlainText(s), refs=uploads.map(u=>sourceReference(u,context)).sort((a,b)=>b.score-a.score);
    /* 只留下和最相關來源同一量級的檔案。多份主題相近的來源分數會很接近，
       全部列出等於沒有標註；分數不足就留白，由 slideSourceFooter 顯示「待補」，
       不要為了湊滿頁尾而硬塞不相關的來源。 */
    const hits=refs.filter(x=>x.score>0), best=hits.length?hits[0].score:0;
    const chosen=hits.filter(x=>x.score>=Math.max(1,best*0.45)).slice(0,3);
    const base=String(s.note||'').replace(/\n*\[Sources·auto\][\s\S]*$/,'').trim();
    let note=base;
    if(sc&&sc.requireTimelinessNotes&&!/(資料時點|時效|查證日期)/.test(note))
      note=[note,'資料時點：依上傳來源；需口頭補充：查證日期、匯率基準與未載欄位。'].filter(Boolean).join('\n');
    s.note=chosen.length?[note,'[Sources·auto]',...chosen.map(x=>'- '+x.label)].filter(Boolean).join('\n'):note;
  });
  return slides;
}

function markMissingDataPages(slides){
  const sc=currentScenario(); if(!sc||S.scenario==='own') return slides;
  const items=scenarioUploadStatus().missingItems||[]; if(!items.length) return slides;
  const tag='［資料待補］';
  (slides||[]).forEach((s,i)=>{
    if(!s||s.layout==='cover'||Number(s.sourceGroup)===0) return;
    const content=slidePlainText(s);
    const sourcePage=S.scenario==='monthly'
      ? (/策略|節能|推廣|措施|成效|執行建議/.test(content)?3:
        /冷氣|增幅|前\s*10|排名|關聯/.test(content)?2:
        /總覽|總量|六都|非六都|同期|占比/.test(content)?1:(Number(s.sourceGroup)||i+1))
      : (Number(s.sourceGroup)||i+1);
    const labels=items.filter(r=>(r.pages||[]).includes(sourcePage)).map(r=>r.label);
    if(!labels.length) return;
    const note=String(s.note||''); if(note.includes(tag)) return;
    s.note=[note,`${tag}本頁需要的來源尚未上傳：${labels.join('、')}。頁面中的相關數值、排名與結論請補齊來源後重新產生，勿直接引用。`]
      .filter(Boolean).join('\n');
  });
  return slides;
}

function slideSourceLabels(s){
  const lines=String(s&&s.note||'').split('\n'), at=lines.findIndex(x=>/^\[Sources(?:·auto)?\]/i.test(x.trim()));
  if(at<0) return [];
  return lines.slice(at+1).map(x=>x.replace(/^[-*•]\s*/, '').trim()).filter(Boolean).slice(0,3);
}

function slideSourceFooter(s){
  const sc=currentScenario(), refs=slideSourceLabels(s);
  if(refs.length) return refs.join('；');
  return sc&&sc.requireSourceFooter?'待補（請在本頁講稿補上來源）':'';
}

function aiReady(){ return S.cfg.provider==='ollama' ? true : !!S.cfg.key; }

function modelLabel(){
  const m=S.cfg.model||'';
  if(S.cfg.provider==='course'){
    const f=COURSE_MODELS.find(x=>x.key===m); return f?f.label:m;
  }
  return m;
}

function set(patch,skipRender){ Object.assign(S,patch); if(!skipRender) render(); }

function toast(msg){ S.busy=msg; S.err=null; render(); }

function fail(msg){ S.busy=null; S.err=msg; render(); }

function done(){ S.busy=null; S.err=null; render(); }

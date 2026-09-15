function currentScenario(){ return SCENARIOS[S.scenario]||null; }

function uploadTableSignature(u){
  const ids=new Set((u&&u.tableIds)||[]);
  return (S.tables||[]).filter(t=>ids.has(t.id)).map(t=>[t.title,...(t.headers||[])].join(' ')).join(' ').replace(/\s+/g,' ');
}

function uploadMatchesDetectedKind(u,kind){
  const sig=uploadTableSignature(u);
  if(kind==='sales') return /縣市/.test(sig)&&/住宅/.test(sig)&&/售電/.test(sig);
  if(kind==='cooling') return /縣市/.test(sig)&&/冷氣時/.test(sig)&&/(年|日期)/.test(sig);
  return false;
}

function uploadHaystack(u){
  const tables=(u.tableIds||[]).map(id=>(S.tables||[]).find(t=>t.id===id)).filter(Boolean);
  return [String(u.name||''),
    ...tables.map(t=>[t.title,...(t.headers||[])].join(' ')),
    String(u.text||'').slice(0,6000)].join(' ').toLowerCase();
}

function keywordHit(hay,groups){
  if(!groups||!groups.length) return false;
  return groups.every(g=>(g||[]).some(k=>hay.indexOf(String(k).toLowerCase())>=0));
}

function requiredKey(req,i){ return req.key||('req'+i); }

function uploadReqScore(u,req){
  const name=String(u.name||''), ext=String(u.kind||'').toLowerCase();
  if(req.exclude&&req.exclude.test(name)) return 0;
  if(req.kind==='table' && !(u.tableIds||[]).length && !['xlsx','xls','csv','tsv'].includes(ext)) return 0;
  if(req.kind==='content' && !String(u.text||'').trim()) return 0;
  let score=1;
  if(req.detect&&uploadMatchesDetectedKind(u,req.detect)) score+=60;
  if(req.pattern&&req.pattern.test(name)) score+=50;
  const lowName=name.toLowerCase();
  if(keywordHit(lowName,req.keywords)) score+=20;
  else if(keywordHit(uploadHaystack(u),req.keywords)) score+=10;
  else if(req.keywords&&req.keywords.length) score=0;   /* 有指定關鍵字卻完全沒中，不算符合 */
  if(req.kind==='table'&&(u.tableIds||[]).length) score+=2;
  return score;
}

function scenarioUploadStatus(){
  const sc=currentScenario(), files=enabledUploads();
  if(!sc||S.scenario==='own') return {ok:!!sourceMaterial(30000).trim(),missing:[],matched:[],missingItems:[]};
  const reqs=(sc.requiredUploads||[]), assign=S.uploadAssign||{}, used=new Set();
  const matched=[], missing=[], missingItems=[], picks=new Array(reqs.length).fill(null);
  /* 先處理手動指定，再讓其餘需求各自挑分數最高且還沒被用掉的檔案，
     避免同一份檔案同時滿足好幾項需求。 */
  reqs.forEach((req,i)=>{
    const id=assign[requiredKey(req,i)];
    if(!id) return;
    const u=files.find(x=>x.id===id);
    if(u&&!used.has(u.id)){ picks[i]={u,how:'指定'}; used.add(u.id); }
  });
  reqs.forEach((req,i)=>{
    if(picks[i]) return;
    let best=null,bestScore=0;
    files.forEach(u=>{ if(used.has(u.id)) return;
      const sc2=uploadReqScore(u,req); if(sc2>bestScore){ bestScore=sc2; best=u; } });
    if(best){ picks[i]={u:best,how:bestScore>=50?'檔名':bestScore>=10?'內容':'型別'}; used.add(best.id); }
  });
  reqs.forEach((req,i)=>{
    if(picks[i]) matched.push({key:requiredKey(req,i),label:req.label,name:picks[i].u.name,id:picks[i].u.id,how:picks[i].how});
    else { missing.push(req.label); missingItems.push(req); }
  });
  return {ok:missing.length===0,missing,missingItems,matched};
}

function missingPageNote(){
  const sc=currentScenario(); if(!sc||S.scenario==='own') return null;
  const items=scenarioUploadStatus().missingItems||[]; if(!items.length) return null;
  const pages=new Set(); items.forEach(r=>(r.pages||[]).forEach(n=>pages.add(n)));
  return {labels:items.map(r=>r.label),pages:Array.from(pages).sort((a,b)=>a-b)};
}

function scenarioTemplateStatus(){
  return {ok:true,msg:S.pptTemplate?'已套用 PowerPoint 母片：'+S.pptTemplate.name:'未上傳母片，將使用目前網站風格'};
}

function autoPageRecommendation(){
  const sc=currentScenario(), raw=sourceMaterial(30000), tables=availableTables();
  const rowCount=tables.reduce((sum,t)=>sum+Math.max(0,Number((t.rows||[]).length)||0),0);
  const base=sc&&S.scenario!=='own' ? Math.max(3,Number(sc.pages)||3)+(sc.includeCover?1:0)+(sc.includeAgenda?1:0)+(sc.includeClosing?1:0) : 4;
  const textPages=Math.min(6,Math.floor(raw.length/1700));
  const tablePages=Math.min(5,tables.length+(rowCount>40?1:0)+(rowCount>150?1:0));
  const sourcePages=Math.min(3,Math.floor(Math.max(0,enabledUploads().length-1)/2));
  return Math.max(base,Math.min(18,base+textPages+tablePages+sourcePages));
}

function rulesObj(){
  const saved=LS.get('rulesObj',{})||{}, out=Object.assign({},RULES_BASE);
  Object.keys(saved).forEach(k=>{
    const v=saved[k];
    if(v===null||v===undefined) return;
    if(typeof RULES_BASE[k]==='number'&&!Number.isFinite(Number(v))) return;
    out[k]=v;
  });
  return out;
}

function buildRulesText(r){
  r = r || rulesObj();
  const pageRule=Number(r.pages)>0
    ? `總頁數固定為 ${Math.trunc(Number(r.pages))} 頁。`
    : `依內容量自動判斷頁數（目前建議約 ${autoPageRecommendation()} 頁）；不得為了塞進三頁而縮字或堆疊文字，每頁只保留一個主要訊息。`;
  return `[角色設定] 你是一位${r.role}。
[目標受眾] ${r.audience}（需用數據說話、邏輯清晰、強調行動建議）。
[頁數規範] ${pageRule}
[每頁格式規範]
- 頁標題：${r.titleMax} 字以內，精準帶出主題。
- 核心結論：${r.kickerMax} 字以內，用一句話點出該頁精髓，放置於頁首。
- 條列內容：最多 ${r.bulletCount} 點，每點 ${r.bulletMax} 字以內${r.units?'；引用數據時必須保留原始單位、年份與比較口徑':''}。
[嚴格禁令] 嚴禁使用「${r.banned}」等模糊形容詞。`;
}

function effectiveRulesText(r){
  r=r||rulesObj();
  const generated=buildRulesText(r), pageLine=(generated.match(/^\[頁數規範\].*$/m)||[])[0]||'';
  if(!S.rulesEdited||!String(S.rules||'').trim()) return generated;
  let manual=String(S.rules).trim();
  if(/^\[頁數規範\].*$/m.test(manual)) manual=manual.replace(/^\[頁數規範\].*$/m,pageLine);
  else manual=[manual,pageLine].filter(Boolean).join('\n');
  return manual+`\n[頁數最終優先規則] 目前頁數欄位為 ${Number(r.pages)>0?Math.trunc(Number(r.pages))+' 頁':'自動'}；若前文出現其他頁數，一律忽略。`;
}

function chartValue(value){
  let t=String(value==null?'':value).trim();
  if(!t) return null;
  /* 全形數字與全形符號先正規化，否則整欄會被判成非數值 */
  if(t.normalize) t=t.normalize('NFKC').trim();
  t=t.replace(/[−–—]/g,'-').replace(/，/g,',');
  if(!t) return null;
  const neg=/^\(.*\)$/.test(t); if(neg) t=t.slice(1,-1).trim();
  let unit='';
  if(/%/.test(t)){ unit='%'; t=t.replace(/%/g,''); }
  const cur=t.match(/^(NT\$|US\$|\$|NT|新台幣|台幣)\s*/i);
  if(cur){ t=t.slice(cur[0].length); if(!unit) unit='元'; }
  t=t.replace(/\s+/g,'').replace(/^\+/,'');
  const m=t.match(/^([-+]?\d[\d,]*(?:\.\d+)?)(兆|億|萬|千|k|K|M)?(.*)$/);
  if(!m) return null;
  let numStr=m[1], scaleTok=m[2]||'', rest=(m[3]||'').trim();
  const combinedUnit=(scaleTok+rest).trim();
  if(scaleTok&&rest&&UNIT_WORDS.test(combinedUnit)){ scaleTok=''; rest=combinedUnit; }
  /* 逗號分組：每一組至少三位才算分位符號。
     這樣「21,1013,8047」這種四位一組的機關報表寫法讀得到，
     而以逗號當小數點的「1,5」（逗號後只有一位）仍然會被拒絕。 */
  if(numStr.indexOf(',')>=0){
    if(!/^[-+]?\d{1,4}(,\d{3,4})+(\.\d+)?$/.test(numStr)) return null;
    numStr=numStr.replace(/,/g,'');
  }
  if(!/^[-+]?\d+(?:\.\d+)?$/.test(numStr)) return null;
  if(rest){
    if(rest.length>4||!UNIT_WORDS.test(rest)) return null;
    if(!unit||unit==='元') unit=rest;
  }
  const n=Number(numStr)*(scaleTok?NUM_SCALES[scaleTok]:1);
  if(!Number.isFinite(n)) return null;
  return {value:(neg?-1:1)*n,unit};
}

function chartNum(value){ const p=chartValue(value); return p?p.value:null; }

function numericColumns(table){
  return (table.headers||[]).map((name,index)=>{
    const vals=(table.rows||[]).map(r=>chartValue(r[index])).filter(v=>v!==null);
    /* 沒有標單位的儲存格不算「不同單位」：一整欄件數裡有一格寫成「1,200 件」
       不應該讓整欄被判成單位混用而整個丟掉。 */
    const named=new Set(vals.map(v=>v.unit).filter(Boolean));
    return {name,index,count:vals.length,unit:named.size===1?Array.from(named)[0]:'',mixedUnits:named.size>1};
  }).filter(c=>c.index>0&&!c.mixedUnits&&c.count>=Math.max(2,Math.ceil((table.rows||[]).length*.5)));
}

function monthlyScenarioEvidence(){
  if(S.scenario!=='monthly')return {text:'',sales:false,cooling:false,details:null};
  return MonthlyAnalysis.compute(availableTables());
}

function monthlyComputedMarkdown(calc){
  calc=calc||monthlyScenarioEvidence(); if(!calc.sales||!calc.details) return '';
  const d=calc.details, fmt=n=>Number.isFinite(n)?n.toLocaleString('zh-TW',{maximumFractionDigits:2}):'資料待補', pct=n=>Number.isFinite(n)?n.toFixed(2)+'%':'資料待補',
    pp=(d.s25-d.s24), non24=100-d.s24, non25=100-d.s25,
    direction=d.overall>=0?'增加':'減少', lead=(d.ranked||[])[0];
  const page1=`# 夏季住宅用電總覽\n\n> 2025 年夏季住宅用電較 2024 年${direction} ${pct(Math.abs(d.overall))}，六都占比變化 ${pp>=0?'+':''}${fmt(pp)} 個百分點\n\n`+
    `- 2024 年夏季（6–9 月）住宅部門售電量：${fmt(d.totals[2024])} 度\n`+
    `- 2025 年夏季（6–9 月）住宅部門售電量：${fmt(d.totals[2025])} 度\n`+
    `- 2024→2025 年夏季住宅用電同期變化率：${pct(d.overall)}\n`+
    `- 2024 年六都占比：${pct(d.s24)}；非六都占比：${pct(non24)}\n`+
    `- 2025 年六都占比：${pct(d.s25)}；非六都占比：${pct(non25)}\n`+
    `- 六都占比變化：${pp>=0?'+':''}${fmt(pp)} 個百分點；相對變化 ${pct((d.s25/d.s24-1)*100)}\n`+
    `- 非六都占比變化：${(-pp)>=0?'+':''}${fmt(-pp)} 個百分點；相對變化 ${pct((non25/non24-1)*100)}\n`+
    `備註：售電量已檢核兩年度及全台縣市 6–9 月覆蓋；缺少的冷氣時另外標示，售電量單位為度。`;
  const rankLines=(d.ranked||[]).map((x,i)=>`- 第 ${i+1} 名 ${x.c}：住宅用電增幅 ${pct(x.g)}；`+
    (calc.cooling?`2024 年冷氣時 ${fmt(x.c24)} 小時，2025 年 ${fmt(x.c25)} 小時，變化 ${fmt(Number.isFinite(x.c25)&&Number.isFinite(x.c24)?x.c25-x.c24:NaN)} 小時`:'冷氣時資料待補')).join('\n');
  const page2=`# 用電增幅縣市與冷氣時關聯\n\n> ${lead?`${lead.c}的住宅用電增幅最高（${pct(lead.g)}）`:'依 2024→2025 年夏季住宅用電變化率排序'}；冷氣時僅作並列觀察，不代表因果\n\n`+
    `- 排序口徑：各縣市 2024→2025 年 6–9 月住宅售電量合計變化率，由高至低排序\n${rankLines}\n`+
    `備註：售電資料已檢核全台夏季覆蓋；冷氣時缺項標示資料待補。兩者為並列觀察，未進行因果推論。`;
  return page1+'\n\n'+page2;
}

function mergeMonthlyComputedPages(markdown){
  const fixed=monthlyComputedMarkdown(); if(!fixed) return String(markdown||'').trim();
  const raw=String(markdown||'').replace(/^＃\s*/gm,'# ').trim();
  const sections=raw.split(/(?=^#{1,6}\s+)/m).map(x=>x.trim()).filter(x=>/^#{1,6}\s+/.test(x));
  /* AI 已依指定頁數產出四頁以上時，完整保留其章節與頁數。
     完整 Excel 計算結果早已放入 Prompt，不再把回覆硬裁成兩頁加策略頁。 */
  if(sections.length>3) return sections.join('\n\n');
  const third=sections[2]||'# 夏月高用電縣市節能策略\n\n> 依上傳的節能推廣來源提出對應策略\n\n- 資料待補\n備註：尚缺節能推廣策略來源。';
  return fixed+'\n\n'+third.trim();
}

function slideChartContext(slide,index){
  slide=slide||{};
  const layout=slide.layout||'bullets', showBullets=['agenda','bullets','closing'].includes(layout);
  return {
    page:(index==null?S.cursor:index)+1, layout,
    title:slide.title||'', subtitle:slide.subtitle||'', kicker:slide.kicker||'',
    bullets:showBullets?(slide.bullets||[]).map(b=>({heading:b.h||'',detail:b.d||''})):[],
    columns:layout==='twoCol'?(slide.columns||[]).map(c=>({heading:c.h||'',items:c.items||[]})):[],
    stat:layout==='stat'?(slide.stat||null):null, quote:layout==='quote'?(slide.quote||null):null,
    chart:layout==='chart'?(slide.chart||null):null, speakerNote:slide.note||''
  };
}

function chartContextText(slide){
  const c=slideChartContext(slide,S.cursor);
  return [c.title,c.subtitle,c.kicker,c.speakerNote,
    ...c.bullets.flatMap(b=>[b.heading,b.detail]),
    ...c.columns.flatMap(col=>[col.heading,...col.items]),
    c.stat&&c.stat.value,c.stat&&c.stat.label,c.quote&&c.quote.text,c.quote&&c.quote.by,
    c.chart&&c.chart.title,...(c.chart&&c.chart.labels||[])]
    .filter(Boolean).join(' ').toLowerCase();
}

function chartTerms(text){
  const chunks=String(text||'').toLowerCase().replace(/[%％]/g,' 比率 ')
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean), out=new Set();
  chunks.forEach(chunk=>{
    if(chunk.length>=2) out.add(chunk);
    if(/[\u3400-\u9fff]/.test(chunk)){
      for(let n=2;n<=Math.min(4,chunk.length);n++) for(let i=0;i<=chunk.length-n;i++) out.add(chunk.slice(i,i+n));
    }
  });
  return out;
}

function chartRelevance(context,label){
  const a=String(context||'').toLowerCase().replace(/\s+/g,''), b=String(label||'').toLowerCase().replace(/\s+/g,'');
  if(!a||!b) return 0;
  let score=a.includes(b)?50:0;
  const at=chartTerms(context), bt=chartTerms(label);
  bt.forEach(t=>{ if(at.has(t)) score+=Math.min(12,t.length*3); });
  return score;
}

function monthlyDerivedChartTables(){
  const calc=monthlyScenarioEvidence(), d=calc&&calc.details;
  if(!d||!calc.sales) return [];
  const pct=v=>Number.isFinite(Number(v))?Number(v).toFixed(2)+'%':'';
  const amount=v=>Number.isFinite(Number(v))?Number(v).toFixed(2)+'度':'';
  const overview={id:'computed:monthly:overview',title:'系統計算｜2024～2025 夏季住宅用電總覽',
    headers:['年度','夏季住宅用電總量','六都占比','非六都占比'],
    rows:[[2024,amount(d.totals&&d.totals[2024]),pct(d.s24),pct(100-d.s24)],
      [2025,amount(d.totals&&d.totals[2025]),pct(d.s25),pct(100-d.s25)]],totalRows:2,computed:true};
  const countyRows=(d.ranked||[]).map(x=>[x.c,pct(x.g),
    Number.isFinite(Number(x.c24))?Number(x.c24).toFixed(2)+'小時':'',
    Number.isFinite(Number(x.c25))?Number(x.c25).toFixed(2)+'小時':'',
    Number.isFinite(Number(x.c24))&&Number.isFinite(Number(x.c25))?(Number(x.c25)-Number(x.c24)).toFixed(2)+'小時':'']);
  const county={id:'computed:monthly:county',title:'系統計算｜住宅用電增幅前 10 縣市與冷氣時',
    headers:['縣市','住宅用電增幅','2024 年冷氣時','2025 年冷氣時','冷氣時變化'],
    rows:countyRows,totalRows:countyRows.length,computed:true};
  return countyRows.length?[overview,county]:[overview];
}

function chartTablesForSlide(){
  const derived=S.scenario==='monthly'?monthlyDerivedChartTables():[];
  return derived.concat(availableTables()).filter((t,i,a)=>a.findIndex(x=>x.id===t.id)===i);
}

function rankedChartTables(slide){
  const context=chartContextText(slide);
  return chartTablesForSlide(slide).filter(t=>numericColumns(t).length).map(table=>{
    const focusText=[slide.title,slide.kicker].filter(Boolean).join(' ');
    const cols=numericColumns(table).map(col=>Object.assign({},col,{relevance:3*chartRelevance(focusText,col.name)+chartRelevance(context,col.name)}))
      .sort((a,b)=>b.relevance-a.relevance);
    const focus=[slide.title,slide.kicker].filter(Boolean).join(' ');
    const score=2*chartRelevance(focus,table.title)+chartRelevance(context,table.title)+Math.max(0,...cols.map(c=>c.relevance))+
      chartRelevance(context,(table.headers||[])[0]);
    return {table,columns:cols,score};
  }).sort((a,b)=>b.score-a.score);
}

function chartEvidencePlan(slide){
  slide=slide||{};
  const ranked=rankedChartTables(slide), sameSlide=S.chartDraftSlideId===(slide.id||''),
    locked=sameSlide&&S.chartDraftTableLocked
      ? ranked.find(x=>x.table.id===S.chartDraftTableId):null,
    hit=locked||ranked[0]||null;
  if(!hit) return {ranked,hit:null,locked:false,confidence:'none',confidenceLabel:'沒有數值資料'};
  const numeric=numericColumns(hit.table), best=hit.columns[0]||numeric[0]||null,
    categoryIndex=chartCategoryForSlide(hit.table,slide), score=Number(hit.score)||0;
  const confidence=locked?'locked':score>=70?'high':score>=24?'medium':'low';
  return {ranked,hit,locked:!!locked,score,confidence,
    confidenceLabel:{locked:'已由使用者鎖定',high:'關鍵詞高度吻合',medium:'部分關鍵詞吻合',low:'關鍵詞不足，請確認'}[confidence],
    categoryIndex,categoryName:(hit.table.headers||[])[categoryIndex]||'',valueColumn:best||null};
}

function chartTableInfo(table,context){
  const nums=numericColumns(table);
  const summaries=nums.map(col=>{
    let pairs=(table.rows||[]).map(r=>({label:String(r[0]||''),value:chartNum(r[col.index])})).filter(x=>x.value!==null);
    if(pairs.length>3) pairs=pairs.filter(x=>!/(總計|合計|total)/i.test(x.label));
    if(!pairs.length) return `${col.name}（數值欄）`;
    const top=pairs.slice().sort((a,b)=>b.value-a.value)[0];
    return `${col.name}（與本頁相關度 ${chartRelevance(context,col.name)}；${pairs.length} 筆；最高：${top.label} ${top.value}）`;
  });
  return {id:table.id,title:table.title,headers:table.headers,numeric:summaries,
    relevance:chartRelevance(context,[table.title,...table.headers].join(' ')),sample:(table.rows||[]).slice(0,6)};
}

function slideContentItems(slide,activeOnly=false){
  slide=slide||{}; const out=[], layout=slide.layout||'bullets';
  const push=(label,detail)=>{ label=String(label||'').trim(); detail=String(detail||'').trim();
    if(label&&!out.some(x=>x.label===label)) out.push({label:label.slice(0,18),detail:detail.slice(0,34)}); };
  const add={
    bullets:()=> (slide.bullets||[]).forEach(b=>push(b.h,b.d)),
    twoCol:()=> (slide.columns||[]).forEach(c=>push(c.h,(c.items||[]).slice(0,3).join('、'))),
    stat:()=> slide.stat&&push(slide.stat.value,slide.stat.label),
    quote:()=> slide.quote&&push(slide.quote.by||'核心觀點',slide.quote.text),
    chart:()=>{
      if(!slide.chart) return;
    if(slide.chart.type==='content') (slide.chart.items||[]).forEach(x=>push(x.label,x.detail));
    else (slide.chart.labels||[]).forEach((label,i)=>push(label,(slide.chart.series||[]).map(s=>`${s.name||'數值'} ${String((s.values||[])[i]??'')}`).join('、')));
    }
  };
  const first=['agenda','closing'].includes(layout)?'bullets':layout;
  const sources=activeOnly?[first]:[first,'bullets','twoCol','stat','quote','chart'];
  sources.filter((x,i,a)=>a.indexOf(x)===i).forEach(k=>add[k]&&add[k]());
  if(!out.length && slide.kicker) push(slide.kicker,slide.subtitle||'');
  if(!out.length && slide.subtitle) push(slide.subtitle,'');
  if(!out.length) push(slide.title||'本頁重點','依目前簡報內容整理');
  return out.slice(0,6);
}

function ensureLayoutContent(slide,target){
  const items=slideContentItems(slide), compact=items.map(x=>({h:x.label,d:x.detail}));
  if(target==='cover'&&!String(slide.subtitle||'').trim()) slide.subtitle=slide.kicker||items.map(x=>x.label).slice(0,2).join('｜');
  if(['agenda','bullets','closing'].includes(target)&&!(slide.bullets||[]).length) slide.bullets=compact.slice(0,target==='closing'?3:6);
  if(target==='twoCol'&&!(slide.columns||[]).length){
    const mid=Math.max(1,Math.ceil(items.length/2));
    slide.columns=[{h:'重點一',items:items.slice(0,mid).map(x=>x.detail?`${x.label}：${x.detail}`:x.label)},
      {h:'重點二',items:items.slice(mid).map(x=>x.detail?`${x.label}：${x.detail}`:x.label)}];
  }
  if(target==='stat'&&!slide.stat){
    const pool=[slide.kicker,slide.subtitle,...items.flatMap(x=>[x.label,x.detail])].filter(Boolean), hit=pool.map(String).find(x=>/[−-]?\d[\d,.]*\s*(?:%|％|人|戶|件|場|元|度|萬|億)?/.test(x));
    if(hit){ const m=hit.match(/[−-]?\d[\d,.]*\s*(?:%|％|人|戶|件|場|元|度|萬|億)?/); slide.stat={value:m?m[0]:'',label:hit}; }
    else slide.stat={value:items[0]&&items[0].label||slide.title,label:items[0]&&items[0].detail||slide.kicker||''};
  }
  if(target==='quote'&&!slide.quote){ const first=items[0]||{}; slide.quote={text:slide.kicker||first.detail||first.label||slide.title,by:first.detail&&first.label||''}; }
  slide.layout=target;
}

function slideFitWarnings(slide){
  if(!slide) return [];
  const warnings=[], title=String(slide.title||''), layout=slide.layout||'bullets';
  if(title.length>(layout==='cover'?34:26)) warnings.push('標題偏長，建議拆成主標與副標');
  if(['bullets','agenda','closing'].includes(layout)){
    const items=slide.bullets||[], total=items.reduce((n,b)=>n+String(b.h||'').length+String(b.d||'').length,0);
    if(items.length>6||total>220) warnings.push('條列內容較多，建議分成兩頁或改用雙欄');
  }
  if(layout==='twoCol'){
    const items=(slide.columns||[]).flatMap(c=>c.items||[]), total=items.reduce((n,v)=>n+String(v||'').length,0);
    if(items.length>8||total>210) warnings.push('雙欄內容較密，建議刪減文字或拆頁');
  }
  if(layout==='quote'&&String(slide.quote&&slide.quote.text||'').length>95) warnings.push('引言過長，建議保留一句核心話');
  if(layout==='cover'&&String(slide.subtitle||'').length>80) warnings.push('封面副標偏長，建議移到下一頁');
  return warnings;
}

function slideNumberSeries(slide){
  /* 先只看目前版型的內容；抓不到兩筆再放寬到整頁所有欄位。
     舊版只看目前版型，混合內容的頁面（條列＋雙欄）因此常常生不出圖。 */
  let items=slideContentItems(slide,true);
  if(items.length<2) items=slideContentItems(slide,false);
  const groups={};
  items.forEach(item=>{
    const raw=(item.detail||item.label||'').trim().replace(/(?:民國\s*)?\d{2,4}\s*年/g,' ');
    if(!raw || /(?:第\s*\d+|步驟\s*\d+|階段\s*\d+)/.test(raw)) return;
    const matches=Array.from(raw.matchAll(/(-?\d[\d,]*(?:\.\d+)?)\s*(%|％|萬|億|人|戶|件|次|元|度|倍|kwh|mwh|gwh|kw|mw|gw)/ig));
    if(matches.length!==1) return;
    const m=matches[0], value=chartNum(m[1]), unit=m[2].toLowerCase().replace('％','%');
    if(value===null) return;
    const key=unit||'unitless'; (groups[key]||(groups[key]=[])).push({label:item.label,value,unit});
  });
  const best=Object.values(groups).sort((a,b)=>b.length-a.length)[0]||[];
  if(best.length<2) return null;
  return {labels:best.map(x=>x.label),values:best.map(x=>x.value),unit:best[0].unit||''};
}

function buildChartPrompt(){
  const cur=S.slides[S.cursor]||{};
  const context=slideChartContext(cur,S.cursor), contextText=chartContextText(cur);
  const evidence=chartEvidencePlan(cur);
  const tableRanks=evidence.locked?[evidence.hit]:evidence.ranked;
  const tables=tableRanks.filter(x=>x&&(evidence.locked||x.score>=24)).map(x=>x.table);
  const inline=slideNumberSeries(cur);
  const preferredLimit=/前\s*10|top\s*10|十\s*(?:名|高)/i.test(contextText)?10:8;
  const task=tables.length ? `[可用資料表｜已依本頁文字相關性排序]
${JSON.stringify(tables.map(t=>chartTableInfo(t,contextText)),null,2)}

請只輸出一個 JSON 物件：
{"tableId":"從上面選一個 id","type":"column|bar|line|doughnut","categoryColumn":"分類欄名稱","valueColumns":["數值欄名稱，最多兩欄；doughnut 只能一欄"],"sort":"source|desc","limit":${preferredLimit},"title":"圖表頁標題，20字內","kicker":"只根據已提供數值寫一句結論，24字內","note":"講稿一句，30字內"}

- 先判斷目前頁面的主要論點，再選能證明或解釋該論點的資料表與數值欄
- 本機內容比對建議：${evidence.hit?`${evidence.hit.table.title}；分類「${evidence.categoryName}」；優先指標「${evidence.valueColumn?evidence.valueColumn.name:'無'}」；可信度：${evidence.confidenceLabel}`:'沒有可用資料表'}
${evidence.locked?`- 使用者已鎖定資料表 id「${evidence.hit.table.id}」；tableId 必須完全相同，不得改選其他資料表。`:''}
- 時間序列用 line、項目比較用 column、名稱較長或排名用 bar、單一系列占比用 doughnut
- 不要自行產生、修改、加總或換算任何數值。`
    : inline ? `[本頁已明確寫出的數值｜系統只會採用這些原文數字]
${JSON.stringify(inline,null,2)}

請只輸出一個 JSON 物件：
{"mode":"inline","type":"column|bar|line","title":"延續本頁論點的標題，20字內","kicker":"只根據本頁明示數值寫一句結論，24字內","note":"講稿一句，30字內"}

- 不得修改、補算或新增任何數值；實際數字由系統從本頁原文重新讀取。`
    : `[本頁沒有足以形成數據圖表的明示數值]

請改做「內容結構圖」，只輸出一個 JSON 物件：
{"mode":"content","type":"content","title":"延續本頁論點的標題，20字內","kicker":"內容結構圖，不含推估數值","items":[{"label":"重點標籤，12字內","detail":"原頁內容的短說明，24字內"}],"note":"講稿一句，30字內"}

- items 需 3–5 項，只能整理目前頁面已出現的內容
- 不得虛構數字、比例、排名、因果或成效。`;
  return `你是簡報資料視覺化編輯。請根據使用者目前選取的頁面，新增一頁能直接支撐該頁論點的圖表。不要改寫、刪除或重新排列原本的大綱頁面。

[簡報整體脈絡]
主題：${S.topic||'未命名簡報'}
對象：${S.audience||'未指定'}
語氣：${S.tone||'未指定'}

[目前選取頁面｜這是判斷圖表內容的主要依據]
${JSON.stringify(context,null,2)}

${task}

共同原則：title 與 kicker 要延續目前頁面的主要論點；只輸出 JSON。`;
}

function normHeader(x){
  let t=String(x==null?'':x);
  if(t.normalize) t=t.normalize('NFKC');
  return t.replace(/[\s（）()\[\]【】「」]/g,'').toLowerCase();
}

function resolveColumn(table,value,fallback){
  const hs=table.headers||[];
  if(Number.isInteger(value) && value>=0 && value<hs.length) return value;
  if(value==null||String(value).trim()==='') return fallback;
  const want=String(value).trim();
  let i=hs.findIndex(h=>String(h).trim()!==''&&String(h).trim()===want);
  if(i>=0) return i;
  const n=normHeader(want); if(!n) return fallback;
  i=hs.findIndex(h=>normHeader(h)===n); if(i>=0) return i;
  i=hs.findIndex(h=>{ const hn=normHeader(h); return hn&&(hn.indexOf(n)===0||n.indexOf(hn)===0); });
  if(i>=0) return i;
  i=hs.findIndex(h=>{ const hn=normHeader(h); return hn&&n.length>=2&&(hn.indexOf(n)>=0||n.indexOf(hn)>=0); });
  return i>=0?i:fallback;
}

function categoryColumnIndex(table,numeric){
  const rows=table.rows||[], headers=table.headers||[];
  const numericIdx=new Set((numeric||[]).map(c=>c.index));
  let best=-1,bestScore=-1;
  headers.forEach((h,i)=>{
    if(numericIdx.has(i)) return;
    const vals=rows.map(r=>String(r[i]==null?'':r[i]).trim()).filter(Boolean);
    if(!vals.length) return;
    const distinct=new Set(vals).size;
    /* 相異度優先；同分時取比較靠左的欄 */
    const score=distinct*100-i;
    if(distinct>=2&&score>bestScore){ bestScore=score; best=i; }
  });
  if(best>=0) return best;
  /* 全部欄位都只有一種值時退回第 0 欄，由上層判斷要不要出圖 */
  return 0;
}

function distinctLabelCount(table,index){
  return new Set((table.rows||[]).map(r=>String(r[index]==null?'':r[index]).trim()).filter(Boolean)).size;
}

function aggregateDuplicateChartRows(rows,valueIndices,table){
  const normalized=x=>String(x||'').trim().replace(/^台(?=[北中南東])/,'臺').toLowerCase();
  const duplicate=new Set(rows.map(r=>normalized(r.label))).size<rows.length;
  if(!duplicate) return {rows,grouped:false};
  if(valueIndices.some(i=>/%|％|率|占比|平均|單價|每/.test(String((table.headers||[])[i]||''))))throw new Error('同分類含多筆比率、占比或平均值，不能直接平均。請提供分子與分母或先整理成已核對的彙總表。');
  const modes=valueIndices.map(()=>'sum');
  const groups=new Map();
  rows.forEach(row=>{
    const key=normalized(row.label); if(!key) return;
    if(!groups.has(key)) groups.set(key,{label:String(row.label).trim().replace(/^台(?=[北中南東])/,'臺'),sums:valueIndices.map(()=>0),counts:valueIndices.map(()=>0)});
    const g=groups.get(key); row.values.forEach((v,i)=>{ if(Number.isFinite(v)){g.sums[i]+=v;g.counts[i]++;} });
  });
  return {grouped:true,rows:Array.from(groups.values()).map(g=>({label:g.label,
    values:g.sums.map((v,i)=>modes[i]==='average'&&g.counts[i]?v/g.counts[i]:v)}))};
}

function chartCategoryForSlide(table,slide){
  const nums=numericColumns(table),fallback=categoryColumnIndex(table,nums);
  const focus=[slide.title,slide.kicker].filter(Boolean).join(' ');
  const ranking=/排名|排行|前\s*\d+|最高|最低|top\s*\d+/i.test(focus);
  const trend=/趨勢|逐月|逐年|每月|歷年|時間|trend/i.test(focus);
  const composition=/占比|佔比|組成|構成|分布比例/.test(focus);
  const candidates=table.headers.map((name,index)=>({name,index})).filter(c=>distinctLabelCount(table,c.index)>=2&&
    (!nums.some(n=>n.index===c.index)||/年度|年份|月份|日期|年月|date|year|month/i.test(c.name)));
  const score=c=>{const time=/年|月|日期|季|週|date|year|month|time/i.test(c.name);
    return chartRelevance(focus,c.name)*3+(c.index===fallback?1:0)+(trend&&time?100:0)+((ranking||composition)&&!time?60:0);};
  return candidates.sort((a,b)=>score(b)-score(a))[0]?.index??fallback;
}
function quickChartSpec(){
  const cur=S.slides[S.cursor]||{}, plan=chartEvidencePlan(cur), hit=plan.locked||plan.score>=24?plan.hit:null;
  if(!hit){
    const inline=slideNumberSeries(cur), title=clipText(cur.kicker||cur.title||'本頁重點',20);
    if(inline) return {mode:'inline',type:inline.labels.some(x=>String(x).length>8)?'bar':'column',title,
      kicker:'使用本頁明示數值，不含推估',note:'本圖數值取自原簡報頁面文字。'};
    return {mode:'content',type:'content',title:clipText(cur.title||'本頁內容架構',20),
      kicker:'依原頁內容整理，不含推估數值',items:slideContentItems(cur,true),note:'本圖依原簡報頁面內容整理。'};
  }
  const table=hit.table, col=hit.columns[0]||numericColumns(table)[0];
  const categoryIndex=chartCategoryForSlide(table,cur),category=table.headers[categoryIndex]||'';
  /* 圖表型別要看分類軸。數值欄叫「2024 年售電量」不代表分類軸是時間；
     若分類是縣市，應使用柱狀／橫條圖而不是誤判成折線圖。 */
  const timeLike=/(年|月|日|季|週|年度|week|month|year|quarter|date|time)/i.test(category);
  const longLabels=(table.rows||[]).slice(0,10).some(r=>String(r[categoryIndex]||'').length>8);
  const focus=[cur.title,cur.kicker].filter(Boolean).join(' '),ranking=/排名|排行|前\s*\d+|最高|最低|top\s*\d+/i.test(focus);
  const share=/占比|佔比|組成|構成|分布比例/.test(focus)&&!/變化|增幅|成長/.test(col.name);
  const values=table.rows.map(r=>chartNum(r[col.index])),unique=distinctLabelCount(table,categoryIndex)===table.rows.length;
  const samePeriod=table.headers.every((name,i)=>i===categoryIndex||!/日期|年月|年度|年份|月份|date|year|month/i.test(name)||distinctLabelCount(table,i)<=1);
  const whole=share&&samePeriod&&unique&&values.length>=2&&values.length<=6&&values.every(v=>v!==null&&v>=0)&&values.reduce((a,b)=>a+b,0)>0;
  const title=clipText(cur.kicker||cur.title||col.name+'比較',20);
  const limit=/前\s*10|top\s*10|十\s*(?:名|高)/i.test(chartContextText(cur))?10:8;
  return {tableId:table.id,type:timeLike?'line':whole?'doughnut':ranking||longLabels?'bar':'column',categoryColumn:category,
    valueColumns:[col.name],sort:timeLike?'source':'desc',limit,title,
    kicker:clipText(col.name+'呈現本頁重點的資料差異',24),
    note:('本圖依第 '+(S.cursor+1)+' 頁「'+(cur.title||'未命名')+'」內容選取 '+col.name+'。').slice(0,30)};
}

function chartDraftSetup(slide){
  const ranked=rankedChartTables(slide), all=ranked.map(x=>x.table);
  if(S.chartDraftSlideId!==(slide.id||'')){ S.chartDraftSlideId=slide.id||''; S.chartDraftTableId=''; S.chartDraftTableLocked=false; S.chartDraftFieldsConfirmed=false; }
  const selected=all.find(t=>t.id===S.chartDraftTableId)||(ranked[0]&&ranked[0].table)||null;
  if(!selected) return {table:null,tables:[],numeric:[],categories:[],categoryIndex:0,valueIndex:-1,type:'content',limit:5};
  S.chartDraftTableId=selected.id;
  const numeric=numericColumns(selected), recommended=quickChartSpec();
  /* 不把「上傳過資料表」誤當成每頁都要使用同一表；低相關頁仍用本頁結構。 */
  if(!S.chartDraftTableLocked&&['content','inline'].includes(recommended.mode))return {table:null,tables:all,numeric:[],categories:[],categoryIndex:0,valueIndex:-1,type:recommended.type,limit:5};
  const categoryIndex=resolveColumn(selected,recommended.tableId===selected.id?recommended.categoryColumn:null,categoryColumnIndex(selected,numeric));
  const categories=(selected.headers||[]).map((name,index)=>({name,index,count:distinctLabelCount(selected,index)}))
    .filter(x=>x.count>=2&&(!numeric.some(n=>n.index===x.index)||/(年|月|日|季|週|年度|date|time)/i.test(x.name)));
  if(!categories.some(x=>x.index===categoryIndex)) categories.unshift({name:selected.headers[categoryIndex]||'第 1 欄',index:categoryIndex,count:distinctLabelCount(selected,categoryIndex)});
  const measures=numeric.filter(c=>c.index!==categoryIndex);
  const valueIndex=resolveColumn(selected,recommended.tableId===selected.id&&(recommended.valueColumns||[])[0],measures[0]&&measures[0].index);
  const timeLike=/(年|月|日|季|週|年度|date|time)/i.test(String(selected.headers[categoryIndex]||''));
  const labels=(selected.rows||[]).slice(0,12).map(r=>String(r[categoryIndex]||''));
  const type=recommended.tableId===selected.id?recommended.type:(timeLike?'line':labels.some(x=>x.length>8)?'bar':'column');
  return {table:selected,tables:all,numeric:measures,categories,categoryIndex,valueIndex,type,limit:/前\s*10|top\s*10/i.test(chartContextText(slide))?10:8};
}

function manualChartSpec(){
  const cur=S.slides[S.cursor]||{}, setup=chartDraftSetup(cur);
  if(!setup.table) return quickChartSpec();
  const get=id=>document.getElementById(id), category=Number(get('chartCategoryPick')&&get('chartCategoryPick').value),
    value=Number(get('chartValuePick')&&get('chartValuePick').value), second=Number(get('chartValuePick2')&&get('chartValuePick2').value),
    type=String(get('chartTypePick')&&get('chartTypePick').value||setup.type), limit=Number(get('chartLimitPick')&&get('chartLimitPick').value)||setup.limit,
    title=String(get('chartTitlePick')&&get('chartTitlePick').value||'').trim();
  const values=[value]; if(Number.isInteger(second)&&second>=0&&second!==value&&type!=='doughnut') values.push(second);
  return {tableId:setup.table.id,type,categoryColumn:setup.table.headers[category]||setup.table.headers[setup.categoryIndex],
    valueColumns:values.map(i=>setup.table.headers[i]).filter(Boolean),sort:type==='line'?'source':'desc',limit,
    title:title||clipText((setup.table.headers[value]||'數值')+'比較',20),note:'依使用者在圖表建立視窗確認的欄位產生。',
    userConfirmed:true};
}

function calibrateChartSpec(spec){
  const out=Object.assign({},spec||{}), sourceSlide=S.slides[S.cursor]||{};
  if(out.userConfirmed||out.mode==='inline'||out.mode==='content'||out.type==='content') return {spec:out,corrections:[]};
  const plan=chartEvidencePlan(sourceSlide), corrections=[];
  if(!plan.hit) return {spec:out,corrections};
  if(!plan.locked&&plan.score<24) return {spec:quickChartSpec(),corrections:['本頁與資料表的關鍵詞不足，採用本頁內容']};
  const selected=plan.ranked.find(x=>x.table.id===out.tableId||x.table.title===out.tableId);
  if(plan.locked||!selected||(plan.score-(Number(selected.score)||0)>=24)){
    if(out.tableId!==plan.hit.table.id) corrections.push('資料表已依目前投影片論點校正');
    out.tableId=plan.hit.table.id;
  }
  const rank=plan.ranked.find(x=>x.table.id===out.tableId)||plan.hit, table=rank.table, numeric=numericColumns(table);
  const fallbackCategory=chartCategoryForSlide(table,sourceSlide), chosenCategory=resolveColumn(table,out.categoryColumn,-1);
  if(chosenCategory<0||distinctLabelCount(table,chosenCategory)<2){
    out.categoryColumn=(table.headers||[])[fallbackCategory]||'';
    corrections.push('分類欄已改為具有相異項目的欄位');
  }
  const best=rank.columns[0]||numeric[0], asked=Array.isArray(out.valueColumns)?out.valueColumns:[];
  const chosenValue=resolveColumn(table,asked[0],-1), chosenMeta=rank.columns.find(x=>x.index===chosenValue);
  if(best&&(!numeric.some(x=>x.index===chosenValue)||!chosenMeta)){
    out.valueColumns=[best.name];
    corrections.push('主要數值欄已依本頁關鍵詞校正');
  }
  // 結論由完整數值重算，避免 AI 僅看前六筆就推論最高值或沿用修正前結論。
  delete out.kicker;
  if(corrections.length){ out.title=sourceSlide.title||'本頁資料比較'; delete out.note; }
  out._evidenceConfidence=plan.confidenceLabel;
  return {spec:out,corrections:Array.from(new Set(corrections))};
}

function chartSlideFromSpec(spec){
  spec=spec||{};
  const source=S.slides[S.cursor]||{}, ranked=rankedChartTables(source);
  const exact=chartTablesForSlide(source).find(t=>t.id===spec.tableId||t.title===spec.tableId);
  const contentMode=spec.mode==='content'||spec.type==='content'||spec.mode==='inline';
  const table=contentMode?null:(exact || (!spec.tableId&&ranked[0]?ranked[0].table:null));
  if(spec.tableId&&!exact) throw new Error('AI 指定的資料表不存在，請重新生成，避免改用與本頁無關的資料。');
  if(!table){
    const inline=slideNumberSeries(source);
    if(inline && spec.mode!=='content' && spec.type!=='content'){
      const type=['column','bar','line'].includes(spec.type)?spec.type:'column';
      return normalize({layout:'chart',title:spec.title||(source.title||'本頁數值比較'),kicker:spec.kicker||'使用本頁明示數值，不含推估',
        chart:{type,labels:inline.labels,series:[{name:inline.unit||'明示數值',values:inline.values}],source:'第 '+(S.cursor+1)+' 頁簡報內容（明示數值）'},
        chartSource:{slideId:source.id||'',page:S.cursor+1,title:source.title||''},note:spec.note||'圖表數值取自原簡報頁面文字。'});
    }
    const items=(Array.isArray(spec.items)?spec.items:slideContentItems(source,true)).map(x=>({
      label:String((x&&x.label)||'').slice(0,18),detail:String((x&&x.detail)||'').slice(0,34)})).filter(x=>x.label).slice(0,5);
    return normalize({layout:'chart',title:spec.title||(source.title||'本頁內容架構'),kicker:spec.kicker||'依原頁內容整理，不含推估數值',
      chart:{type:'content',items:items.length?items:slideContentItems(source,true),source:'第 '+(S.cursor+1)+' 頁簡報內容'},
      chartSource:{slideId:source.id||'',page:S.cursor+1,title:source.title||''},note:spec.note||'內容結構依原簡報頁面整理，未使用推估數值。'});
  }
  const numeric=numericColumns(table);
  if(!numeric.length) throw new Error('這份資料表沒有足夠的數值可畫圖。');
  const categoryIndex=resolveColumn(table,spec.categoryColumn,categoryColumnIndex(table,numeric));
  /* 分類只有一種值時畫出來的圖沒有意義（八根柱子都叫「2025年12月」），
     直接說清楚要改用哪一欄，不要產出一張看起來正常但不能讀的圖。 */
  if(distinctLabelCount(table,categoryIndex)<2){
    const alt=(table.headers||[])
      .map((h,i)=>({h,i,n:distinctLabelCount(table,i)}))
      .filter(x=>x.i!==categoryIndex&&!numeric.some(n=>n.index===x.i)&&x.n>=2)
      .sort((a,b)=>b.n-a.n)[0];
    throw new Error(`「${table.headers[categoryIndex]||'第 1 欄'}」整欄只有一種值，不能當分類軸。`+
      (alt?`請改用「${alt.h}」（${alt.n} 種）。`:'這份表格找不到可以當分類的欄位。'));
  }
  let valueIndices=(Array.isArray(spec.valueColumns)?spec.valueColumns:[])
    .map(v=>resolveColumn(table,v,-1)).filter(i=>numeric.some(n=>n.index===i));
  if(!valueIndices.length) valueIndices=[numeric.slice().sort((a,b)=>
    chartRelevance(chartContextText(source),b.name)-chartRelevance(chartContextText(source),a.name))[0].index];
  const type=['column','bar','line','doughnut'].includes(spec.type)?spec.type:'column';
  if(type==='doughnut') valueIndices=valueIndices.slice(0,1); else valueIndices=valueIndices.slice(0,2);
  let rows=(table.rows||[]).map(r=>({label:String(r[categoryIndex]||'').trim(),
    values:valueIndices.map(i=>chartNum(r[i]))})).filter(r=>r.label&&r.values.every(v=>v!==null));
  if(rows.length>3) rows=rows.filter(r=>!/(總計|合計|total)/i.test(r.label));
  const aggregated=aggregateDuplicateChartRows(rows,valueIndices,table); rows=aggregated.rows;
  /* 類別是年份、月份這類時間序列時不能重新排序，否則趨勢會被打亂。
     舊版只有 quickChartSpec 會送 sort:'source'，AI 回的 spec 幾乎都是 desc。 */
  const catName=String(table.headers[categoryIndex]||'');
  const timeLike=/(年|月|日|季|週|年度|year|month|quarter|week|date|time)/i.test(catName)
    || (rows.length>1&&rows.every(r=>/^(19|20)\d{2}\b/.test(r.label)||/^\d{1,2}月$/.test(r.label)));
  const wantDesc=spec.sort==='desc' || (spec.sort!=='source'&&type!=='line');
  if(wantDesc&&!timeLike) rows.sort((a,b)=>(b.values[0]||0)-(a.values[0]||0));
  const limit=Math.max(3,Math.min(10,Number(spec.limit)||8)); rows=rows.slice(0,limit);
  if(rows.length<2) throw new Error('可用的圖表資料少於兩筆。');
  const labels=rows.map(r=>r.label);
  let safeType=type;
  if(type==='doughnut'&&rows.some(r=>r.values[0]<0)) safeType='column';
  const series=valueIndices.map((column,si)=>({name:table.headers[column]||('數值 '+(si+1)),unit:(numeric.find(n=>n.index===column)||{}).unit||'',
    values:rows.map(r=>r.values[si])}));
  const unit=series[0].unit||'', withUnit=v=>chartValueLabel(v)+(unit&&!String(chartValueLabel(v)).endsWith(unit)?unit:'');
  const defaultKicker=timeLike
    ? `${labels[0]} ${withUnit(series[0].values[0])}，${labels[labels.length-1]} ${withUnit(series[0].values[series[0].values.length-1])}`
    : (()=>{ const top=rows.slice().sort((a,b)=>b.values[0]-a.values[0])[0]; return top?`${top.label}最高：${withUnit(top.values[0])}`:''; })();
  return normalize({layout:'chart',title:spec.title||series[0].name+'比較',kicker:spec.kicker||clipText(defaultKicker,32),
    chart:{type:safeType,labels,series,source:table.title,category:table.headers[categoryIndex],aggregated:aggregated.grouped,
      rowCount:rows.length,sort:timeLike?'source':(wantDesc?'desc':'source')},
    chartSource:{slideId:source.id||'',page:S.cursor+1,title:source.title||''},
    note:[spec.note||('圖表資料來源：'+table.title),aggregated.grouped?'同一分類的重複明細已依欄位性質合計；比率、占比、平均與單價欄採平均。':''].filter(Boolean).join('\n')});
}

function insertChartSlide(spec){
  const checked=calibrateChartSpec(spec); spec=checked.spec;
  const slide=attachSourceNotes([chartSlideFromSpec(spec)])[0]; slide.status='generated';
  if(checked.corrections.length){
    slide.note=[slide.note,'內容校驗：'+checked.corrections.join('、')+'。'].filter(Boolean).join('\n');
  }
  S.lastChartEvidenceCorrection=checked.corrections.join('、');
  S.slides.splice(Math.min(S.cursor+1,S.slides.length),0,slide); S.cursor=Math.min(S.cursor+1,S.slides.length-1);
  S.modal=null; S.tab='chart'; saveDraft(); done();
}

async function suggestChart(){
  const origin=S.slides[S.cursor], originText=JSON.stringify(slideChartContext(origin,S.cursor));
  // 看見預設欄位不等於手動確認，否則每次都以相同預設覆蓋 AI 建議。
  const confirmed=S.chartDraftFieldsConfirmed&&document.getElementById('chartCategoryPick')?manualChartSpec():null;
  const insertResult=spec=>{
    if(S.slides[S.cursor]!==origin||JSON.stringify(slideChartContext(origin,S.cursor))!==originText)
      throw new Error('原投影片已切換或修改，請在目前頁面重新生成圖表');
    if(confirmed){spec=Object.assign({},spec,confirmed,{kicker:'',note:spec.note||confirmed.note});delete spec.mode;}
    insertChartSlide(spec);
  };
  toast('AI 正在依本頁內容選擇圖表');
  const sys='你是簡報資料視覺化編輯。只輸出單一 JSON 物件，不要 markdown 圍籬或說明。';
  const prompt=buildChartPrompt();
  try{
    try{
      const spec=parseJSON(await ask(sys,prompt,null,{temperature:0.2,jsonSchema:CHART_JSON_SCHEMA}));
      insertResult(spec); S.lastChartAiError=''; S.lastChartAiMode='structured';
      return;
    }catch(firstError){
      /* 先記錄真正原因，再用不帶 Schema 的一般 JSON 模式重試一次。這可相容
         尚未支援 structured output 的模型，也可救回供應商暫時變更格式的情況。 */
      S.lastChartAiError=firstError.message||String(firstError);
      const terminal=/原投影片已切換或修改|金鑰無效|沒有權限|額度用完|叫得太頻繁|連不上|通行碼不正確/i.test(S.lastChartAiError);
      if(terminal) throw firstError;
      toast('AI 回覆格式不相容，正在自動調整後重試');
      const spec=parseJSON(await ask(sys,prompt,null,{temperature:0.2}));
      insertResult(spec); S.lastChartAiMode='plain';
      toast('AI 圖表已完成'); setTimeout(()=>done(),1600);
      return;
    }
  }catch(e){
    S.lastChartAiError=e.message||S.lastChartAiError||String(e);
    if(/原投影片已切換或修改/.test(S.lastChartAiError)){ fail(S.lastChartAiError); return; }
    /* 網路、額度或兩種 AI 格式都失敗時，仍以本機規則使用同一頁與同一份資料。
       不補造數值，也不改動原本大綱；只有本機也找不到可用內容時才顯示失敗。 */
    try{
      insertResult(quickChartSpec());
      S.lastChartAiMode='local';
      toast('已依本頁資料完成可編輯圖表（AI 建議暫時未採用）'); setTimeout(()=>done(),2200);
    }catch(localError){ fail((e.message||'AI 圖表生成失敗')+'；本機備援：'+localError.message); }
  }
}

function importChartSpec(){
  const el=document.getElementById('chartPaste'), raw=el?el.value:'';
  if(!raw.trim()) return fail('請先貼上 AI 回覆的圖表內容。');
  try{let spec=parseJSON(raw,'manual');if(document.getElementById('chartCategoryPick')){spec=Object.assign({},spec,manualChartSpec(),{kicker:''});delete spec.mode;}insertChartSlide(spec);}catch(e){fail(e.message);}
}

function refreshChartSelectionSummary(){
 const type=document.getElementById('chartResolvedType'),count=document.getElementById('chartResolvedCount'),detail=document.getElementById('chartResolvedDetail');
 if(!type||!count||!detail)return;
 try{
  const spec=document.getElementById('chartCategoryPick')?manualChartSpec():quickChartSpec(),chart=chartSlideFromSpec(spec).chart;
  const names={line:'折線圖',bar:'橫條圖',column:'柱狀圖',doughnut:'圓環圖',content:'內容結構圖'};
  type.textContent=names[chart.type];count.textContent=(chart.labels||chart.items||[]).length+' 個項目';
  detail.textContent=chart.type==='content'?'依本頁內容整理，不含推估數值。':'實際分類：'+(chart.category||'本頁項目')+'｜指標：'+chart.series.map(s=>s.name).join('、')+(chart.aggregated?'。重複分類先彙整，再依設定取用。':'。依目前設定產生。')+(chart.type!==spec.type?' 所選圖型不適用，將改用'+names[chart.type]+'。':'');
 }catch(e){type.textContent='請調整設定';count.textContent='尚無可用結果';detail.textContent=e.message;}
}

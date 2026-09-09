async function genOutline(){
  if(!S.topic.trim()) return fail('先填簡報主題才能生成大綱。');
  toast(S.economy?'生成中':'規劃大綱中');
  try{
    const st=curStyle();
    const pageGuide=Number(S.pages)>0
      ? `正好 ${Math.trunc(Number(S.pages))} 頁（含封面與結尾）`
      : `依內容自動判斷，建議約 ${autoPageRecommendation()} 頁；每頁只講一個主要訊息`;
    const cap = S.economy?900:400;
    const digest = S.materials.length
      ? S.materials.map(m=>'【'+m.name+'】'+m.text.slice(0,cap)).join('\n').slice(0,S.economy?3200:1600)
      : '（沒有提供素材，請依主題本身的常識撰寫）';
    const sys='你是簡報架構師。只輸出 JSON 陣列，不要任何說明文字、不要 markdown 圍籬、不要註解。';

    const prompt = S.economy ?
`一次產出完整簡報內容。

主題：${S.topic}
對象：${S.audience}
頁數：${pageGuide}
語氣：${S.tone}
風格提示：${st.prompt}
參考素材：
${digest}

輸出 JSON 陣列，每頁一個物件，依 layout 帶對應欄位：
- {"layout":"cover","title":"","subtitle":"","note":""}
- {"layout":"agenda"|"bullets"|"closing","title":"","bullets":[{"h":"要點","d":"補充"}],"note":""}
- {"layout":"twoCol","title":"","columns":[{"h":"","items":["","",""]},{"h":"","items":["","",""]}],"note":""}
- {"layout":"stat","title":"","stat":{"value":"數字或短詞","label":"說明"},"note":""}
- {"layout":"quote","title":"","quote":{"text":"","by":""},"note":""}

規則：
- 第一頁必為 cover，最後一頁必為 closing
- 中間至少出現一次 stat 或 twoCol，其餘用 bullets
- title 不超過 20 字，h 不超過 16 字，d 不超過 26 字，note 不超過 30 字
- bullets 每頁 3 至 4 個，內容要具體，不要空話
- 全部使用繁體中文，只輸出 JSON 陣列` :

`為以下需求規劃簡報大綱骨架。

主題：${S.topic}
對象：${S.audience}
頁數：${pageGuide}
語氣：${S.tone}
風格提示：${st.prompt}
參考素材：
${digest}

輸出 JSON 陣列，每個元素代表一頁：
{"layout":"cover|agenda|bullets|twoCol|stat|quote|closing","title":"標題","subtitle":"僅封面用","bullets":[{"h":"要點","d":"補充"}],"note":"講稿一句"}

規則：
- 第一頁 layout 必為 cover，最後一頁必為 closing
- 中間至少出現一次 stat 或 twoCol
- title 不超過 20 字，h 不超過 16 字，d 不超過 26 字，note 不超過 30 字
- bullets 每頁 3 至 4 個
- 全部使用繁體中文，只輸出 JSON`;

    const arr = parseJSON(await ask(sys,prompt));
    if(!Array.isArray(arr)||!arr.length) throw new Error('模型沒有回傳可用的頁面，請再試一次。');
    S.slides = prepareGeneratedSlides(arr.map(x=>{
      const s = normalize(x);
      if(S.economy) s.status='generated';
      return s;
    }));
    S.cursor=0; S.view='editor'; S.tab='outline'; saveDraft(); done();
  }catch(e){ fail(e.message); }
}

async function genFromBrief(){
  const raw = sourceMaterial(12000).trim();
  if(!raw) return fail('先貼上內容或說一句你想做什麼簡報。');
  toast('生成中');
  try{
    // 貼的內容夠長就順手存成素材，之後單頁重生時可以檢索
    if(raw.length>800 && !S.materials.some(m=>m.text===raw)){
      S.materials.push({id:uid(),name:'貼上的內容',text:raw});
    }
    const hint = [
      S.audience?('對象：'+S.audience):'',
      S.tone?('語氣：'+S.tone):'',
      S.pages?('頁數：正好 '+S.pages+' 頁'):('頁數：依內容自動判斷，建議約 '+autoPageRecommendation()+' 頁'),
      S.adv?('指定風格：'+curStyle().name):''
    ].filter(Boolean).join('\n');

    const styleList = S.styles.map(s=>s.id+'（'+s.name+'：'+s.desc+'）').join('、');
    const sys='你是簡報架構師。只輸出一個 JSON 物件，不要任何說明文字、不要 markdown 圍籬。';
    const prompt =
`以下是使用者提供的內容。它可能是一句需求、一段會議記錄、一份文件、或一段講稿。
請自己判斷該做成什麼簡報，然後直接產出完整內容。

===== 使用者內容開始 =====
${raw.slice(0,12000)}
===== 使用者內容結束 =====

[資料使用規則]
${sourcePolicyText()}
所有具體事實、數值與比較都只能來自上面的來源；不要補造資料。講稿 note 要保留可辨識的來源檔名，PPTX 來源可用時也要標示投影片頁碼。

${hint?('使用者另外指定了：\n'+hint+'\n'):'頁數請自己判斷，一般 6 到 10 頁；對象與語氣也請從內容推斷。\n'}
可選風格：${styleList}

輸出這個 JSON 物件：
{"meta":{"topic":"簡報主題","audience":"聽眾","tone":"語氣","styleId":"從可選風格挑一個最合適的 id"},
 "slides":[ 每頁一個物件 ]}

每頁依 layout 帶對應欄位：
- {"layout":"cover","title":"","subtitle":"","note":""}
- {"layout":"agenda"|"bullets"|"closing","title":"","bullets":[{"h":"要點","d":"補充"}],"note":""}
- {"layout":"twoCol","title":"","columns":[{"h":"","items":["","",""]},{"h":"","items":["","",""]}],"note":""}
- {"layout":"stat","title":"","stat":{"value":"數字或短詞","label":"說明"},"note":""}
- {"layout":"quote","title":"","quote":{"text":"","by":""},"note":""}

規則：
- 第一頁必為 cover，最後一頁必為 closing
- 內容有數據就用 stat，有對照關係就用 twoCol，其餘用 bullets
- title 不超過 20 字，h 不超過 16 字，d 不超過 26 字，note 不超過 30 字
- bullets 每頁 3 至 4 個，要寫使用者內容裡真正有的東西，不要填空話
- 全部使用繁體中文，只輸出 JSON`;

    const o = parseJSON(await ask(sys,prompt));
    const arr = Array.isArray(o) ? o : (o.slides||[]);
    if(!arr.length) throw new Error('模型沒有回傳可用的頁面，請再試一次。');
    const meta = o.meta||{};
    if(meta.topic) S.topic=meta.topic;
    else S.topic = clipText(raw.replace(/\n/g,' '),24);
    if(meta.audience) S.audience=meta.audience;
    if(meta.tone) S.tone=meta.tone;
    if(!S.adv && meta.styleId && S.styles.some(s=>s.id===meta.styleId)){
      S.styleId=meta.styleId; LS.set('styleId',S.styleId);
    }
    S.slides = attachSourceNotes(prepareGeneratedSlides(arr.map(x=>{ const s=normalize(x); s.status='generated'; return s; })));
    S.cursor=0; S.view='editor'; S.tab='outline'; saveDraft(); done();
  }catch(e){ fail(e.message); }
}

function structuredTableEvidence(limit){
  limit=Math.max(4000,Number(limit)||15000);
  const tables=availableTables(); if(!tables.length) return '';
  const each=Math.max(1500,Math.floor(limit/tables.length)), blocks=[];
  window.__tableSampled=false;
  tables.forEach(t=>{
    const head=`【結構化資料表：${t.title}｜原始 ${Number(t.totalRows)||(t.rows||[]).length} 列】`;
    const cols=(t.headers||[]).join(' | ');
    const lines=(t.rows||[]).map(r=>r.join(' | '));
    const budget=Math.max(0,each-head.length-cols.length-2);
    const avg=lines.length?Math.max(1,Math.ceil(lines.reduce((n,l)=>n+l.length+1,0)/lines.length)):1;
    const fit=Math.max(1,Math.floor(budget/avg));
    let take=lines, note='';
    if(lines.length>fit){
      /* 超過長度預算時等距取樣，而不是只取開頭幾列——只取開頭會讓排序在後面的
         縣市完全不出現，模型就算不出排名。取樣後必須明講，避免被當成完整資料。 */
      const step=lines.length/fit; take=[];
      for(let i=0;i<fit;i++) take.push(lines[Math.floor(i*step)]);
      note=`（因提示長度限制，本表自 ${lines.length} 列中等距抽出 ${take.length} 列；未列出的列不得視為 0，`+
           `凡需要完整清單才能得出的排名或合計，請改用上方系統已計算的統計值，或標示「資料待補」。）`;
      window.__tableSampled=true;
    }
    blocks.push([head,cols,...take,note].filter(Boolean).join('\n'));
  });
  return blocks.join('\n\n').slice(0,limit);
}

function dropDuplicateTableRows(text, evidence){
  const src=String(text||''); if(!src||!evidence) return src;
  const rows=new Set(String(evidence).split('\n').map(l=>l.trim()).filter(l=>l.includes(' | ')));
  if(!rows.size) return src;
  let removed=0, marked=false; const out=[];
  src.split('\n').forEach(line=>{
    if(rows.has(line.trim())){
      removed++;
      if(!marked){ out.push('（本表逐列原值見下方［結構化表格原值］，此處不重覆列出）'); marked=true; }
      return;
    }
    if(!line.includes(' | ')) marked=false;
    out.push(line);
  });
  if(!removed) return src;
  return out.join('\n').replace(/\n?（僅列出前 \d+ 列）/g,'').replace(/\n{3,}/g,'\n\n');
}

function buildPrompt(){
  const tables=structuredTableEvidence(18000);
  const computed=monthlyScenarioEvidence();
  const raw=dropDuplicateTableRows(sourceMaterial(30000),tables).trim();
  const ruleValues=rulesObj(), fixedPages=Number(ruleValues.pages)>0?Math.trunc(Number(ruleValues.pages)):0;
  const recommendedPages=autoPageRecommendation();
  const rules=effectiveRulesText(ruleValues).trim();
  const plan=S.plan?('\n[頁面規劃]\n'+S.plan+'\n'):'';
  const sc=currentScenario(), requirements=sc&&sc.requirements?('\n'+sc.requirements+'\n'):'';
  const coverRule=sc&&sc.includeCover
    ? '第一頁必須是封面，而且封面計入總頁數；封面之後仍要完整保留全部必要分析主題群。不得額外加入目錄或結尾頁。'
    : '不得額外加入未要求的封面、目錄或結尾頁。';
  const scenarioPageGuidance=sc&&S.scenario!=='own'
    ? (fixedPages
      ? `\n[課堂大綱與目前頁數的合併規則]\n課堂原始分析順序為 ${sc.pages} 頁（視為 ${sc.pages} 個必要主題群），目前使用者明確指定 ${fixedPages} 頁。`+
        `請保留全部主題與先後邏輯，依內容量拆分或合併成恰好 ${fixedPages} 頁，不得省略必要分析。${coverRule}\n`
      : `\n[課堂大綱與自動分頁規則]\n下方「第 1 頁～第 ${sc.pages} 頁」代表 ${sc.pages} 個必要分析主題群，不是固定只能輸出 ${sc.pages} 張。`+
        `請依素材與表格內容將密集主題拆頁，目前建議約 ${recommendedPages} 頁；每頁只呈現一個主要訊息，不得靠縮小字體塞入內容。${coverRule}\n`)
    : (!fixedPages?`\n[自動分頁規則]\n請依內容量分頁，目前建議約 ${recommendedPages} 頁；每頁只呈現一個主要訊息，不得靠縮小字體塞入內容。\n`:'' );
  const templateInstruction=sc&&sc.templateSuggested
    ? `\n[樣板與輸出規則]\n${S.pptTemplate
      ? `已上傳 PPTX 樣板「${S.pptTemplate.name}」。請控制每頁文字量，讓內容能放入原母片預留位置；網站匯出時會沿用母片、背景、Logo、頁尾、字型與配色。`
      : `尚未上傳 PPTX 樣板。雲端連結無法提供母片、背景與字型；若要真正套用 ${sc.expectedTemplate}，必須在步驟五上傳原始 .pptx。`}
輸出檔名：${sc.outputName||'簡報.pptx'}。圖表必須使用來源中的真實數值，並保持可編輯。\n`
    : '';
  /* 缺件時明確告訴模型「缺哪些、哪幾頁」，避免它自行補造資料 */
  const miss=missingPageNote();
  const gap=miss?`\n[本次缺少的來源｜不得自行補造]\n未上傳：${miss.labels.join('、')}\n`+
    `第 ${miss.pages.join('、')} 個必要主題群有部分內容依賴上述來源。仍必須使用已提供來源與［系統完整計算結果］中可得的數值；`+
    `不得因同一頁另有缺件，就把整頁所有欄位都寫成資料待補。只有確實無法由現有來源得到的欄位才寫「資料待補」，並在該頁「備註：」說明缺少哪一份來源。\n`:'';
  return `${rules}

[輸出格式] 請嚴格以下列 Markdown 格式輸出，每一頁一個區塊，不要加任何其他說明文字：

# 頁標題
> 核心結論
- 條列一
- 條列二
- 條列三
備註：資料時點或限制；需口頭補充的內容
${sc&&sc.includeCover?'\n封面格式：第一個區塊只寫「# 簡報主題」、「> 副標」與「備註：」，不要在封面放條列。\n':''}
${plan}${requirements}${scenarioPageGuidance}${templateInstruction}${gap}
[系統完整計算結果] 以下數值由瀏覽器讀取完整 Excel 後計算，優先於抽樣列；有結果的欄位必須直接使用，不得再寫「資料待補」：
${computed.text||'（本情境沒有可用的系統計算結果）'}

[素材] 以下是要做成簡報的內容：
${raw||'（請先在平台的輸入框貼上素材，再回來按一次「產生指令」）'}
${tables?`\n[結構化表格原值]\n${tables}\n`:''}

[資料使用規則]
${sourcePolicyText()}
- 只引用上面實際提供的內容，不得虛構數字、政策、成效或因果。
- 頁面規劃必須保留全部分析主題與先後邏輯，並符合「頁數規範」；${sc&&sc.includeCover?'第一頁必須是封面且計入總頁數，不得自行增加目錄或結尾頁。':'不得自行增加未要求的封面、目錄或結尾頁。'}
- 每頁都要輸出一行「備註：」，說明資料時點、限制或需口頭補充處；不要把備註混入畫面條列。
- 不必在 Markdown 自行列 [Sources]；網站會依上傳檔名與來源投影片頁碼加入 PowerPoint 講稿。`;
}

function parseMarkdownDeck(text){
  let t=String(text).replace(/\r/g,'').trim();
  if(!t) throw new Error('內容是空的，請先把 AI 的回覆貼進來。');

  if(/^[\[{]/.test(t)){
    try{
      const o=parseJSON(t); const arr=Array.isArray(o)?o:(o.slides||[]);
      if(arr.length) return arr.map(x=>normalize(x));
    }catch(e){ /* 不是 JSON 就繼續走 Markdown */ }
  }

  t = t.replace(/<think>[\s\S]*?<\/think>/gi,'')      // 推理模型的思考段
       .replace(/^\s*```[a-z]*\s*$/gim,'')            // 程式碼圍籬
       .replace(/^[＃#]/gm,'#')                        // 全形井號
       .replace(/^[　\t]+/gm,'')                       // 全形空白縮排
       .replace(/^[－—–]\s*/gm,'- ');                  // 各種破折號當條列

  const heading = L =>{
    let m;
    if((m=L.match(/^#{1,6}\s*(.+?)\s*$/))) return m[1];
    if((m=L.match(/^\*\*(.+?)\*\*\s*[：:]?\s*$/))) return m[1];          // 只有粗體的一行
    if((m=L.match(/^(?:第\s*\d+\s*頁|投影片\s*\d+|頁\s*\d+|Slide\s*\d+)\s*[：:．.、\-]?\s*(.*)$/i)))
      return m[1]||L.trim();                                             // 第 1 頁：xxx
    return null;
  };
  const kicker = L =>{
    let m;
    if((m=L.match(/^[>＞]\s*(.+?)\s*$/))) return m[1];
    if((m=L.match(/^\**(?:核心結論|重點結論|結論|一句話)\**\s*[：:]\s*(.+?)\s*$/))) return m[1];
    return null;
  };
  const bullet = L =>{
    let m;
    if((m=L.match(/^[-*•‧·+◦▪]\s*(.+?)\s*$/))) return m[1];
    if((m=L.match(/^\d+\s*[.、)）]\s*(.+?)\s*$/))) return m[1];
    return null;
  };
  const noteLine = L =>{
    const m=String(L).match(/^\**(?:備註|講稿|Speaker\s*notes?)\**\s*[：:]\s*(.+?)\s*$/i);
    return m?m[1]:null;
  };
  const clean = s => String(s).replace(/\*\*/g,'').replace(/^\s*[:：]\s*/,'').trim();
  // AI 常在最後加一句客套話，不要把它當成條列
  const CLOSER=/^(希望|以上|如需|如果需要|需要我|請問|讓我知道|有任何|祝|Hope|Let me know|Feel free)/;

  const lines=t.split('\n');
  const slides=[]; let cur=null;
  lines.forEach(L=>{
    if(!L.trim()) return;
    const h=heading(L);
    if(h!==null && clean(h)){ cur={title:clean(h),kicker:'',bullets:[],note:''}; slides.push(cur); return; }
    if(!cur) return;
    const k=kicker(L);
    if(k!==null && !cur.kicker){ cur.kicker=clean(k); return; }
    const n=noteLine(L);
    if(n!==null){ cur.note=[cur.note,clean(n)].filter(Boolean).join('\n'); return; }
    const b=bullet(L);
    if(b!==null && clean(b)){ cur.bullets.push(clean(b)); return; }
    // 沒有符號的普通句子：短的當結論，長的當一條要點
    const plain=clean(L);
    if(!plain || CLOSER.test(plain)) return;
    if(!cur.kicker && plain.length<=30 && !cur.bullets.length) cur.kicker=plain;
    else cur.bullets.push(plain);
  });

  // 完全沒抓到標題時，用空行分段當作分頁
  if(!slides.length){
    t.split(/\n{2,}/).forEach(block=>{
      const ls=block.split('\n').map(x=>x.trim()).filter(Boolean);
      if(!ls.length) return;
      const s={title:clipText(clean(ls[0]),40),kicker:'',bullets:[],note:''};
      ls.slice(1).forEach(L=>{ const b=bullet(L); s.bullets.push(clean(b!==null?b:L)); });
      slides.push(s);
    });
  }
  if(!slides.length){
    throw new Error('看不出來哪裡分頁。每頁的標題用 # 開頭，或用「第 1 頁：」開頭，也可以每頁之間空一行。');
  }

  return slides.map((x,i)=>{
    // 只有在不會弄丟內容時才套用封面／結尾版型
    const isFirst=i===0, isLast=i===slides.length-1 && slides.length>1;
    let layout='bullets';
    if(isFirst && !x.bullets.length) layout='cover';
    else if(isLast && x.bullets.length<=3) layout='closing';
    const s=normalize({
      layout, title:x.title,
      subtitle: layout==='cover'?x.kicker:'',
      bullets:x.bullets.map(one=>{
        const m=one.match(/^(.{2,18}?)[：:]\s*(.+)$/) || one.match(/^(.{4,16}?)[，、]\s*(.{6,})$/);
        return m?{h:m[1],d:m[2]}:{h:one,d:''};
      })
    });
    s.kicker = layout==='cover'?'':x.kicker;
    s.note = x.note||x.kicker||'';
    s.status='generated';
    return s;
  });
}

function ensureRequiredCover(slides){
  const input=Array.isArray(slides)?slides.slice():[], sc=currentScenario();
  if(sc&&sc.includeCover===false) return input;
  const at=input.findIndex(s=>s&&s.layout==='cover');
  if(at===0){ input[0].sourceGroup=0; return input; }
  if(at>0){ const cover=input.splice(at,1)[0]; cover.sourceGroup=0; return [cover,...input]; }
  const cover=normalize({layout:'cover',title:S.topic||(sc&&sc.topic)||(input[0]&&input[0].title)||'未命名簡報',
    subtitle:(sc&&sc.coverSubtitle)||[S.audience,today()].filter(Boolean).join('｜'),
    note:'封面；匯出時優先套用上傳母片辨識到的封面版面。'});
  cover.status='generated'; cover.sourceGroup=0; cover.autoCover=true;
  return [cover,...input];
}

function prepareGeneratedSlides(slides){
  const hadCover=Array.isArray(slides)&&slides.some(s=>s&&s.layout==='cover');
  const out=expandSlidesByContent(ensureRequiredCover(slides));
  const target=Math.max(0,Math.trunc(Number(rulesObj().pages)||Number(S.pages)||0));
  /* 舊草稿原本已達指定頁數、現在才補封面時，優先把同一主題群的相鄰續頁
     安全合併回去；只有 4 點、190 字內才合併，避免為了頁數重新造成擠字。 */
  if(!hadCover&&target>0){
    while(out.length>target){
      let at=-1;
      for(let i=1;i<out.length-1;i++){
        const a=out[i],b=out[i+1], items=[...(a.bullets||[]),...(b.bullets||[])];
        const chars=items.reduce((n,x)=>n+String(x&&x.h||'').length+String(x&&x.d||'').length,0);
        if(Number(a.sourceGroup)>0&&a.sourceGroup===b.sourceGroup&&
          ['bullets','agenda','closing'].includes(a.layout)&&['bullets','agenda','closing'].includes(b.layout)&&
          items.length<=4&&chars<=190){ at=i; break; }
      }
      if(at<0) break;
      const a=out[at],b=out[at+1];
      a.layout='bullets'; a.bullets=[...(a.bullets||[]),...(b.bullets||[])];
      a.note=[a.note,b.note].filter((v,i,x)=>v&&x.indexOf(v)===i).join('\n');
      a.autoSplit=false; out.splice(at+1,1);
    }
  }
  return out;
}

function expandSlidesByContent(slides){
  const input=Array.isArray(slides)?slides:[];
  const target=Math.max(0,Math.trunc(Number(rulesObj().pages)||Number(S.pages)||0));
  /* 明確指定頁數時，若 AI 回得太少，只拆分既有條列直到指定頁數；
     不複製內容、不新增空話。若原始內容不足以拆到目標，保留實際可用頁數。 */
  if(target>0){
    const fixed=input.map((s,i)=>Object.assign(JSON.parse(JSON.stringify(s||{})),{
      sourceGroup:Number.isFinite(Number(s&&s.sourceGroup))?Number(s.sourceGroup):i+1}));
    while(fixed.length<target){
      let at=-1, score=1;
      fixed.forEach((s,i)=>{
        const n=['bullets','agenda','closing'].includes(s.layout)?(s.bullets||[]).length:0;
        if(n>score){score=n;at=i;}
      });
      if(at<0) break;
      const original=fixed[at], items=original.bullets||[], cut=Math.ceil(items.length/2);
      const first=Object.assign({},original,{bullets:items.slice(0,cut)});
      const second=Object.assign({},original,{id:uid(),layout:original.layout==='closing'?'bullets':original.layout,
        title:`${String(original.title||'未命名').replace(/（續 \d+）$/,'')}（續 2）`,bullets:items.slice(cut),autoSplit:true,
        note:[original.note,`由原始第 ${original.sourceGroup} 個主題群拆頁，以符合指定頁數並避免文字擠壓。`].filter(Boolean).join('\n')});
      first.autoSplit=true; fixed.splice(at,1,first,second);
    }
    const totals={},seen={},roots={};
    fixed.forEach(s=>{ const g=s.sourceGroup; totals[g]=(totals[g]||0)+1; roots[g]=roots[g]||String(s.title||'未命名').replace(/（續 \d+）$/,''); });
    fixed.forEach(s=>{ const g=s.sourceGroup; seen[g]=(seen[g]||0)+1; if(totals[g]>1) s.title=roots[g]+(seen[g]>1?`（續 ${seen[g]}）`:''); });
    return fixed;
  }
  const out=[];
  input.forEach((original,groupIndex)=>{
    const base=JSON.parse(JSON.stringify(original||{}));
    const group=Number.isFinite(Number(base.sourceGroup))?Number(base.sourceGroup):groupIndex+1;
    const add=(slide,part,total)=>{
      slide.id=part===0?(slide.id||uid()):uid();
      slide.sourceGroup=group;
      if(part>0) slide.title=`${base.title||'未命名'}（續 ${part+1}）`;
      if(part>0 && slide.kicker) slide.kicker=`延續前頁：${slide.kicker}`;
      if(part>0) slide.note=[slide.note,`本頁由原始第 ${group} 個主題群自動拆頁，避免文字擠壓。`].filter(Boolean).join('\n');
      slide.autoSplit=total>1;
      out.push(slide);
    };
    if(['bullets','agenda','closing'].includes(base.layout) && (base.bullets||[]).length>5){
      const chunks=[];
      for(let i=0;i<base.bullets.length;i+=5) chunks.push(base.bullets.slice(i,i+5));
      chunks.forEach((items,i)=>add(Object.assign({},base,{layout:i===0?base.layout:'bullets',bullets:items}),i,chunks.length));
      return;
    }
    if(base.layout==='twoCol' && Array.isArray(base.columns)){
      const max=Math.max(0,...base.columns.map(c=>(c.items||[]).length));
      const pages=Math.max(1,Math.ceil(max/5));
      for(let i=0;i<pages;i++) add(Object.assign({},base,{columns:base.columns.map(c=>Object.assign({},c,{items:(c.items||[]).slice(i*5,i*5+5)}))}),i,pages);
      return;
    }
    base.sourceGroup=group; out.push(base);
  });
  return out;
}

// Only regroup pages carrying automatic-split provenance; unrelated topics remain separate.
function regroupFiveItemPages(slides){
  const grouped=[];
  for(const item of slides||[]){
    const s=JSON.parse(JSON.stringify(item)),prev=grouped[grouped.length-1];
    const root=x=>String(x.title||'').replace(/（續 \d+）$/,'');
    const sameOrigin=prev&&((s.exportOrigin&&s.exportOrigin===prev.exportOrigin)||
      (s.autoSplit&&prev.autoSplit&&s.sourceGroup!=null&&s.sourceGroup===prev.sourceGroup));
    if(sameOrigin&&root(prev)===root(s)&&['bullets','agenda','closing'].includes(prev.layout)&&s.layout==='bullets'){
      prev.title=root(prev);
      prev.bullets=(prev.bullets||[]).concat(s.bullets||[]);
      prev.note=[...new Set([prev.note,s.note].filter(Boolean))].join('\n');
    }else grouped.push(s);
  }
  return grouped;
}

function previewParse(text){
  try{
    const s=prepareGeneratedSlides(parseMarkdownDeck(text));
    const empty=s.every(x=>!x.bullets.length);
    return {ok:true, thin: s.length<2 && empty, n:s.length, titles:s.slice(0,3).map(x=>x.title)};
  }
  catch(e){ return {ok:false,msg:e.message}; }
}

function importPasted(){
  const el=document.getElementById('pasteBack');
  const txt=el?el.value:'';
  if(!txt.trim()) return fail('請先把 AI 產生的內容貼進下面的框。');
  if(S.wizard){
    S.md=mergeMonthlyComputedPages(txt.trim());
    const parsed=previewParse(S.md);
    if(!parsed.ok||parsed.thin) return fail(parsed.ok?'內容只解析到一頁且沒有條列，請補齊後再匯入。':parsed.msg);
    S.outlineBasis=wizardBasis(); S.modal=null; S.err=null; S.step=4; S.maxStep=Math.max(S.maxStep,4); saveDraft(); render(); return;
  }
  try{
    const slides=prepareGeneratedSlides(parseMarkdownDeck(txt));
    if(!S.topic) S.topic=slides[0].title||'未命名簡報';
    slides.forEach(s=>s.footer=clipText(S.topic||'',24));
    S.slides=attachSourceNotes(markMissingDataPages(slides)); S.cursor=0;
    S.modal=null; S.err=null; S.view='editor'; S.tab='outline'; saveDraft(); render();
  }catch(e){ fail(e.message); }
}

function genLocal(){
  const t = clipText((S.topic||S.brief||'').replace(/\n/g,' '),40) || '未命名簡報';
  S.topic = t;
  const n = Math.max(PAGE_MIN,Math.trunc(Number(S.pages)||7));
  const mid=['現況與問題','做法與方案','關鍵取捨','實際成果','風險與限制','時程與分工','後續規劃'];
  const out=[normalize({layout:'cover',title:t,subtitle:(S.audience?S.audience+'　·　':'')+today(),note:'開場，說明今天要解決什麼問題'})];
  if(n>=3) out.push(normalize({layout:'agenda',title:'今天談三件事',
    bullets:[{h:'我們遇到的問題',d:'先對齊現況'},{h:'打算怎麼做',d:'方案與取捨'},{h:'需要什麼決定',d:'今天要拍板的事'}],
    note:'把聽眾的期待先框好'}));
  for(let i=0;i<n-(n>=3?3:2);i++){
    const title=mid[i%mid.length];
    out.push(normalize({layout: i===1?'twoCol': i===2?'stat':'bullets', title:title,
      bullets:[{h:'要點一',d:'補充說明'},{h:'要點二',d:'補充說明'},{h:'要點三',d:'補充說明'}],
      columns:[{h:'方案 A',items:['優點','成本','風險']},{h:'方案 B',items:['優點','成本','風險']}],
      stat:{value:'00%',label:'把最有說服力的一個數字放這裡'},
      note:'這頁想讓聽眾記住什麼'}));
  }
  out.push(normalize({layout:'closing',title:'我們建議這樣做',
    bullets:[{h:'下一步',d:'誰、做什麼、什麼時候'}],note:'收尾，明確提出要對方做的決定'}));
  S.slides=out.slice(0,n); S.cursor=0; S.view='editor'; S.tab='outline'; saveDraft(); render();
}

function normalize(x){
  return {
    id:uid(), layout: LAYOUTS[x.layout]?x.layout:'bullets',
    title:x.title||'未命名', subtitle:x.subtitle||'', kicker:x.kicker||'',
    bullets: Array.isArray(x.bullets)? x.bullets.map(b=> typeof b==='string'?{h:b,d:''}:{h:b.h||'',d:b.d||''}) : [],
    columns:x.columns||null, stat:x.stat||null,
    chart:x.chart?Object.assign({},x.chart,{styleId:x.chart.styleId||S.chartStyleDefault||'auto'}):null,
    chartSource:x.chartSource||null, quote:x.quote||null,
    textStyle:x.textStyle||null,
    note:x.note||'', footer:clipText(S.topic||'',24), status:'draft', history:[]
  };
}

async function genOne(i,silent){
  const s=S.slides[i]; if(!s) return;
  if(!silent) toast('重新生成第 '+(i+1)+' 頁');
  const st=curStyle();
  const hits = retrieve(allChunks(), s.title+' '+(s.bullets||[]).map(b=>b.h).join(' '));
  const sys='你是簡報內容編輯。只輸出單一 JSON 物件，不要任何說明或 markdown 圍籬。';
  const prompt =
`為這一頁補完內容。

簡報主題：${S.topic}｜對象：${S.audience}｜語氣：${S.tone}
風格提示：${st.prompt}

目前這頁：
${JSON.stringify({layout:s.layout,title:s.title,bullets:s.bullets,subtitle:s.subtitle})}

可用素材：
${hits.length? hits.map(h=>'['+h.src+'] '+h.text.slice(0,300)).join('\n') : '（無，請依主題常識撰寫）'}

依 layout 輸出對應欄位的 JSON 物件：
- cover：title、subtitle
- agenda / bullets / closing：title、bullets（3–4 個 {h,d}）
- twoCol：title、columns（兩個 {h, items:[3個字串]}）
- stat：title、stat {value,label}，value 是數字或短詞
- quote：quote {text,by}
所有版型都要有 note（講稿一句，30 字內）。
繁體中文，h 不超過 16 字，d 不超過 26 字。只輸出 JSON。`;
  const o = parseJSON(await ask(sys,prompt));
  pushHistory(i);
  if(o.title) s.title=o.title;
  if(o.subtitle) s.subtitle=o.subtitle;
  if(Array.isArray(o.bullets)) s.bullets=o.bullets.map(b=> typeof b==='string'?{h:b,d:''}:{h:b.h||'',d:b.d||''});
  if(o.columns) s.columns=o.columns;
  if(o.stat) s.stat=o.stat;
  if(o.quote) s.quote=o.quote;
  if(o.note) s.note=o.note;
  s.status='generated'; saveDraft();
  if(!silent) done();
}

async function genAll(){
  for(let i=0;i<S.slides.length;i++){
    toast('第 '+(i+1)+' / '+S.slides.length+' 頁');
    try{ await genOne(i,true); }catch(e){ return fail(e.message); }
    render();
  }
  done();
}

async function reviseOne(){
  if(!S.instruction.trim()) return;
  const i=S.cursor, s=S.slides[i];
  toast('修改中');
  try{
    const sys='你是簡報編輯。依指令改寫這一頁，只輸出單一 JSON 物件，保持相同欄位結構。';
    const prompt =
`這一頁目前是：
${JSON.stringify({layout:s.layout,title:s.title,subtitle:s.subtitle,bullets:s.bullets,columns:s.columns,stat:s.stat,quote:s.quote,note:s.note})}

修改指令：${S.instruction}

保持 layout 不變（除非指令明確要求換版型，可選 ${Object.keys(LAYOUTS).join('/')}）。繁體中文，只輸出 JSON。`;
    const o = parseJSON(await ask(sys,prompt));
    pushHistory(i);
    ['title','subtitle','note','stat','quote','columns'].forEach(k=>{ if(o[k]) s[k]=o[k]; });
    if(o.layout && LAYOUTS[o.layout]) s.layout=o.layout;
    if(Array.isArray(o.bullets)) s.bullets=o.bullets.map(b=> typeof b==='string'?{h:b,d:''}:{h:b.h||'',d:b.d||''});
    s.status='edited'; S.instruction=''; saveDraft(); done();
  }catch(e){ fail(e.message); }
}

async function createStyle(descText){
  if(!descText.trim()) return;
  toast('調配風格中');
  try{
    const sys='你是簡報視覺設計師。只輸出單一 JSON 物件，不要說明文字。';
    const o = parseJSON(await ask(sys,
`依這段描述設計一組簡報視覺系統：「${descText}」
簡報主題：${S.topic||'未指定'}
目標受眾：${S.audience||'一般聽眾'}

輸出：
{"name":"四字以內名稱","desc":"12字內說明","bg":"#hex 背景","surface":"#hex 卡片底","ink":"#hex 主文字","sub":"#hex 次文字","accent":"#hex 主重點色","accent2":"#hex 次重點色","rule":"#hex 線條","grid":false,"radius":0,"serif":false,"fontFamily":"sans|serif|mono","titleSize":35到58,"bodySize":16到24,"letterSpacing":-1到3,"lineSpacing":1.15到1.7,"prompt":"20字內的文案語氣指示"}

bg 與 ink 對比至少 4.5:1；以清楚、穩定、適合投影閱讀為優先，不使用過小文字。只輸出 JSON。`));
    addStyle(o, descText.slice(0,14));
  }catch(e){ fail(e.message); }
}

async function importStyle(file){
  try{
    let b64, media;
    if(/pdf$/i.test(file.name) || file.type==='application/pdf'){
      toast('讀取 PDF 首頁');
      const pdfjs = await loadPdfjs();
      const doc = await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
      const page = await doc.getPage(1), vp = page.getViewport({scale:1.6});
      const cv = document.createElement('canvas'); cv.width=vp.width; cv.height=vp.height;
      await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
      b64 = cv.toDataURL('image/jpeg',.85).split(',')[1]; media='image/jpeg';
    }else if(/^image\//.test(file.type)){
      b64 = await fileB64(file); media = file.type==='image/png'?'image/png':'image/jpeg';
    }else{
      return fail('風格匯入只支援 PDF 或圖片（PNG / JPG）。PPTX 請先另存成 PDF。');
    }
    toast('分析配色中');
    const sys='你是簡報視覺分析師。只輸出單一 JSON 物件，不要說明文字。';
    const o = parseJSON(await ask(sys,
`分析這張簡報畫面，抽取可重複使用的視覺風格。

輸出：
{"name":"四字以內名稱","desc":"12字內說明","bg":"#hex 背景","surface":"#hex 卡片底","ink":"#hex 主文字","sub":"#hex 次文字","accent":"#hex 主重點色","accent2":"#hex 次重點色","rule":"#hex 線條","grid":布林（是否有可見格線）,"radius":0-16,"serif":布林（標題是否襯線）,"fontFamily":"sans|serif|mono","titleSize":35到58,"bodySize":16到24,"letterSpacing":-1到3,"lineSpacing":1.15到1.7,"prompt":"20字內文案語氣指示"}

顏色與字體節奏請取畫面實際特徵；bg 與 ink 對比至少 4.5:1，不使用小於 16pt 的內文。只輸出 JSON。`, {media,b64}));
    addStyle(o, '來自 '+file.name.slice(0,12));
  }catch(e){ fail(e.message); }
}

function addStyle(o, fallbackDesc){
  const valid=(v,f)=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):f;
  const bg=valid(o.bg,'#101319'); let ink=valid(o.ink,'#F0F2F6');
  if(contrastRatio(bg,ink)<4.5) ink=contrastRatio(bg,'#FFFFFF')>=contrastRatio(bg,'#111111')?'#FFFFFF':'#111111';
  let sub=valid(o.sub,mix(bg,ink,.68));
  if(contrastRatio(bg,sub)<4.5) sub=mix(bg,ink,.85);
  if(contrastRatio(bg,sub)<4.5) sub=ink;
  const ns = {id:uid(), name:o.name||'自訂風格', desc:o.desc||fallbackDesc,
    bg, surface:valid(o.surface,mix(bg,ink,.08)), ink, sub,
    accent:valid(o.accent,'#FF3D7F'), accent2:valid(o.accent2,'#00C2CB'), rule:valid(o.rule,mix(bg,ink,.2)),
    grid:!!o.grid, radius:Math.max(0,Math.min(16,Number(o.radius)||0)), serif:!!o.serif,
    fontFamily:['sans','serif','mono'].includes(o.fontFamily)?o.fontFamily:(o.serif?'serif':'sans'),
    titleSize:Math.max(35,Math.min(58,Number(o.titleSize)||38)),bodySize:Math.max(16,Math.min(24,Number(o.bodySize)||18)),
    letterSpacing:Math.max(-1,Math.min(3,Number(o.letterSpacing)||0)),lineSpacing:Math.max(1.15,Math.min(1.7,Number(o.lineSpacing)||1.35)),
    prompt:o.prompt||'語氣自然、具體。'};
  S.styles=S.styles.concat([ns]); S.styleId=ns.id;
  saveCustom(); LS.set('styleId',ns.id); saveDraft(); done();
}

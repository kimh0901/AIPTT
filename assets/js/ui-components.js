function present(){
  const st=previewStyle(), wrap=document.getElementById('presentWrap');
  wrap.innerHTML = S.slides.map((s,i)=>
    `<div class="ps" data-i="${i}" style="width:1280px;height:720px;position:relative;display:none">${renderSlide(s,st,i,S.slides.length,false)}</div>`).join('');
  document.getElementById('present').classList.add('on');
  pIdx=S.cursor; pShow(pIdx); pFit();
}

function pShow(n){
  const els=document.querySelectorAll('.ps'); if(!els.length) return;
  pIdx=Math.max(0,Math.min(els.length-1,n));
  els.forEach((e,k)=>e.style.display = k===pIdx?'block':'none');
  document.getElementById('presentHud').textContent=(pIdx+1)+' / '+els.length+'　← → 翻頁　Esc 離開';
}

function pFit(){
  const s=Math.min(innerWidth/1280,innerHeight/720)*.95;
  document.getElementById('presentWrap').style.transform='scale('+s+')';
}

function pClose(){ document.getElementById('present').classList.remove('on'); S.cursor=pIdx; render(); }

function styleSwatch(s,removable){
  return `<div class="sw ${s.id===S.styleId?'on':''}">
    <button class="pick" data-act="style" data-id="${s.id}">
      <span style="width:40px;height:28px;border-radius:3px;background:${s.bg};border:1px solid ${s.rule};position:relative;flex:0 0 auto;overflow:hidden;display:block">
        <span style="position:absolute;left:5px;top:6px;width:20px;height:3px;background:${s.accent}"></span>
        <span style="position:absolute;left:5px;top:13px;width:26px;height:2px;background:${s.ink};opacity:.55"></span>
        <span style="position:absolute;left:5px;top:18px;width:16px;height:2px;background:${s.ink};opacity:.35"></span>
      </span>
      <span style="min-width:0"><span class="nm">${esc(s.name)}</span><span class="ds" style="display:block">${esc(s.desc)}</span></span>
    </button>
    ${removable?`<button class="del" data-act="delStyle" data-id="${s.id}" title="移除">×</button>`:''}
  </div>`;
}

function hexToRgb(h){ h=String(h).replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join('');
  return [parseInt(h.slice(0,2),16)||0, parseInt(h.slice(2,4),16)||0, parseInt(h.slice(4,6),16)||0]; }

function mix(a,b,t){ const A=hexToRgb(a),B=hexToRgb(b);
  return '#'+[0,1,2].map(i=>Math.round(A[i]+(B[i]-A[i])*t).toString(16).padStart(2,'0')).join(''); }

function contrastRatio(a,b){
  const lum=h=>{ const rgb=hexToRgb(h).map(v=>v/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)); return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]; };
  const A=lum(a),B=lum(b); return (Math.max(A,B)+.05)/(Math.min(A,B)+.05);
}

function templateTextIssues(s){
  if(!s||!S.pptTemplate)return [];
  const issues=[];
  const sink={notes:()=>{},rect:()=>{},roundRect:()=>{},chart:()=>{},text:(text,o)=>{
    if(!o.edit)return;
    const str=Array.isArray(text)?text.map(t=>t.text||'').join('\n'):String(text||'');
    if(!str.trim())return;
    const size=Number(o.fontSize)||18, em=size/72;
    const width=Math.max(.01,(o.w||0)-.04);
    const lines=str.split('\n').reduce((n,line)=>{
      let units=0;for(const ch of line)units+=/[\u2e80-\u9fff\uf900-\ufaff\uff00-\uff60]/.test(ch)?1:.6;
      return n+Math.max(1,Math.ceil(units*em/width));
    },0);
    const needed=lines*em*Math.max(1.24,Number(o.lineSpacingMultiple)||1.24);
    if(needed>(o.h||0)+.025)issues.push(`${o.edit==='title'?'標題':'文字區'}約需 ${needed.toFixed(2)} 英吋高，目前 ${(o.h||0).toFixed(2)} 英吋（${size} pt）`);
  }};
  try{addTemplateSlideContent(sink,s,0,templateLayoutFor(s.layout,s),curStyle(),null);}catch(e){issues.push('模板排版檢查未完成：'+(typeof addTemplateSlideContent!=='function'?'缺少 layout-safety.js，請完整解壓縮套件':e.message||String(e)));}
  return [...new Set(issues)];
}

function templateChoicePanel(s){
  if(!s)return '';
  const t=S.pptTemplate, issues=templateTextIssues(s);
  const thumbs=(t.designSlides||[]).map(d=>{
    const art=(d.preview||[]).map(p=>{
      const css=`position:absolute;left:${p.x/t.width*100}%;top:${p.y/t.height*100}%;width:${p.w/t.width*100}%;height:${p.h/t.height*100}%;`;
      return p.src?`<img alt="" src="${p.src}" style="${css}object-fit:contain">`:`<span style="${css}background:${esc(p.fill||'#eee')}"></span>`;
    }).join('');
    return `<button class="chip ${Number(s.designIndex)===d.index&&s.templateMode!=='master'?'on':''}" data-act="chooseTemplatePage" data-k="${d.index}" style="min-width:150px;text-align:left"><span style="display:block;position:relative;overflow:hidden;background:#fff;aspect-ratio:${t.width}/${t.height}">${art}</span>範例 ${d.index} · ${d.texts.length} 個文字區</button>`;
  }).join('');
  return `<div style="font-size:16px;line-height:1.6"><b>本頁套用方式</b><br><button class="chip ${s.templateMode==='master'?'on':''}" data-act="templateOriginal">使用原始母片版面</button>
    <details style="margin-top:8px"><summary>選擇範例頁設計（${(t.designSlides||[]).length} 頁）</summary><div class="hint">以下是裝飾與圖片的簡化預覽；文字及原生圖表不包含在縮圖內。選擇後保留本頁內容。</div><div style="display:flex;gap:8px;overflow:auto;padding:8px 0">${thumbs}</div></details>
    <div style="margin-top:8px;color:${issues.length?'#FFD993':'#82E8CC'}">${issues.length?'文字空間提醒：'+issues.map(esc).join('；'):'文字空間初步檢查通過；匯出仍需確認實際字型。'}</div>
    <button class="chip" data-act="previewSplit" style="margin-top:8px">依每頁 5 項重新整理</button><div class="hint">同主題的自動續頁會先合併，再依 1～5、6～10 項順序分頁；模板空間不足或單項過長時才再拆分。原始文字保留。</div></div>`;
}

function templateModeInfo(t){
  if(!t) return {label:'網站風格模式',detail:'目前沒有上傳 PowerPoint 版型，預覽與匯出使用已選擇的網站風格。'};
  if(t.structureMode==='master'&&t.canMergeMasters&&t.placeholderFit!==false)
    return {label:'完整母片模式',detail:'匯出時合併可安全使用的原始母片與版面配置，並保留 Logo、頁尾、主題色及字型。'};
  if(t.structureMode==='design')
    return {label:'範例投影片重建模式',detail:'依範例投影片的安全裝飾與留白重新排版，保留可辨識的品牌元素。'};
  if(t.structureMode==='designFallback')
    return {label:'相容重建模式',detail:'原始座標不適合直接套用，改用等比例安全版面並保留可辨識的背景、Logo、頁尾與配色。'};
  return {label:'主題配色安全模式',detail:'只套用可安全解析的尺寸、字型與配色，文字使用防跑版版面。'};
}

function templateBox(){
  const t=S.pptTemplate;
  if(!t) return `<div style="border:2px dashed var(--line);border-radius:10px;padding:16px;margin-bottom:16px">
    <div style="font-size:16px;font-weight:700;margin-bottom:5px">套用完整 PowerPoint 母片（選用）</div>
    <div class="hint" style="margin-bottom:10px">可以略過並使用網站風格。可嘗試上傳各類空白或範例 .pptx；系統會依檔案結構選擇完整母片、範例頁重建或主題配色模式，再依每頁內容量智慧配對，大綱內容不會被改寫。</div>
    <button class="btn full" data-act="upTemplate">選擇性上傳 PPTX 版型</button>
  </div>`;
  const colors=['dk1','lt1','accent1','accent2'].map(k=>t.colors&&t.colors[k]).filter(Boolean);
  const modeInfo=templateModeInfo(t), modeLabel=modeInfo.label;
  const needsCover=!!(currentScenario()&&currentScenario().includeCover&&!(S.slides||[]).some(s=>s&&s.layout==='cover'));
  const chartLibActive=!!(S.chartStyleLibrary&&t.chartStyleLibrary&&S.chartStyleLibrary.source===t.chartStyleLibrary.source);
  const chartCompatibility={recommended:'適合當圖表風格庫',available:'可擷取圖表風格',limited:'僅能擷取有限圖表特徵'}[t.chartStyleCompatibility]||'';
  const selects=Object.entries(LAYOUTS).map(([key,label])=>{
    const chosen=t.mapping[key]||'';
    return `<label style="display:grid;grid-template-columns:95px 1fr;gap:8px;align-items:center;font-size:14px;color:var(--mute)">
      <span>${esc(label)}</span><select data-template-map="${key}" style="min-height:38px;font-size:14px;padding:5px 8px">
        ${t.layouts.map(l=>`<option value="${esc(l.path)}" ${l.path===chosen?'selected':''}>${esc(l.name)} · ${esc(l.role)}</option>`).join('')}
      </select></label>`;
  }).join('');
  return `<div style="border:2px solid var(--cy);background:#0C2224;border-radius:10px;padding:16px;margin-bottom:16px">
    <div style="display:flex;gap:10px;align-items:flex-start">
      <div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:700;color:var(--cy);overflow:hidden;text-overflow:ellipsis">✓ 已載入版型：${esc(t.name)}</div>
        <div style="font-size:14px;color:var(--paper);margin-top:5px"><b>目前套用方式：${esc(modeLabel)}</b></div>
        <div class="hint" style="margin-top:3px">${esc(modeInfo.detail)}</div>
        <div class="hint">${t.layouts.length} 個版面配置 · ${t.width.toFixed(2)} × ${t.height.toFixed(2)} 英吋${t.fonts.major||t.fonts.minor?' · '+esc(t.fonts.major||t.fonts.minor):''}</div></div>
      <button class="btn sm" data-act="clearTemplate">移除</button>
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px">
      ${needsCover?`<button class="btn sm pri" data-act="addTemplateCover">補上母片封面</button>`:''}
      <button class="btn sm" data-act="refreshTplPreview">重新整理母片預覽</button>
      <button class="btn sm" data-act="autoTemplateAll">全部重新自動配版</button>
    </div>
    ${colors.length?`<div style="display:flex;gap:7px;margin:10px 0">${colors.map(c=>`<span title="${esc(c)}" style="width:24px;height:24px;border-radius:50%;background:${esc(c)};border:1px solid rgba(255,255,255,.35)"></span>`).join('')}</div>`:''}
    <details style="margin-top:10px"><summary style="cursor:pointer;font-size:14px;font-weight:700">檢查各頁類型使用的母片版面</summary>
      <div style="display:grid;gap:7px;margin-top:10px">${selects}</div></details>
    ${t.placeholderFit===false?`<div style="margin-top:10px;border-left:3px solid var(--warn);padding:8px 10px;font-size:13.5px;line-height:1.6;color:var(--warn)">
      這份母片的版面配置座標（最遠只到 ${'約 '+Math.round(t.width*0.5)} 英吋附近）與 ${t.width.toFixed(1)} × ${t.height.toFixed(1)} 英吋的投影片尺寸不符，常見於 Google Slides／Canva 匯出的檔案。已自動改用等比例版面，背景、Logo 與配色仍會保留。</div>`:''}
    ${t.skippedPromotional?`<div style="margin-top:10px;border-left:3px solid var(--warn);padding:8px 10px;font-size:13.5px;line-height:1.6;color:var(--warn)">已自動排除 ${t.skippedPromotional} 張 QR Code／素材網站宣傳頁，不會拿來當封面或結尾。</div>`:''}
    ${t.nativeCharts?`<div style="margin-top:10px;border-left:3px solid var(--mark);padding:8px 10px;font-size:13.5px;line-height:1.6;color:var(--paper)">
      <b>${esc(chartCompatibility)}</b>：偵測到 ${t.nativeCharts} 個原生圖表${t.embeddedBooks?'與 '+t.embeddedBooks+' 份內嵌 Excel':''}${t.designSlides&&t.designSlides.length?'，分布於 '+t.designSlides.length+' 張投影片':''}。<br>
      母片上傳只會處理版面、背景、Logo、頁尾與字型；<b>不會自動改動既有圖表</b>。若要使用這份檔案的圖表色盤與呈現方式，請另外啟用，範例數字不會帶入。
      <br>${chartLibActive
        ?`<button class="chip" data-act="goChartTab" style="margin-top:7px">✓ 圖表風格已另外啟用，前往設定</button>`
        :`<button class="chip" data-act="useTemplateChartStyle" style="margin-top:7px">另外啟用這份檔案的圖表風格</button>`}</div>`:''}
    ${!t.canMergeMasters?`<div style="margin-top:10px;border-left:3px solid var(--warn);padding:8px 10px;font-size:13.5px;line-height:1.6;color:var(--warn)">這份檔案缺少可安全合併的標準母片關聯，因此不強制套入損壞結構；系統改用範例頁設計或主題色，確保仍可預覽、編輯與匯出。</div>`:''}
    <div style="margin-top:10px;border-left:3px solid var(--cy);padding:8px 10px;font-size:13.5px;line-height:1.65;color:var(--paper)">智慧套版已啟用：每一頁會依標題長度、內容筆數、數字與圖表需求重新選擇最合適版面。內容太多時，匯出會自動建立續頁，保留文字與數字，正文不縮到 16 pt 以下。</div>
    <div class="hint" style="margin-top:10px">實際保留範圍以上方「目前套用方式」為準。版型會存在這台電腦的瀏覽器裡，重新整理後自動還原。</div>
  </div>`;
}

function styleBox(){
  const ai=aiReady();
  return `<div style="display:grid;gap:8px;margin-bottom:14px">
    ${S.styles.map(s=>styleSwatch(s,!PRESETS.some(p=>p.id===s.id))).join('')}
    ${S.pptTemplate?`<div class="hint" style="border-left:3px solid var(--cy);padding:7px 9px;margin-top:2px">目前已載入 PPTX 版型：版型的配色與字型優先；所選網站風格只補足無法由版型解析的頁面與元件。</div>`:''}
  </div>
  <div style="border:1px dashed var(--line);border-radius:8px;padding:12px">
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <button class="chip ${S.styleTab!=='ai'?'on':''}" data-act="styleTab" data-k="manual">自己選顏色</button>
      <button class="chip ${S.styleTab==='ai'?'on':''}" data-act="styleTab" data-k="ai">交給 AI</button>
    </div>

    ${S.styleTab==='ai' ? (ai ? `
      <input type="text" id="styleDesc" placeholder="想要什麼樣子，例：高對比、溫暖專業、適合長者閱讀">
      <button class="btn sm full" data-act="mkStyle" style="margin-top:8px">AI 配色與文字節奏</button>
      <div class="hint">AI 會產生配色、字型類型、標題／內文字級、字距與行距；系統會再檢查對比與最低字級。</div>
      <div style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px">
        <button class="btn sm" data-act="impStyle">從現有簡報擷取風格</button>
        <div class="hint">丟一份 PDF 或簡報截圖，讀出它的配色存成新風格。PPTX 請先另存成 PDF。</div>
      </div>`
    : `<div style="font-size:14.5px;color:var(--mute);line-height:1.75">
        這兩個功能要讀圖或請 AI 配色，請先在設定選擇 Gemini、OpenAI GPT、Claude 或其他相容服務，再填入該服務的金鑰。
        <div style="margin-top:8px"><button class="btn sm" data-act="settings">前往設定</button></div>
        <div style="margin-top:8px">不想申請的話，切到左邊「自己選顏色」一樣能做出新風格。</div>
      </div>`)
    : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label style="font-size:14px;color:var(--mute)">名稱
          <input type="text" id="msName" value="${esc(S.msName||'')}" placeholder="例：科室藍" style="margin-top:5px"></label>
        <label style="font-size:14px;color:var(--mute)">圓角
          <input type="number" id="msRadius" value="${S.msRadius==null?0:S.msRadius}" min="0" max="16" style="margin-top:5px"></label>
      </div>
      <div style="display:flex;gap:14px;margin-top:12px;flex-wrap:wrap">
        ${[['msBg','背景','#0E2233'],['msInk','文字','#EAF4FA'],['msAccent','重點','#3FD2C7']]
          .map(([id,label,def])=>`<label style="font-size:14px;color:var(--mute);display:flex;align-items:center;gap:7px">
            ${label}<input type="color" id="${id}" value="${esc(S[id]||def)}"
              style="width:38px;height:28px;padding:2px;border:1px solid var(--line);border-radius:5px;background:none;cursor:pointer"></label>`).join('')}
        <label style="font-size:14px;color:var(--mute);display:flex;align-items:center;gap:7px">
          <input type="checkbox" id="msSerif" ${S.msSerif?'checked':''} style="width:auto;accent-color:var(--mark)">標題用襯線字</label>
      </div>
      <button class="btn sm full" data-act="mkManual" style="margin-top:12px">加入風格庫</button>
      <div class="hint">只要挑三個顏色，其餘的深淺會自動配好。</div>`}
  </div>`;
}

function materialBox(){
  return `<textarea id="matDraft" placeholder="貼上會議記錄、規格文件、研究筆記，或用下方按鈕上傳 Word / PDF / Excel" style="min-height:78px"></textarea>
  <div style="display:flex;gap:8px;margin-top:8px">
    <button class="btn sm" data-act="addMat">加入素材</button>
    <button class="btn sm" data-act="upMat">上傳檔案</button>
  </div>
  ${S.materials.length?`<div style="display:grid;gap:5px;margin-top:10px">${S.materials.map(m=>
    `<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:5px;padding:8px 10px;font-size:14px">
      <span class="mono" style="color:var(--cy);font-size:12.5px">DOC</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name)}</span>
      ${(m.tableIds||[]).length?`<span class="mono" style="color:var(--mark);font-size:12.5px">${m.tableIds.length} 表</span>`:''}
      <span class="mono" style="color:var(--mute);font-size:12.5px">${m.text.length}字</span>
      <button class="del" data-act="delMat" data-id="${m.id}" style="background:none;border:none;color:var(--mute);cursor:pointer">×</button>
    </div>`).join('')}</div>`:''}`;
}

function sourceLibraryBox(showAddButton=true){
  const activeIds=new Set(activeUploads().map(u=>u.id));
  return `<div style="border:1px solid var(--line);border-radius:8px;padding:12px;margin-top:12px">
    ${showAddButton?`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <button class="btn sm" data-act="upSources">批次加入內容文件</button>
      <span style="font-size:13.5px;color:var(--mute)">Word、PDF、PPTX、Excel、CSV、文字</span>
    </div>`:''}
    <div class="hint" style="margin-top:${showAddButton?'6':'0'}px">Google Drive 資料夾請先下載並解壓縮，再一次選取多份文件；內容檔與「完整母片」分開上傳。</div>
    ${(S.uploads||[]).length?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:12px">
      ${Object.keys(SOURCE_MODES).map(k=>`<button class="chip ${S.sourceMode===k?'on':''}" data-act="sourceMode" data-k="${k}">${SOURCE_MODES[k].label}</button>`).join('')}
    </div><div class="hint" style="margin-top:6px">${esc(sourcePolicyText())}</div>
    <div style="display:grid;gap:6px;margin-top:10px">${S.uploads.map(u=>{
      const enabled=u.enabled!==false, included=activeIds.has(u.id);
      return `<div style="display:flex;align-items:center;gap:8px;border:1px solid ${included?'var(--cy)':'var(--line)'};border-radius:5px;padding:8px 9px;font-size:13.5px;opacity:${enabled?1:.58}">
        <button class="chip ${included?'on':''}" data-act="toggleUpload" data-id="${u.id}" style="min-width:54px">${enabled?(included?'採用':'保留'):'排除'}</button>
        <span class="mono" style="color:${included?'var(--cy)':'var(--mute)'};font-size:12px">${esc(String(u.kind||'FILE').toUpperCase())}${u.pages?` · ${u.pages}頁`:''}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(u.name)}">${esc(u.name)}</span>
        ${enabled&&!included&&S.sourceMode==='latest'?`<span style="color:var(--warn);font-size:12px">較舊，未採用</span>`:''}
        ${u.encoding?`<span class="mono" style="color:var(--mute);font-size:12px">${esc(u.encoding)}</span>`:''}
        ${u.truncated?`<span style="color:var(--warn);font-size:12px">已截斷</span>`:''}
        <label class="mono" style="display:flex;align-items:center;gap:3px;color:var(--mute);font-size:12px">年份
          <input type="number" data-upload-year="${u.id}" value="${u.year||''}" min="1900" max="${new Date().getFullYear()+1}" placeholder="未標" style="width:76px;min-height:34px;padding:4px 6px;font-size:13px"></label>
        <span class="mono" style="color:var(--mute);font-size:12px">${Number(u.len||0).toLocaleString()}字</span>
        <button data-act="delUpload" data-id="${u.id}" title="移除這個檔案" style="background:none;border:none;color:var(--mute);cursor:pointer;font-size:15px;line-height:1">×</button>
      </div>`;}).join('')}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
      <button class="btn sm" data-act="clearSources" style="${S.confirmClearSources?'border-color:var(--warn);color:var(--warn)':''}">${S.confirmClearSources?`再按一次確認移除 ${S.uploads.length} 份`:`移除全部來源檔案（${S.uploads.length} 份）`}</button>
      <span class="hint" style="margin:0">下方「清空這個文字框」不會動到這裡的檔案。</span>
    </div>`:''}
    ${S.lastUploadError?`<div style="margin-top:10px;border-left:3px solid var(--warn);padding:8px 10px;font-size:13.5px;line-height:1.6;color:var(--warn)">
      上次有檔案讀取失敗，未加入來源清單：${esc(S.lastUploadError)}</div>`:''}
  </div>`;
}

function scenarioFilesBox(){
  const sc=currentScenario(); if(!sc||S.scenario==='own') return '';
  const status=scenarioUploadStatus(), matched=new Map(status.matched.map(x=>[x.label,x]));
  const calc=monthlyScenarioEvidence();
  return `<div style="border:1px solid var(--line);border-radius:9px;padding:14px;margin-bottom:14px;background:#101821">
    <div style="font-size:16px;font-weight:700;margin-bottom:4px">本練習建議素材${(sc.requiredUploads||[]).length>1?`　<span style="font-weight:400;font-size:14px;color:var(--mute)">以下 ${(sc.requiredUploads||[]).length} 項各自對應不同頁面，建議都上傳</span>`:''}</div>
    <div class="hint" style="margin:0 0 9px">缺件也可以往下做，缺的部分會在對應頁面標註「資料待補」，不會憑空生成。</div>
    <div style="display:grid;gap:9px">${(sc.requiredUploads||[]).map((req,i)=>{
      const key=requiredKey(req,i), hit=matched.get(req.label), ok=!!hit,
        pg=(req.pages||[]).length?`第 ${req.pages.join('、')} 頁`:'';
      /* 自動比對只是建議：認錯或認不出來時，可以直接指定是哪一份檔案。 */
      const opts=(S.uploads||[]).map(u=>`<option value="${esc(u.id)}"${(hit&&hit.id===u.id)?' selected':''}>${esc(u.name)}</option>`).join('');
      const picker=(S.uploads||[]).length
        ? `<select data-assign-req="${esc(key)}" style="margin-top:5px;max-width:100%;font-size:13px;padding:4px 6px;background:var(--card);color:var(--paper);border:1px solid var(--line);border-radius:6px">
             <option value="">自動判斷${ok?`（目前：${esc(hit.name)}）`:'（目前沒有對應的檔案）'}</option>${opts}</select>` : '';
      return `<div style="display:flex;gap:9px;align-items:flex-start;font-size:14.5px;line-height:1.55;color:${ok?'var(--paper)':'var(--warn)'}">
        <span aria-hidden="true">${ok?'✓':'○'}</span><span style="min-width:0"><b>${esc(req.label)}</b>${pg?`<span style="color:var(--mute);font-weight:400">　${pg}用</span>`:''}
        ${ok?`<br><span style="color:var(--mute)">已讀取：${esc(hit.name)}　<span style="opacity:.75">（依${esc(hit.how)}判定）</span></span>`
            :`<br><span style="color:var(--mute)">${(S.uploads||[]).length?'上傳的檔案裡認不出這一項，可以在下面直接指定。':'尚未上傳。'}</span>`}
        ${picker}</span></div>`;
    }).join('')}</div>
    ${S.scenario==='monthly'&&(calc.sales||calc.cooling)?`<div style="margin-top:10px;border-left:3px solid var(--cy);padding:8px 10px;font-size:13.5px;line-height:1.6;color:var(--paper)">Excel 欄位辨識：售電資料 ${calc.sales?'✓ 已可計算':'○ 尚缺'}；冷氣時資料 ${calc.cooling?'✓ 已可計算':'○ 尚缺'}。生成時會先使用完整資料計算 6–9 月合計、占比與縣市排名，不交給 AI 從抽樣列猜答案。</div>`:''}
    <div class="hint" style="margin-top:10px">Google Drive 資料夾連結不能直接取得檔案內容，請先下載並解壓縮。情境二可用下方「選擇整個補助資訊資料夾」一次讀取其中所有支援檔案；PPTX 母片仍留到第 5 步上傳。</div>
  </div>`;
}

function textPanel(s,st){
  const tpl=S.pptTemplate, designPick=(tpl&&tpl.designMode)?`<div class="field"><div class="lbl">這一頁套用樣板的第幾頁版面</div>
    <select id="txtDesign">
      <option value="">自動（依頁型分配）</option>
      ${(tpl.designSlides||[]).map(d=>`<option value="${d.index}" ${Number(s.designIndex)===d.index?'selected':''}>樣板第 ${d.index} 頁</option>`).join('')}
    </select><div class="hint">換一頁版面等於換一組文字框位置，文字會落到不同的留白區。</div></div>`:'';
  const t=slideTextStyle(s), titleMin=s.layout==='cover'?50:35, fitWarnings=slideFitWarnings(s);
  const toggle=(key,label,on)=>`<button class="chip ${on?'on':''}" data-act="textToggle" data-k="${key}">${label}</button>`;
  const statBlock = s.layout==='stat' ? `<div class="field"><div class="lbl">大數字字級　<span id="txtStatOut">${t.statSizeSet?t.statSize+' pt':'自動'}</span></div>
      <input type="range" id="txtStatSize" min="24" max="160" step="2" value="${t.statSize||Math.round((t.titleSize||44)*2)}">
      <div class="hint">留在最左邊＝自動依文字框大小決定。手動調整後仍會自動縮到框內，不會溢出。</div></div>` : '';
  const FONTS=[['','跟隨樣板／風格'],['Microsoft JhengHei','微軟正黑體'],['Noto Sans TC','思源黑體'],
    ['PingFang TC','蘋方'],['DFKai-SB','標楷體'],['Arial','Arial'],['Times New Roman','Times New Roman'],['Consolas','Consolas']];
  return `${designPick}<div class="field"><div class="lbl">字體</div>
      <select id="txtFontName">${FONTS.map(([v,label])=>`<option value="${esc(v)}" ${(t.fontName||'')===v?'selected':''}>${esc(label)}</option>`).join('')}</select>
      <div class="hint">選了實際字體名稱後，預覽與匯出的 PPTX 都會使用它。</div></div>
    <div class="field"><div class="lbl">標題字級　<span id="txtTitleOut">${t.titleSize} pt</span></div>
      <input type="range" id="txtTitleSize" min="${titleMin}" max="64" step="1" value="${t.titleSize}"></div>
    <div class="field"><div class="lbl">內文字級　<span id="txtBodyOut">${t.bodySize} pt</span></div>
      <input type="range" id="txtBodySize" min="16" max="32" step="1" value="${t.bodySize}"></div>
    ${statBlock}
    <div class="field"><div class="lbl">字距　<span id="txtLetterOut">${t.letterSpacing}</span></div>
      <input type="range" id="txtLetterSpacing" min="-1" max="3" step="0.25" value="${t.letterSpacing}"></div>
    <div class="field"><div class="lbl">行距　<span id="txtLineOut">${t.lineSpacing}</span></div>
      <input type="range" id="txtLineSpacing" min="1.15" max="1.7" step="0.05" value="${t.lineSpacing}"></div>
    <div class="field"><div class="lbl">基本文字風格</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${toggle('titleBold','標題粗體',t.titleBold)}${toggle('titleItalic','標題斜體',t.titleItalic)}
        ${toggle('bodyBold','內文粗體',t.bodyBold)}${toggle('bodyItalic','內文斜體',t.bodyItalic)}</div></div>
    <div class="field"><div class="lbl">對齊</div><div style="display:flex;gap:6px">
      ${[['left','靠左'],['center','置中'],['right','靠右']].map(([k,v])=>`<button class="chip ${t.align===k?'on':''}" data-act="textAlign" data-k="${k}">${v}</button>`).join('')}</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" class="field">
      <label><div class="lbl">標題顏色</div><input type="color" id="txtTitleColor" value="${esc(t.titleColor||st.ink)}"></label>
      <label><div class="lbl">內文顏色</div><input type="color" id="txtBodyColor" value="${esc(t.bodyColor||st.sub)}"></label></div>
    <button class="btn full" data-act="textApplyAll">套用到全部頁面</button>
    <button class="btn full" data-act="textReset" style="margin-top:8px">本頁回復預設文字樣式</button>
    ${fitWarnings.length?`<div style="margin-top:10px;border:1px solid #E7A83E;background:#2A2112;color:#FFD993;border-radius:8px;padding:10px 12px;font-size:14px;line-height:1.65">排版提醒：${fitWarnings.map(esc).join('；')}。原始內容仍會保留。</div>`:''}
    <div class="hint">字級、字距與行距會同步到 PowerPoint。系統會限制最低字級；內容過多時會提醒分頁或換版型。</div>`;
}

function builtinChartStyleBox(cur){
  const active=(cur&&cur.chart&&cur.chart.styleId)||S.chartStyleDefault||'auto', st=curStyle();
  const cards=BUILTIN_CHART_STYLES.map(style=>{
    const colors=style.colors.length?style.colors:[st.accent,st.accent2];
    const bars=[46,78,60,92].map((h,i)=>`<span style="width:14%;height:${h}%;background:${colors[i%colors.length]};display:block;border-radius:3px 3px 0 0"></span>`).join('');
    return `<button class="chip ${active===style.id?'on':''}" data-act="chartStyle" data-k="${style.id}" style="padding:10px;text-align:left;min-height:112px;display:grid;grid-template-columns:82px 1fr;gap:10px;align-items:center">
      <span aria-hidden="true" style="height:64px;border-left:1px solid ${st.rule};border-bottom:1px solid ${st.rule};display:flex;align-items:flex-end;justify-content:space-evenly;padding:6px 5px 0">${bars}</span>
      <span><b style="display:block;color:var(--paper);font-size:15px;margin-bottom:3px">${esc(style.name)}</b><span style="display:block;white-space:normal;line-height:1.45;color:var(--mute);font-size:13px">${esc(style.desc)}</span></span></button>`;
  }).join('');
  return `<div style="border:1px solid var(--line);border-radius:9px;padding:14px;margin-bottom:15px;background:#101821">
    <div class="lbl">內建圖表模板</div>
    <div style="font-size:16px;font-weight:700;margin-bottom:5px">選一套完整的圖表呈現</div>
    <div class="hint" style="margin-bottom:11px">同時調整色盤、格線、數值標籤、座標文字與折線粗細；不會改變資料、排序與來源。</div>
    <div class="chart-style-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${cards}</div>
    <button class="btn sm full" data-act="chartStyleAll" data-k="${esc(active)}" style="margin-top:10px">套用目前模板到全部資料圖表</button>
    <div class="hint" style="margin-top:7px">目前選擇也會成為下一張新圖表的預設風格。</div>
  </div>`;
}

function chartStyleLibraryBox(cur){
  const lib=S.chartStyleLibrary, active=(cur&&cur.chart&&cur.chart.styleId)||S.chartStyleDefault||'auto';
  if(!lib) return `<div style="border:2px dashed var(--line);border-radius:9px;padding:14px;margin-bottom:15px">
    <div class="lbl">圖表風格庫（選用）</div>
    <div class="hint" style="margin-bottom:9px">上傳含可編輯原生圖表的 PPTX，系統只擷取圖表色盤與呈現方式，不會使用檔案內的範例數字，也不會強制套用它的母片。</div>
    <button class="btn full" data-act="upChartStyle">上傳圖表風格 PPTX</button></div>`;
  const types=Object.entries(lib.types||{}).filter(x=>x[1]).map(([k,n])=>`${k} ${n}`).join('、');
  const compatibility={recommended:'適合當圖表風格庫',available:'可套用（樣本較少）',limited:'有限套用'}[lib.compatibility]||'可套用';
  return `<div style="border:2px solid var(--mark);border-radius:9px;padding:14px;margin-bottom:15px;background:#211821">
    <div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1;min-width:0">
      <div style="font-size:16px;font-weight:700;color:var(--mark)">✓ 已載入圖表風格：${esc(lib.source||'PPTX')}</div>
      <div class="hint">${esc(compatibility)} · 辨識 ${lib.chartCount||0} 個原生圖表${types?' · '+esc(types):''}</div></div>
      <button class="btn sm" data-act="clearChartLibrary">移除</button></div>
    <div style="display:flex;gap:6px;margin:10px 0">${(lib.palette||[]).map(c=>`<span title="${esc(c)}" style="width:25px;height:25px;border-radius:50%;background:${esc(c)};border:1px solid rgba(255,255,255,.35)"></span>`).join('')}</div>
    <div class="lbl">套用到${cur&&cur.layout==='chart'?'目前圖表':'下一張新圖表'}</div>
    <div style="display:grid;gap:7px">${(lib.variants||[]).map(v=>`<button class="chip ${active===v.id?'on':''}" data-act="chartStyle" data-k="${v.id}" style="text-align:left"><b>${esc(v.name)}</b>　${esc(v.desc)}</button>`).join('')}</div>
    <button class="btn sm full" data-act="chartStyleAll" data-k="${active==='auto'?'template-classic':active}" style="margin-top:9px">套用到全部資料圖表</button>
    <div class="hint" style="margin-top:8px">只改圖表外觀；數值、標籤與來源仍使用目前簡報和 Excel。</div>
  </div>`;
}

function chartPanel(cur){
  const setup=chartDraftSetup(cur||{}), inline=slideNumberSeries(cur||{});
  const readyLabel=setup.table?`已找到數值資料：${setup.table.title}`:inline?'已找到本頁明示數值':'沒有可信數值，將使用內容結構圖';
  return builtinChartStyleBox(cur)+chartStyleLibraryBox(cur)+`<div style="border:1px solid var(--line);border-radius:9px;padding:15px;background:#101821">
      <div class="lbl">依目前頁面生成圖表</div>
      <div style="font-size:16px;font-weight:700;line-height:1.45;margin-bottom:8px">把這頁重點轉成漂亮的分析圖表</div>
      <div class="hint" style="margin-bottom:13px">系統先讀取目前頁面；有可信數值時建立數據圖表，沒有數值時建立不含推估的內容結構圖。新頁會插在目前頁面後方。</div>
      <div style="border-left:3px solid ${setup.table||inline?'var(--cy)':'var(--warn)'};padding:7px 9px;margin-bottom:12px;font-size:13.5px;line-height:1.55;color:var(--paper)">${esc(readyLabel)}</div>
      <button class="btn pri full" data-act="chartAi">＋ 根據本頁內容生成圖表</button>
    </div>
    <div style="margin-top:16px">
      <div class="lbl">常用分析圖表</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:14px;color:var(--mute)">
        <div style="border:1px solid var(--line);border-radius:6px;padding:9px"><b style="color:var(--paper)">柱狀圖</b><br>項目比較</div>
        <div style="border:1px solid var(--line);border-radius:6px;padding:9px"><b style="color:var(--paper)">橫條圖</b><br>排名與長標籤</div>
        <div style="border:1px solid var(--line);border-radius:6px;padding:9px"><b style="color:var(--paper)">折線圖</b><br>時間趨勢</div>
        <div style="border:1px solid var(--line);border-radius:6px;padding:9px"><b style="color:var(--paper)">圓環圖</b><br>比例與占比</div>
      </div>
    </div>
    ${cur&&cur.layout==='chart'&&cur.chart&&cur.chart.type!=='content'?`<div style="border-top:1px solid var(--line);margin-top:18px;padding-top:16px">
      <div class="lbl">目前圖表類型</div><div style="display:flex;gap:5px;flex-wrap:wrap">${[['column','柱狀'],['bar','橫條'],['line','折線'],['doughnut','圓環']].map(([k,v])=>`<button class="chip ${cur.chart.type===k?'on':''}" data-act="chartType" data-k="${k}">${v}</button>`).join('')}</div>
      <div style="border:1px solid var(--line);border-radius:6px;padding:10px;margin-top:11px;font-size:14px;line-height:1.65;color:var(--mute)">
        分類欄位：<b style="color:var(--paper)">${esc(cur.chart.category||'本頁項目')}</b><br>
        數值系列：${(cur.chart.series||[]).map(s=>esc(chartUnitName(s))).join('、')||'未指定'}<br>
        圖表項目：${new Set((cur.chart.labels||[]).map(String)).size} 個${cur.chart.aggregated?'（同名明細已先彙整）':''} · ${cur.chart.sort==='desc'?'由高至低':'依來源順序'}<br>
        資料來源：${esc(cur.chart.source||'目前簡報內容')}
      </div>
    </div>`:''}`;
}

function ensureTextStyle(s){
  if(!s.textStyle) s.textStyle=slideTextStyle(s);
  return s.textStyle;
}

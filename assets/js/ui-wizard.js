function wizardBasis(){
  return [S.scenario||'',sourceMaterial(30000).trim(),S.sourceMode,S.plan||'',effectiveRulesText(rulesObj())].join('\n---\n');
}

function monthlyOutlineNeedsRefresh(){
  if(S.scenario!=='monthly'||!String(S.md||'').trim()) return false;
  const c=monthlyScenarioEvidence(), text=String(S.md||'');
  if(c.sales&&(/住宅部門售電量總計：?\s*資料待補/.test(text)||/用電增幅第\s*1\s*高縣市：?\s*資料待補/.test(text))) return true;
  if(c.cooling&&/冷氣時：?\s*資料待補/.test(text)) return true;
  return false;
}

function wizardCheckpoint(step){
  if(step===5&&S.styleReturnSession&&S.styleReturnSession.basis===S.md)return {ok:true,msg:'已保留現有投影片；此處僅調整整體外觀，完成後返回微調。'};
  if(step===1){
    const sc=SCENARIOS[S.scenario];
    return sc?{ok:true,msg:'已選擇「'+sc.name+'」'}:{ok:false,msg:'請先選擇一個簡報情境'};
  }
  if(step===2){
    const len=sourceMaterial(30000).trim().length;
    const sc=currentScenario();
    if(sc&&S.scenario!=='own'&&sc.sourceMode&&S.sourceMode!==sc.sourceMode)
      return {ok:false,msg:`此練習必須使用「${sourceModeLabel(sc.sourceMode)}」，避免排除指定來源`};
    const status=scenarioUploadStatus();
    if(!len){
      /* 說清楚是「沒有素材」還是「有素材但被停用／讀取失敗」，
         否則明明上傳過卻只看到「請貼上內容」，會找不到原因。 */
      const all=(S.uploads||[]).length, on=enabledUploads().length;
      if(all&&!on) return {ok:false,msg:`已上傳 ${all} 份檔案，但全部被設為「排除」；請在上方來源清單按一下檔案左邊的按鈕改回「採用」`};
      if(all&&!enabledUploads().some(u=>String(u.text||'').trim()))
        return {ok:false,msg:`已上傳 ${all} 份檔案，但都讀不到文字內容（可能是掃描影像或空白版型），請改用有文字層的檔案`};
      if(S.lastUploadError) return {ok:false,msg:'檔案讀取失敗，未加入來源：'+S.lastUploadError};
      return {ok:false,msg:'請貼上內容或上傳一份素材'};
    }
    /* 缺件改成可略過的提醒：讓學員先用手上有的資料跑完流程，
       缺件對應的頁面會在講稿標註「資料待補」，指令也會明確告知模型不得補造。 */
    if(!status.ok){
      const miss=missingPageNote();
      return {ok:true,warn:true,msg:'可以繼續，但尚缺：'+status.missing.join('、')+
        (miss&&miss.pages.length?`；第 ${miss.pages.join('、')} 個必要主題群會標註「資料待補」`:'')};
    }
    if(S.scenario==='own') return {ok:true,msg:'素材已準備，共 '+len.toLocaleString()+' 字'};
    const tableN=availableTables().length;
    return {ok:true,msg:'必要素材已齊：'+enabledUploads().length+' 份檔案'+(tableN?'、'+tableN+' 個資料表':'')};
  }
  if(step===3){
    const live=!!document.getElementById('rRole'), r=live?readRulesForm():rulesObj();
    if(!String(r.role||'').trim()) return {ok:false,msg:'請填寫角色設定'};
    if(!String(r.audience||'').trim()) return {ok:false,msg:'請填寫目標受眾'};
    const raw=id=>{ const el=document.getElementById(id); return el?Number(el.value):null; };
    const nums=live?{pages:raw('rPages'),titleMax:raw('rTitle'),kickerMax:raw('rKicker'),bulletCount:raw('rCount'),bulletMax:raw('rLen')}:r;
    if(!Number.isSafeInteger(nums.pages)||(nums.pages!==0&&nums.pages<PAGE_MIN)) return {ok:false,msg:`頁數請填 0（自動）或至少 ${PAGE_MIN} 頁的整數`};
    const scP=currentScenario(), minScenarioPages=scP&&S.scenario!=='own'&&scP.includeCover?Number(scP.pages||0)+1:PAGE_MIN;
    if(nums.pages!==0&&nums.pages<minScenarioPages)
      return {ok:false,msg:`此練習包含封面與 ${scP.pages} 個必要主題群，頁數請填 0（自動）或至少 ${minScenarioPages} 頁`};
    /* 總頁數改成「建議值」而不是硬性規定。舊版把它釘死，欄位改得動、存得進去，
       按下一步才被打回來，體感比不能改更糟。改動仍會在下一步的提示裡說明。 */
    if(!Number.isFinite(nums.titleMax)||!Number.isFinite(nums.kickerMax)||!Number.isFinite(nums.bulletCount)||!Number.isFinite(nums.bulletMax)||
      nums.titleMax<6||nums.titleMax>30||nums.kickerMax<8||nums.kickerMax>40||nums.bulletCount<2||nums.bulletCount>10||nums.bulletMax<10||nums.bulletMax>60)
      return {ok:false,msg:'文字與條列限制超出允許範圍'};
    const pageMsg=scP&&S.scenario!=='own'&&scP.pages
      ? (nums.pages===0
        ? `；本練習含封面與 ${scP.pages} 個必要主題群，頁數將依內容自動判斷`
        : `（本練習含封面與 ${scP.pages} 個必要主題群，將依目前設定產出 ${nums.pages} 頁）`)
      : (nums.pages===0?`；頁數將依內容自動判斷（目前建議約 ${autoPageRecommendation()} 頁）`:``);
    return {ok:true,msg:'角色、受眾與內容限制都已設定'+pageMsg};
  }
  if(step===4){
    const parsed=String(S.md||'').trim()?previewParse(S.md):null;
    if(!parsed) return {ok:false,msg:'請先生成大綱，或貼回 AI 產生的內容'};
    if(!parsed.ok) return {ok:false,msg:parsed.msg||'大綱格式無法解析'};
    if(parsed.thin) return {ok:false,msg:'只解析到一頁且沒有條列，請補上完整頁面內容'};
    const sc=currentScenario();
    /* 大綱頁數同樣改成提醒。使用者若刻意做 5 頁，不該被擋在這一步。 */
    if(!S.outlineBasis||S.outlineBasis!==wizardBasis()) return {ok:false,msg:'素材或規範已變更，請重新生成大綱，或確認目前大綱已依新素材更新'};
    const scO=currentScenario();
    const noteO=(scO&&S.scenario!=='own'&&scO.pages)
      ? `（已保留 ${scO.pages} 個必要主題群）` : '';
    return {ok:true,msg:'大綱格式正確：'+parsed.n+' 頁'+noteO};
  }
  const outline=wizardCheckpoint(4);
  if(!outline.ok) return outline;
  const template=scenarioTemplateStatus();
  if(!template.ok) return template;
  if(!curStyle()) return {ok:false,msg:'請先選擇一個簡報風格'};
  return {ok:true,msg:S.pptTemplate?'內容、風格與 PowerPoint 母片已就緒':'內容與風格已就緒；此次未使用外部母片'};
}

function firstBlockedStep(target){
  for(let n=1;n<target;n++){ const cp=wizardCheckpoint(n); if(!cp.ok) return {step:n,msg:cp.msg}; }
  return null;
}

function advanceWizard(target){
  syncStep();
  const blocked=firstBlockedStep(target);
  if(blocked){ S.step=blocked.step; return fail('步驟 '+blocked.step+' 尚未完成：'+blocked.msg); }
  S.step=target; S.maxStep=Math.max(S.maxStep,target); saveDraft(); render();
}

function inferredWizardMaxStep(){
  let max=1;
  for(let target=2;target<=5;target++){ if(firstBlockedStep(target)) break; max=target; }
  return max;
}

function refreshWizardCheckpoint(){
  clearTimeout(wizardRefreshTimer);
  wizardRefreshTimer=setTimeout(applyWizardCheckpoint,140);
}

function applyWizardCheckpoint(){
  if(!S.wizard) return;
  const cp=wizardCheckpoint(S.step), hint=document.querySelector('[data-step-check]');
  if(hint){ hint.textContent=(cp.ok&&!cp.warn?'✓ ':'')+cp.msg; hint.style.color=(cp.ok&&!cp.warn)?'var(--cy)':'var(--warn)'; }
  const acts={1:'toStep2',2:'toStep3',3:'toStep4',4:'toStep5',5:'finishWizard'};
  const next=document.querySelector('[data-act="'+acts[S.step]+'"]'); if(next) next.disabled=!cp.ok;
}

function stepBar(){
  if(S.styleReturnSession&&S.styleReturnSession.basis===S.md)return '<h1>整體風格設定</h1><p>目前正在調整已完成簡報的外觀，不會重跑前面的資料與大綱步驟。</p>';
  return `<div style="display:flex;gap:0;margin-bottom:30px;flex-wrap:wrap">
    ${STEPS.map(s=>{
      const cpn=wizardCheckpoint(s.n), on=s.n===S.step, unlocked=s.n<=S.maxStep, complete=s.n<S.maxStep&&cpn.ok&&!cpn.warn;
      return `<button data-act="goStep" data-k="${s.n}" ${unlocked?'':'disabled'} style="flex:1;min-width:110px;text-align:left;
        background:none;border:none;border-top:3px solid ${on?'var(--mark)':complete?'var(--cy)':'var(--line)'};
        padding:12px 12px 0 0;cursor:${unlocked?'pointer':'default'};font-family:inherit;opacity:${unlocked?1:.45}">
        <div style="font-size:13px;font-weight:600;letter-spacing:.3px;color:${on?'var(--mark)':complete?'var(--cy)':'var(--mute)'}">${complete?'✓ ':''}${'一二三四五'[s.n-1]}　${s.u}</div>
        <div style="font-size:16px;font-weight:700;color:${on?'var(--paper)':'var(--mute)'};margin-top:5px">${s.t}</div>
      </button>`;}).join('')}
  </div>`;
}

function teach(text){
  return `<div style="border-left:3px solid var(--cy);background:#0E1A1C;padding:12px 14px;border-radius:0 6px 6px 0;
    font-size:15px;line-height:1.75;color:#D1DFE1;margin-bottom:22px">${text}</div>`;
}

function navRow(nextLabel, nextAct, disabled){
  const cp=wizardCheckpoint(S.step), blocked=!!disabled||!cp.ok;
  return `<div style="display:flex;gap:10px;margin-top:24px;align-items:center">
    ${S.step>1&&!S.styleReturnSession?`<button class="btn" data-act="goStep" data-k="${S.step-1}">返回</button>`:''}
    <span style="flex:1"></span>
    ${nextLabel?`<button class="btn pri" data-act="${nextAct}" ${blocked?'disabled':''} style="padding:11px 22px">${nextLabel}</button>`:''}
  </div><div class="hint" data-step-check style="text-align:right;color:${(cp.ok&&!cp.warn)?'var(--cy)':'var(--warn)'}">${(cp.ok&&!cp.warn)?'✓ ':''}${esc(cp.msg)}</div>`;
}

function viewWizard(){
  const r=rulesObj();
  let body='';

  if(S.step===1){
    body = teach('AI 寫字很快，花時間的是後面排版。這裡讓 AI 只管內容，版面交給程式套，產出的每個字都還能改。先挑一個要做的情境。')
    + `<div style="display:grid;gap:10px">
      ${Object.keys(SCENARIOS).map(k=>{ const s=SCENARIOS[k], on=S.scenario===k;
        return `<button data-act="pickScenario" data-k="${k}" style="text-align:left;background:${on?'var(--line)':'transparent'};
          border:1px solid ${on?'var(--mark)':'var(--line)'};border-radius:8px;padding:16px;cursor:pointer;
          color:var(--paper);font-family:inherit">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:15px;font-weight:700">${s.name}</div>
            <span class="mono" style="font-size:12.5px;color:var(--cy);border:1px solid var(--cy);border-radius:3px;padding:3px 6px">${s.unit}</span>
          </div>
          <div style="font-size:15px;color:var(--mute);margin-top:8px;line-height:1.7">${s.desc}</div>
          <div style="font-size:14px;color:var(--cy);margin-top:7px">${s.example}</div>
        </button>`;}).join('')}
    </div>` + navRow('下一步','toStep2',!S.scenario);

  }else if(S.step===2){
    const sc=SCENARIOS[S.scenario]||SCENARIOS.own;
    body = teach(S.scenario==='own'
      ? '把資料貼進來，或一次拖入多份檔案。Word、PDF、PPTX、Excel、CSV、純文字都可以。PPTX 會保留來源投影片頁碼。'
      : '這裡只內建任務規格，不會放入假數據。請上傳課程附件；至少要有一份讀得到內容的素材才能往下，其餘缺件會標註「資料待補」而不是憑空生成。')
    + scenarioFilesBox()
    + `<div id="dropZone" style="border:1.5px dashed var(--line);border-radius:8px;padding:14px;margin-bottom:14px;
        display:flex;align-items:center;gap:12px;flex-wrap:wrap;transition:border-color .15s,background .15s">
        <button class="btn sm" data-act="upMatW">選擇檔案</button>
        ${S.scenario==='compare'?`<button class="btn sm" data-act="upFolder">選擇整個補助資訊資料夾</button>`:''}
        <span style="font-size:15px;color:var(--mute)">或一次拖入多份檔案　Word、PDF、PPTX、Excel、CSV、純文字</span>
      </div>
      ${sourceLibraryBox(false)}
      <div class="lbl">手動貼上的素材</div>
      <textarea id="wMat" style="min-height:230px;font-size:15px;line-height:1.7;font-family:'IBM Plex Mono',monospace">${esc(S.brief)}</textarea>
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap">
        ${S.scenario!=='own'?`<button class="btn sm" data-act="resetMat">還原任務說明</button>`:''}
        <button class="btn sm" data-act="clearMat">清空這個文字框</button>
        <span style="flex:1"></span>
        <span class="mono" id="wMatCount" style="font-size:13px;color:var(--mute)">${(S.brief||'').length} 字</span>
      </div>
      <div class="hint">上傳檔案會保留在上方來源清單，不會混進這個可編輯欄位。PPTX 會依投影片頁碼整理文字與講稿；Excel 和 CSV 會保留結構化列值並在你的電腦計算摘要。舊版 .doc／.ppt 請先另存為 .docx／.pptx 或 PDF。</div>`
    + navRow('下一步','toStep3',!sourceMaterial(30000).trim());

  }else if(S.step===3){
    body = teach('這步是關鍵。把要求寫清楚，AI 才不會回你一堆「顯著提升」這種空話。填完下面會顯示實際會送出去的指令，之後每次生成都自動帶上。')
    + `<div class="rules-top-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
        <div class="field"><div class="lbl">角色設定</div>
          <input type="text" id="rRole" value="${esc(r.role)}"></div>
        <div class="field"><div class="lbl">目標受眾</div>
          <input type="text" id="rAud" value="${esc(r.audience)}"></div>
      </div>
      <div class="rules-grid" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px">
        <div class="field"><div class="lbl">總頁數</div><input type="number" id="rPages" value="${r.pages==null?'':r.pages}" min="0" step="1">
          <div class="hint">0 代表依內容自動判斷（目前建議約 ${autoPageRecommendation()} 頁）；指定整數才固定頁數。</div></div>
        <div class="field"><div class="lbl">標題字數</div><input type="number" id="rTitle" value="${r.titleMax}" min="6" max="30"></div>
        <div class="field"><div class="lbl">結論字數</div><input type="number" id="rKicker" value="${r.kickerMax}" min="8" max="40"></div>
        <div class="field"><div class="lbl">條列點數</div><input type="number" id="rCount" value="${r.bulletCount}" min="2" max="10"></div>
        <div class="field"><div class="lbl">每點字數</div><input type="number" id="rLen" value="${r.bulletMax}" min="10" max="60"></div>
      </div>
      <div class="field"><div class="lbl">禁用詞</div>
        <input type="text" id="rBan" value="${esc(r.banned)}">
        <div class="hint">用頓號分隔。這一條是要逼 AI 拿數據講話，別用形容詞混過去。</div></div>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:16px;cursor:pointer">
        <input type="checkbox" id="rUnits" ${r.units?'checked':''} style="width:auto;accent-color:var(--mark)">
        引用數據時保留原始單位、年份與比較口徑</label>

      <div class="lbl">實際會送出去的指令</div>
      <pre id="rulesPreview" style="background:var(--ink);border:1px solid var(--line);border-radius:6px;padding:15px;font-size:14px;
        line-height:1.7;color:var(--mute);white-space:pre-wrap;font-family:'IBM Plex Mono',monospace;margin:0">${esc(buildRulesText(readRulesForm()||r))}</pre>`
    + navRow('下一步','toStep4');

  }else if(S.step===4){
    const hasModel = S.cfg.provider==='ollama' ? true : !!S.cfg.key;
    /* 指令長度直接決定要等多久，先讓使用者看得到 */
    const promptText=buildPrompt(), promptLen=promptText.length, sampled=!!window.__tableSampled;
    const costHint=`<div class="hint" style="margin-top:8px;color:${promptLen>20000?'var(--warn)':'var(--mute)'}">`+
      `本次指令長度 ${promptLen.toLocaleString()} 字${S.tables&&S.tables.length?`（含 ${S.tables.length} 張資料表的原值）`:''}。`+
      `模型要先讀完才開始寫，資料表越多等越久；${promptLen>20000?'目前偏長，若只是想先看流程，可以先停用部分來源再生成。':'目前長度正常。'}`+
      (sampled?'<br><span style="color:var(--warn)">資料表過大，已等距抽樣送出；需要完整排名時請縮小資料範圍後重新上傳。</span>':'')+
      `</div>`;
    body = teach('大綱的格式是每頁一個 # 標題、一句 &gt; 核心結論、幾條 - 要點。拿到之後可以直接在框裡改，'
      + '不用再另存 txt、也不用從大綱插入投影片，排版這邊會處理掉。')
    + (hasModel
      ? `<div style="border:1px solid var(--mark);border-radius:8px;padding:16px;margin-bottom:18px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="font-size:16px;font-weight:700">直接產生大綱</span>
          </div>
          <button class="btn pri" data-act="genMD" ${S.busy?'disabled':''}>${S.busy?'生成中…':(S.md?'重新生成大綱':'生成大綱')}</button>
          <span style="font-size:14px;color:var(--mute);margin-left:10px">目前用 ${esc(modelLabel())}</span>
          <button class="btn sm" data-act="settings" style="margin-left:6px">換模型</button>
          ${costHint}
        </div>
        <details style="margin-bottom:18px">
          <summary style="cursor:pointer;font-size:15px;color:var(--mute);padding:8px 0">或者，複製指令貼到自己的 AI 工具</summary>
          <textarea id="promptOut" readonly style="min-height:140px;font-size:14px;line-height:1.7;font-family:'IBM Plex Mono',monospace;color:var(--mute);margin-top:8px">${esc(promptText)}</textarea>
          <button class="btn sm" data-act="copyPrompt" style="margin-top:8px">複製指令</button>
        </details>`
      : `<div style="border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:18px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="font-size:16px;font-weight:700">一、複製這段指令，貼到你的 AI</span>
          </div>
          <textarea id="promptOut" readonly style="min-height:170px;font-size:14px;line-height:1.7;font-family:'IBM Plex Mono',monospace;color:var(--mute)">${esc(promptText)}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap">
            <button class="btn sm pri" data-act="copyPrompt">複製指令</button>
            <span style="font-size:14px;color:var(--mute)">ChatGPT、Gemini、Claude 都行，免費帳號就夠</span>
          </div>
          <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:12px;font-size:14px;color:var(--mute);line-height:1.7">
            不想複製貼上，可選擇 Gemini、OpenAI GPT、Claude 或其他相容服務，之後直接在這頁生成。
            <button class="btn sm" data-act="settings" style="margin-left:6px">選擇 AI 服務</button></div>
        </div>`)
    + `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:16px;font-weight:700">${hasModel?'產出的大綱，可以直接改':'二、把 AI 回覆的內容貼回這裡'}</span>
      </div>
      <textarea id="wMD" placeholder="# 頁標題&#10;> 核心結論&#10;- 條列一&#10;- 條列二"
        style="min-height:230px;font-size:15px;line-height:1.75;font-family:'IBM Plex Mono',monospace">${esc(S.md||'')}</textarea>
      <div class="hint" id="mdHint">貼回來之後可以直接改，確認沒問題再往下。</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
        <button class="btn sm ${S.outlineBasis===wizardBasis()?'':'pri'}" data-act="confirmOutline">${S.outlineBasis===wizardBasis()?'✓ 已確認目前大綱':'先確認使用目前大綱'}</button>
        <span class="hint">${S.outlineBasis===wizardBasis()?'已確認；之後仍可直接修改文字。':'若素材或規範剛更新，請重新生成，或人工確認大綱已同步。'}</span>
      </div>`
    + navRow('下一步','toStep5',!(S.md||'').trim());

  }else{
    const st=previewStyle(),deck=wizardPreviewDeck();
    const previewIndex=Math.max(0,Math.min(deck.length-1,S.wizardPreviewIndex||0));
    body = teach('風格只影響外觀，換了不會動到內容。若有單位既有的 PowerPoint 空白版型，可直接上傳並保留母片、Logo、頁尾與版面配置。')
    + ((currentScenario()&&currentScenario().templateSuggested)?`<div style="border:1px solid ${S.pptTemplate?'var(--cy)':'var(--line)'};border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:14.5px;line-height:1.65;color:${S.pptTemplate?'var(--cy)':'var(--paper)'}">
        ${S.pptTemplate?'✓ 已選擇母片':'PowerPoint 母片為選用，可直接略過'}<br><span style="color:var(--mute)">課程示例：${esc(currentScenario().expectedTemplate)}。你可以自由上傳其他 PPTX；未上傳時會使用目前網站風格，不影響完成與匯出。</span></div>`:'')
    + `<div class="wizard-style-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
        <div class="style-workspace-settings">${WorkflowUI.styleSetup()}</div>
        <div class="style-workspace-preview" style="border:1px solid var(--line);border-radius:10px;overflow:hidden">
          <div style="padding:12px;font-size:15px;line-height:1.6"><b>實際內容預覽 · 第 ${previewIndex+1}／${deck.length} 頁</b><br>依確認大綱與內容續頁，完成後沿用這份內容。${outlineMappingLabel(deck[previewIndex])}</div>
          <div class="frame"><div class="stage">${deck[previewIndex]?renderSlide(deck[previewIndex],st,previewIndex,deck.length,false):''}</div></div>
          <div class="wizard-preview-nav" style="display:flex;gap:6px;overflow-x:auto;padding:10px">${deck.map((s,i)=>`<button class="chip ${i===previewIndex?'on':''}" data-act="wizardPreviewPage" data-i="${i}" style="flex:0 0 auto">${i+1} ${s.layout==='cover'?'封面':esc(s.title||'內容')}</button>`).join('')}</div>
          <div class="style-preview-actions"><p class="hint">這裡先核對整體外觀。按「完成簡報」進入逐頁微調，再預覽與匯出。</p></div>
        </div>
      </div>`
    + navRow('完成簡報','finishWizard');
  }

  return `${topbar(false)}
  <div class="scroll" style="flex:1">
    <div class="wizard-wrap ${S.step===5?'style-workspace':''}" style="max-width:${S.step===5?'1320':'900'}px;margin:0 auto;padding:38px 28px 90px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div style="font-size:15px;font-weight:600;color:var(--mute)">AI 生成簡報培力課程</div>
        <span style="flex:1"></span>
        <button class="btn sm" data-act="skipWizard">跳過</button>
      </div>
      <h1 style="font-size:clamp(24px,3.2vw,34px);line-height:1.25;margin:0 0 26px;font-weight:700;letter-spacing:-.4px">
        ${S.step===1?'照著五步走，拿到一份能改的簡報':STEPS[S.step-1].t}</h1>
      ${stepBar()}
      ${body}
    </div>
  </div>`;
}

function readRulesForm(){
  const g=x=>{const el=document.getElementById(x);return el?el.value:null;};
  if(g('rRole')===null) return null;
  const u=document.getElementById('rUnits');
  const num=id=>{ const raw=g(id); return raw==null||String(raw).trim()===''?null:Number(raw); };
  return {role:g('rRole'), audience:g('rAud'), pages:num('rPages'), titleMax:num('rTitle'),
    kickerMax:num('rKicker'), bulletCount:num('rCount'), bulletMax:num('rLen'),
    units:u?u.checked:true, banned:g('rBan')||''};
}

function saveRulesForm(){
  const r=readRulesForm(); if(!r) return;
  const merged=rulesObj();
  Object.keys(r).forEach(k=>{
    const v=r[k];
    if(v===null||v===undefined) return;
    if(typeof RULES_BASE[k]==='number'&&!Number.isFinite(Number(v))) return;
    merged[k]=v;
  });
  LS.set('rulesObj',merged);
  /* 使用者手寫過的規範不要被表單靜默覆蓋 */
  if(!S.rulesEdited){ S.rules=buildRulesText(merged); LS.set('rules',S.rules); }
  if(Number.isFinite(Number(merged.pages))) S.pages=Number(merged.pages);
}

async function genMD(){
  const el=document.getElementById('wMD'); if(el) S.md=el.value;
  const m=document.getElementById('wMat'); if(m) S.brief=m.value;
  if(!sourceMaterial(30000).trim()) return fail('還沒有啟用的素材，請回到步驟 2。');
  toast('生成大綱中');
  try{
    const sys='你是簡報架構師。只輸出 Markdown，不要任何開場白、結語或 markdown 圍籬。';
    const out = await ask(sys, buildPrompt());
    S.md = mergeMonthlyComputedPages(String(out).replace(/```(markdown)?/gi,'').trim());
    S.outlineBasis='';
    saveDraft(); done();
    const el2=document.getElementById('wMD');
    if(el2){ el2.dispatchEvent(new Event('input',{bubbles:true})); }
    S.outlineBasis=wizardBasis(); saveDraft(); refreshWizardCheckpoint();
  }catch(e){ fail(e.message); }
}

function finishWizard(){
  if(S.styleReturnSession&&S.styleReturnSession.basis===S.md){
    S.slides=JSON.parse(JSON.stringify(S.styleReturnSession.slides));
    S.cursor=Math.min(S.styleReturnSession.cursor,Math.max(0,S.slides.length-1));
    delete S.styleReturnSession;S.wizardPreviewCache=null;S.wizard=false;S.view='editor';S.tab='text';
    saveDraft();render();
    S.reviewPreviewWarning='';
    return;
  }
  const el=document.getElementById('wMD'); if(el) S.md=el.value;
  syncStep();
  const blocked=firstBlockedStep(5);
  if(blocked){ S.step=blocked.step; return fail('步驟 '+blocked.step+' 尚未完成：'+blocked.msg); }
  const finalCheck=wizardCheckpoint(5);
  if(!finalCheck.ok){ S.step=5; return fail('步驟 5 尚未完成：'+finalCheck.msg); }
  if(!S.outlineBasis) S.outlineBasis=wizardBasis();
  try{
    const slides=wizardPreviewDeck().map(s=>JSON.parse(JSON.stringify(s)));
    if(!S.topic) S.topic=slides[0].title||'未命名簡報';
    slides.forEach(s=>s.footer=clipText(S.topic||'',24));
    S.slides=attachSourceNotes(markMissingDataPages(slides)); S.cursor=0;
    S.wizard=false; S.maxStep=5; S.view='editor'; S.tab='text'; S.reviewFlow=true; LS.set('wizardDone',true); saveDraft(); render();
    S.reviewPreviewWarning='';
  }catch(e){ fail(e.message); }
}

function outlineMappingLabel(slide){
  if(!slide)return '';
  const origin=slide.autoCover?'依情境補入封面':slide.outlinePage?'對應大綱第 '+slide.outlinePage+' 頁：'+(slide.outlineTitle||slide.title):'';
  return '<div class="hint">'+esc([origin,slide.autoSplit?'內容較多，依序續頁': '',slide.autoLayoutReason||''].filter(Boolean).join(' ｜ '))+'</div>';
}

function chooseContentLayout(slide){
  // Preserve explicit cover/chart/quote/stat/column layouts and every source field.
  if(slide.layout!=='bullets')return slide;
  const items=slide.bullets||[],topic=[slide.title,slide.kicker].filter(Boolean).join(' ');
  const compact=items.every(b=>String(b.h||'').length<=24&&String(b.d||'').length<=140);
  if(items.length===2&&compact&&/比較|對照|差異|優缺|\bvs\b/i.test(topic)){
    slide.layout='twoCol';
    slide.columns=items.map(b=>({h:b.h||'內容',items:b.d?[b.d]:[]}));
    slide.autoLayoutReason='兩組比較內容，採左右對照';
  }else slide.autoLayoutReason=items.length===2&&!compact?'比較文字較長，保留上下條列避免雙欄擠壓':'依大綱順序呈現，每頁優先五項；不憑數字猜測圖表或統計版型';
  return slide;
}

function wizardPreviewDeck(){
  if(S.styleReturnSession){if(S.styleReturnSession.basis===S.md)return S.styleReturnSession.slides;delete S.styleReturnSession;}
  const key=JSON.stringify([S.md,S.topic,S.audience,S.scenario,S.pages,rulesObj(),S.templateRevision||0]);
  if(!S.wizardPreviewCache||S.wizardPreviewCache.key!==key){
    const slides=WorkflowUI.withBookends(prepareGeneratedSlides(parseMarkdownDeck(S.md||''),{confirmedOutline:true}).map(chooseContentLayout));
    S.wizardPreviewCache={key,slides};S.wizardPreviewIndex=0;
  }
  return S.wizardPreviewCache.slides;
}

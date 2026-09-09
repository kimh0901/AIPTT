function viewHome(){
  const st=previewStyle();
  const hasModel = S.cfg.provider==='ollama' ? true : !!S.cfg.key;
  const demo={layout:'bullets',title:'風格預覽',footer:'SLIDE FORGE',previewOnly:true,
    bullets:[{h:'版面由資料渲染',d:'文字保持可編輯'},{h:'配色來自風格庫',d:'隨時整份替換'}]};
  const hasDraft = S.slides.length>0;
  return `${topbar(false)}
  <div class="scroll" style="flex:1">
   <div style="max-width:1120px;margin:0 auto;padding:48px 28px 80px">
    <h1 style="font-size:clamp(30px,4vw,48px);line-height:1.18;margin:0 0 14px;font-weight:700;letter-spacing:-.5px;max-width:820px">
      照著五步走，完成一份能改的簡報</h1>
    <p style="color:var(--mute);font-size:16px;line-height:1.75;max-width:700px;margin:0 0 26px">
      從情境、素材、大綱到風格與母片，依序完成即可匯出 PowerPoint。第一次使用建議從五步流程開始。</p>

    <section style="border:2px solid var(--mark);background:linear-gradient(135deg,#24131C 0%,#111A22 72%);border-radius:12px;padding:24px;margin-bottom:24px">
      <div class="mono" style="font-size:13px;color:var(--mark);letter-spacing:1px;margin-bottom:8px">建議入口</div>
      <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">
        <div style="flex:1;min-width:280px">
          <h2 style="font-size:25px;line-height:1.35;margin:0 0 8px">五步簡報流程</h2>
          <div style="color:var(--mute);font-size:15px;line-height:1.7">系統會記住進度，離開後可從尚未完成的步驟繼續，不會改寫已完成的內容。</div>
        </div>
        <div style="display:flex;gap:9px;flex-wrap:wrap">
          <button class="btn pri" data-act="wizard" style="padding:13px 22px;font-size:16px">${S.maxStep>1?'繼續五步流程':'開始五步流程'}</button>
          ${hasDraft?`<button class="btn" data-act="resume" style="padding:13px 16px">直接編輯上次的 ${S.slides.length} 頁</button>`:''}
        </div>
      </div>
    </section>

    <details data-home-free ${S.homeFreeOpen?'open':''} style="border:1px solid var(--line);border-radius:10px;padding:0 18px 18px;margin-top:18px">
      <summary style="cursor:pointer;padding:17px 0;font-size:16px;font-weight:700;color:var(--paper)">熟悉操作？展開自由生成與自訂風格</summary>
      <div style="padding-top:6px">

    ${S.cfg.provider==='course'
      ? (S.cfg.key?'':`<div style="border:1px solid var(--cy);background:#0C2224;border-radius:10px;padding:14px 16px;margin-bottom:26px;font-size:13px;line-height:1.65">
          這場課程已經幫你準備好 AI 額度，你不用申請任何金鑰，只要填一次課程通行碼。
          <button class="btn sm" data-act="settings" style="margin-left:8px">填通行碼</button></div>`)
      : (!S.cfg.key&&S.cfg.provider!=='ollama'?`<div style="border:1px solid var(--cy);background:#0C2224;border-radius:10px;padding:14px 16px;margin-bottom:26px;font-size:13px;line-height:1.65">
          不用金鑰也能用完整功能。按「產生指令」複製一段話，貼到你平常在用的 ChatGPT 或 Gemini，回覆貼回來就能排版、存成 PowerPoint。
          <div style="margin-top:8px;color:var(--mute);font-size:14px">想省下這道手續，到
            <button class="btn sm" data-act="settings" style="margin:0 4px">設定</button>填一組金鑰就能在這頁直接生成。</div></div>`:'')}

    <div class="home-grid" style="display:grid;grid-template-columns:1.15fr 1fr;gap:34px;align-items:start">
      <div class="card">
        <div class="lbl">要做什麼簡報</div>
        <textarea id="fBrief" placeholder="會議記錄、需求文件、講稿，或直接寫一句「做一份向量資料庫選型的簡報給主管看」都可以。" style="min-height:190px;font-size:14.5px">${esc(S.brief)}</textarea>
        <div class="hint">頁數、對象、語氣、風格會從內容判斷，不用先填。</div>
        ${sourceLibraryBox()}

        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          ${hasModel
            ? `<button class="btn pri full" data-act="brief" ${S.busy?'disabled':''} style="padding:13px 15px;font-size:14px">
                 ${S.busy?'生成中…':'生成簡報'}</button>
               <button class="btn" data-act="ownai" title="改用你慣用的 AI">換我的 AI</button>`
            : `<button class="btn pri full" data-act="ownai" style="padding:13px 15px;font-size:14px">
                 產生指令</button>`}
          <button class="btn" data-act="local" title="不呼叫模型，用本地範本開一份骨架">範本</button>
        </div>

        <button data-act="adv" style="background:none;border:none;color:var(--mute);cursor:pointer;font-size:14px;
          font-family:inherit;padding:14px 0 0;display:flex;align-items:center;gap:6px">
          <span class="mono" style="font-size:12.5px">${S.adv?'▾':'▸'}</span> 想自己指定對象、語氣、頁數</button>

        ${S.adv?`<div style="border-top:1px solid var(--line);margin-top:12px;padding-top:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div class="field"><div class="lbl">對象</div>
              <input type="text" id="fAud" value="${esc(S.audience)}" placeholder="留空＝自動判斷"></div>
            <div class="field"><div class="lbl">語氣</div>
              <input type="text" id="fTone" value="${esc(S.tone)}" placeholder="留空＝自動判斷"></div>
          </div>
          <div class="field"><div class="lbl">頁數　${S.pages?S.pages:'自動'}</div>
            <input type="number" id="fPages" min="0" step="1" value="${S.pages}">
            <div class="hint">0 代表自動判斷；指定頁數不設程式上限，但頁數越多越容易受到 AI 輸出額度限制。</div></div>
          <div class="field"><div class="lbl">參考素材（另外附加的檔案）</div>${materialBox()}
            <div class="hint">${S.materials.length?`已載入 ${S.materials.length} 份，共 ${allChunks().length} 個片段`:'上面那個框已經夠用；這裡是要另外附加檔案時才需要'}</div></div>
        </div>`:''}
      </div>

      <div>
        <div class="lbl">風格庫</div>
        ${styleBox()}
        <div style="margin-top:20px;border:1px solid var(--line);border-radius:10px;overflow:hidden">
          <div class="frame"><div class="stage">${renderSlide(demo,st,2,7,false)}</div></div>
        </div>
      </div>
    </div>
      </div>
    </details>
   </div>
  </div>`;
}

function topbar(inEditor){
  const doneN = S.slides.filter(s=>s.status!=='draft').length;
  return `<div class="app-toolbar" style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--line);background:var(--panel);flex:0 0 auto">
    ${inEditor?`<button class="mono" data-act="home" style="background:none;border:none;color:var(--mute);cursor:pointer;font-size:14px;letter-spacing:1px;padding:6px">← 專案</button>
      <div style="font-weight:600;font-size:14px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(S.topic||'未命名簡報')}</div>
      <div class="mono" style="font-size:13px;color:var(--mute)">${doneN}/${S.slides.length} 已生成</div>`
     :`<div style="font-size:15px;font-weight:700;color:var(--paper)">${S.wizard?'':'Slide Forge'}</div>`}
    <div style="flex:1"></div>
    ${usage().n?`<span class="mono" style="font-size:13px;color:var(--mute)">今日 ${usage().n} 次</span>`:''}
    ${inEditor?`<button class="btn sm" data-act="present">預覽</button>
      ${aiReady()?`<button class="btn sm" data-act="regen" ${S.busy?'disabled':''}>重生本頁（1 次）</button>
      <button class="btn sm" data-act="genAll" ${S.busy?'disabled':''}>逐頁精修（${S.slides.length} 次）</button>`:''}
      <button class="btn sm" data-act="chartAi">＋ 圖表</button>
      <button class="btn sm pri" data-act="tabExport">匯出</button>`:''}
    <button class="btn sm" data-act="settings">${S.cfg.key?'設定':'設定金鑰'}</button>
  </div>`;
}

function viewEditor(){
  const st=previewStyle(), cur=S.slides[S.cursor];
  const rail = S.slides.map((s,i)=>`
    <div class="rail-item ${i===S.cursor?'is-active':''}" style="margin-bottom:10px">
      <button data-act="go" data-i="${i}" aria-label="選擇第 ${i+1} 頁：${esc(s.title||'未命名頁面')}" title="選擇第 ${i+1} 頁" style="width:100%;padding:0;border:2px solid ${i===S.cursor?'var(--mark)':'transparent'};border-radius:5px;overflow:hidden;cursor:pointer;background:none;display:block">
        <div class="frame"><div class="stage">${renderSlide(s,st,i,S.slides.length,false)}</div></div>
      </button>
      <div class="mono" style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--mute);margin-top:5px">
        <span>${String(i+1).padStart(2,'0')} ${LAYOUTS[s.layout]}</span>
        <span style="color:${s.status==='draft'?'var(--mute)':s.status==='edited'?'var(--cy)':'var(--mark)'}">${s.status==='draft'?'草稿':s.status==='edited'?'已改':'已生成'}</span>
      </div>
      <div style="display:flex;gap:4px;margin-top:4px">
        <button class="btn xs" data-act="up" data-i="${i}">↑</button>
        <button class="btn xs" data-act="down" data-i="${i}">↓</button>
        <button class="btn xs" data-act="dup" data-i="${i}">複製</button>
        <button class="btn xs" data-act="del" data-i="${i}">刪</button>
      </div>
    </div>`).join('');

  let insp='';
  if(S.tab==='outline' && cur){
    insp = `<div style="border:1px solid var(--cy);border-radius:9px;padding:12px;margin-bottom:14px;background:#0C2224">
        <div style="font-size:15px;font-weight:700;color:var(--paper);margin-bottom:5px">依第 ${S.cursor+1} 頁內容新增圖表</div>
        <div class="hint" style="margin-bottom:9px">不需要先按上方「＋ 圖表」，可直接從這裡開始。</div>
        <button class="btn pri full" data-act="chartAi">生成圖表</button></div>
      <div class="field"><div class="lbl">這頁的講稿</div>
        <textarea id="fNote" style="min-height:82px">${esc(cur.note||'')}</textarea></div>
      <div class="field"><div class="lbl">局部修改指令</div>
        <textarea id="fIns" style="min-height:70px" placeholder="例：第二點改從成本角度講、語氣再直接一點">${esc(S.instruction)}</textarea>
        <div class="hint">只改這一頁。</div></div>
      ${aiReady()
        ? `<button class="btn pri full" data-act="revise" ${S.busy?'disabled':''}>套用修改</button>`
        : `<div style="border:1px solid var(--line);border-radius:6px;padding:12px;font-size:14px;color:var(--mute);line-height:1.7">
            要直接在網站生成，請先在設定選擇 Gemini、OpenAI GPT、Claude 或其他服務並填入金鑰。不填也沒關係，仍可直接改文字或使用複製貼回。
            <button class="btn sm" data-act="settings" style="margin-top:8px">前往設定</button></div>`}
      <div class="lbl" style="margin-top:22px">全篇大綱</div>
      ${S.slides.map((s,i)=>`<button data-act="go" data-i="${i}" style="display:block;width:100%;text-align:left;background:${i===S.cursor?'var(--line)':'transparent'};border:none;border-left:3px solid ${i===S.cursor?'var(--mark)':'var(--line)'};padding:9px 10px;cursor:pointer;color:var(--paper);font-size:14.5px;margin-bottom:3px;line-height:1.5">
        <span class="mono" style="color:var(--mute);margin-right:7px">${String(i+1).padStart(2,'0')}</span>${esc(s.title)}</button>`).join('')}`;
  }else if(S.tab==='material'){
    const hits = cur? retrieve(allChunks(), cur.title+' '+(cur.bullets||[]).map(b=>b.h).join(' ')):[];
    insp = materialBox()+`<div class="hint" style="margin-top:14px">重新生成某一頁時，會拿那頁的標題去素材裡找最相關的三段。</div>`+
      (hits.length?`<div class="lbl" style="margin-top:20px">本頁命中片段</div>`+hits.map(h=>
        `<div style="border:1px solid var(--line);border-radius:6px;padding:10px;margin-bottom:8px">
          <div class="mono" style="font-size:12.5px;color:var(--cy);margin-bottom:6px">${esc(h.src)} ／ 相關度 ${(h.score*100).toFixed(0)}%</div>
          <div style="font-size:14px;color:var(--mute);line-height:1.65">${esc(h.text.slice(0,160))}…</div></div>`).join(''):'');
  }else if(S.tab==='text' && cur){
    insp = textPanel(cur,st);
  }else if(S.tab==='chart' && cur){
    insp = chartPanel(cur);
  }else if(S.tab==='style'){
    insp = `<h3 class="style-section-title">整份簡報的風格</h3><p class="hint">這裡影響全篇。本頁文字、圖表與版面請在畫布下方或對應分頁調整。</p>`+templateBox()+`<details class="style-options" ${S.pptTemplate?'':'open'}><summary>網站配色與 AI 風格</summary>${styleBox()}</details><div class="hint" style="margin-top:12px">換風格會套用到所有頁面，內容不動。若已上傳 PPTX 母片，下載時以母片的字型與配色優先。</div>`;
  }else{
    const templateInfo=templateModeInfo(S.pptTemplate);
    insp = `<div class="field"><div class="lbl">PowerPoint</div>
        <div style="border:1px solid var(--line);border-radius:7px;padding:10px 12px;margin-bottom:10px;font-size:14px;line-height:1.65;color:var(--mute)">
          預計檔名：<b style="color:var(--paper)">${esc(pptxFileName())}</b><br>
          編輯器頁數：<b style="color:var(--paper)">${S.slides.length} 頁</b><br>
          ${S.pptTemplate?'已上傳 PPTX，匯出會優先沿用原始母片、背景、Logo、頁尾、字型與配色。':'尚未上傳 PPTX；仍可匯出，但會使用網站風格，無法取得 White and Blue 樣板的母片與背景。'}
        </div>
        ${S.pptTemplate?`<div style="border:1px solid var(--cy);background:#0C2224;color:var(--cy);border-radius:7px;padding:10px 12px;margin-bottom:10px;font-size:14px;line-height:1.6">✓ 已載入版型：${esc(S.pptTemplate.name)}<br><b style="color:var(--paper)">匯出套用方式：${esc(templateInfo.label)}</b><br><span style="color:var(--mute)">${esc(templateInfo.detail)}</span></div>`:''}
        <button class="btn pri full" data-act="pptx" ${S.busy?'disabled':''}>匯出可編輯 PPTX</button>
        <div class="hint">每個文字方塊與圖表都可在 PowerPoint 編輯，講稿放在備忘稿。${S.pptTemplate?'匯出時會依上方顯示的安全模式處理版型；若原版面空間不足，會先要求調整或建立續頁，不會用新框覆蓋母片。':'第一次匯出要等幾秒載入。'}</div></div>
      <div class="field"><div class="lbl">大綱</div>
        <button class="btn full" data-act="md">匯出大綱 Markdown</button></div>`;
  }

  return `${topbar(true)}
  <div class="editor-shell" style="display:flex;flex:1;min-height:0">
    <div id="rail" class="scroll" style="width:168px;border-right:1px solid var(--line);padding:10px;background:var(--panel);flex:0 0 auto">
      ${rail}<button class="btn sm full rail-add" data-act="add">＋ 新增一頁</button>
    </div>
    <div class="scroll editor-canvas" style="flex:1;min-width:0;padding:26px;display:flex;flex-direction:column;align-items:center;gap:14px">
      <div class="editor-preview-card" style="width:100%;max-width:880px;border:1px solid var(--line);border-radius:8px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45)">
        <div class="frame"><div class="stage" id="mainStage">${cur?renderSlide(cur,st,S.cursor,S.slides.length,true):''}</div></div>
        ${S.pptTemplate?`<details class="template-edit-controls"><summary>編輯本頁母片與文字區域 <span>選版、縮字方式、避開插圖</span></summary><div style="display:grid;gap:8px;padding:14px;background:#101821;border-top:1px solid var(--line)">
          ${templateChoicePanel(cur)}
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <button class="chip ${S.tplPreview?'on':''}" data-act="tplPreview">${S.tplPreview?'✓ 套版預覽已開啟':'切換成套版預覽'}</button>
            <button class="chip" data-act="autoTemplateCurrent">本頁重新自動配版</button>
            <button class="chip" data-act="refreshTplPreview">重新整理預覽</button>
            <span class="hint" style="margin:0">${S.tplPreview?'可直接點虛線文字框修改；完整母片的 Logo／頁尾以匯出檔為準。':'目前顯示網站版型。'}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px">
            <label class="hint" style="margin:0">本頁母片版面
              <select id="previewTemplateLayout" style="margin-top:4px;min-height:36px;font-size:14px;padding:5px 8px">
                <option value="">自動（依內容選擇）</option>
                ${(S.pptTemplate.layouts||[]).map(l=>`<option value="${esc(l.path)}" ${cur&&cur.templateLayoutPath===l.path?'selected':''}>${esc(l.name)} · ${esc(l.role)}</option>`).join('')}
              </select></label>
            ${S.pptTemplate.designMode?`<label class="hint" style="margin:0">本頁範例設計
              <select id="previewDesign" style="margin-top:4px;min-height:36px;font-size:14px;padding:5px 8px">
                <option value="">自動（依內容選擇）</option>
                ${(S.pptTemplate.designSlides||[]).map(d=>`<option value="${d.index}" ${cur&&Number(cur.designIndex)===d.index?'selected':''}>樣板第 ${d.index} 頁</option>`).join('')}
              </select></label>`:''}
          </div>
        </div></details>`:''}
      </div>
      <div style="width:100%;max-width:880px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="mono" style="font-size:13px;color:var(--mute)">版型</span>
        <button class="chip" data-act="autoArrangeDeck">依內容整理全篇版型</button>
        ${Object.keys(LAYOUTS).filter(k=>k!=='chart').map(k=>`<button class="chip ${cur&&cur.layout===k?'on':''}" data-act="layout" data-k="${k}">${LAYOUTS[k]}</button>`).join('')}
        <span style="flex:1"></span>
        <button class="btn sm" data-act="undo" ${cur&&(cur.history||[]).length?'':'disabled'}>復原</button>
      </div>
      <div style="width:100%;max-width:880px;font-size:14px;color:var(--mute);line-height:1.7">
        點畫面上的文字就能改，滑鼠移開就存好了。切換版型只重新安排內容，不會刪除原始資料。</div>
    </div>
    <div id="insp" style="width:320px;border-left:1px solid var(--line);background:var(--panel);display:flex;flex-direction:column;flex:0 0 auto">
      <div style="display:flex;border-bottom:1px solid var(--line)">
        ${[['outline','大綱'],['material','素材'],['chart','圖表'],['text','文字'],['style','風格'],['export','匯出']].map(([k,v])=>
          `<button data-act="tab" data-k="${k}" style="flex:1;min-height:44px;padding:11px 0;background:none;border:none;cursor:pointer;font-size:15px;font-weight:700;color:${S.tab===k?'var(--paper)':'var(--mute)'};border-bottom:3px solid ${S.tab===k?'var(--mark)':'transparent'}">${v}</button>`).join('')}
      </div>
      <div class="scroll" style="flex:1;padding:16px">${insp}</div>
    </div>
  </div>`;
}

function viewOwnAI(){
  const p=buildPrompt();
  return `<div class="modal" data-act="closeModal"><div class="box" data-stop="1" style="width:min(720px,100%)">
    <div style="display:flex;align-items:center;margin-bottom:6px">
      <div style="font-size:17px;font-weight:700">用你自己的 AI</div><span style="flex:1"></span>
      <button data-act="closeModal" style="background:none;border:none;color:var(--mute);font-size:20px;cursor:pointer">×</button></div>
    <div class="hint" style="margin-bottom:16px">複製下面的指令，貼到你平常在用的 ChatGPT、Claude 或 Gemini，再把回覆貼回來就好。</div>

    <div class="lbl">一、複製這段指令</div>
    <textarea id="promptOut" style="min-height:150px;font-size:15px;line-height:1.7">${esc(p)}</textarea>
    <div style="display:flex;gap:8px;margin:8px 0 20px">
      <button class="btn sm pri" data-act="copyPrompt">複製指令</button>
      <button class="btn sm" data-act="editRules">${S.rulesOpen?'收起規範':'調整簡報規範'}</button>
    </div>
    ${S.rulesOpen?`<div class="field"><div class="lbl">簡報規範 Rules</div>
      <textarea id="rulesBox" style="min-height:150px;font-size:15px;line-height:1.7">${esc(S.rules||buildRulesText())}</textarea>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn sm" data-act="saveRules">存起來</button>
        <button class="btn sm" data-act="resetRules">回復預設</button></div>
      <div class="hint">改完存在這台電腦，之後每次產生指令都會帶上。${S.rulesEdited?'<br><span style="color:var(--cy)">目前是手動編輯的版本，精靈步驟三的表單不會再覆蓋它；要改回自動產生請按「回復預設」。</span>':''}</div></div>`:''}

    <div class="lbl">二、把回覆貼回這裡</div>
    <textarea id="pasteBack" placeholder="# 頁標題&#10;> 核心結論&#10;- 條列一&#10;- 條列二" style="min-height:150px;font-size:15px;line-height:1.7"></textarea>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn pri full" data-act="importPasted">轉成簡報</button>
    </div>
    <div class="hint">認得 # 標題、&gt; 核心結論、- 條列這種寫法，粗體標題或編號清單也可以。</div>
  </div></div>`;
}

function viewChartAI(){
  const ready=aiReady();
  const cur=S.slides[S.cursor]||{}, summary=cur.kicker||cur.title||'未命名頁面';
  const setup=chartDraftSetup(cur), hasTable=!!setup.table, inline=slideNumberSeries(cur), evidence=chartEvidencePlan(cur);
  const p=buildChartPrompt();
  const route=hasTable?'本頁可搭配已上傳的數值資料，系統會優先選出最能支撐本頁論點的資料表與欄位。':
    inline?'本頁已有可直接使用的明示數值，系統只會採用這些數字，不會補造資料。':'本頁沒有足夠的可信數值，系統會把重點整理成內容結構圖，不會要求先上傳 Excel／CSV，也不會虛構數字。';
  const typeName={column:'柱狀圖',bar:'橫條圖',line:'折線圖',doughnut:'圓環圖',content:'內容結構圖'}[setup.type]||'內容結構圖';
  const tableEditor=hasTable?`<div style="border-top:1px solid var(--line);margin-top:16px;padding-top:15px">
      <div style="font-size:15px;font-weight:700;margin-bottom:9px">先確認圖表使用的資料</div>
      <div class="chart-form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label style="grid-column:1/-1"><span class="lbl">資料表</span><select data-chart-table style="width:100%;min-height:42px;font-size:14px">
          ${setup.tables.map(t=>`<option value="${esc(t.id)}" ${t.id===setup.table.id?'selected':''}>${esc(t.title)} · ${(t.rows||[]).length} 列</option>`).join('')}</select></label>
        <label><span class="lbl">分類欄位</span><select id="chartCategoryPick" style="width:100%;min-height:42px;font-size:14px">
          ${setup.categories.map(c=>`<option value="${c.index}" ${c.index===setup.categoryIndex?'selected':''}>${esc(c.name)} · ${c.count} 種</option>`).join('')}</select></label>
        <label><span class="lbl">主要數值</span><select id="chartValuePick" style="width:100%;min-height:42px;font-size:14px">
          ${setup.numeric.map(c=>`<option value="${c.index}" ${c.index===setup.valueIndex?'selected':''}>${esc(c.name)}${c.unit?' · '+esc(c.unit):''}</option>`).join('')}</select></label>
        <label><span class="lbl">第二數值（選用）</span><select id="chartValuePick2" style="width:100%;min-height:42px;font-size:14px"><option value="-1">不加入</option>
          ${setup.numeric.filter(c=>c.index!==setup.valueIndex).map(c=>`<option value="${c.index}">${esc(c.name)}${c.unit?' · '+esc(c.unit):''}</option>`).join('')}</select></label>
        <label><span class="lbl">圖表類型</span><select id="chartTypePick" style="width:100%;min-height:42px;font-size:14px">
          ${[['column','柱狀圖｜項目比較'],['bar','橫條圖｜排名或長標籤'],['line','折線圖｜時間趨勢'],['doughnut','圓環圖｜少數占比']].map(([k,v])=>`<option value="${k}" ${k===setup.type?'selected':''}>${v}</option>`).join('')}</select></label>
        <label><span class="lbl">顯示筆數</span><input id="chartLimitPick" type="number" min="3" max="10" value="${setup.limit}" style="width:100%"></label>
        <label style="grid-column:1/-1"><span class="lbl">圖表標題</span><input id="chartTitlePick" value="${esc(clipText(cur.title||'資料比較',20))}" maxlength="24" style="width:100%"></label>
      </div>
      <div class="hint" style="margin:10px 0">排名會由高至低；時間欄位保持原始順序。圓環圖只使用主要數值，負數會自動改為柱狀圖。</div>
      <button class="btn pri full" data-act="chartBuildManual">依這些欄位建立可編輯圖表</button>
    </div>`:(setup.tables.length?`<details style="margin:14px 0"><summary>改由我指定資料表</summary><label>本頁未自動配對；確認相關性後可手動選擇<select data-chart-table style="width:100%"><option value="" selected disabled>請選擇資料表</option>${setup.tables.map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}</select></label></details>`:'');
  const evidenceBox=evidence.hit?`<div style="border:1px solid var(--line);border-radius:8px;padding:11px 13px;margin:0 0 14px;font-size:14px;line-height:1.65">
      <span class="lbl">內容對應校驗</span><b style="color:var(--paper)">${esc(evidence.confidenceLabel)}</b>｜${esc(evidence.hit.table.title)}<br>
      建議分類：${esc(evidence.categoryName||'請確認')}｜建議指標：${esc(evidence.valueColumn&&evidence.valueColumn.name||'請確認')}
      ${evidence.locked?'｜已鎖定，不讓 AI 改選資料表':''}</div>`:'';
  return `<div class="modal chart-dialog" data-act="closeModal"><div class="box" data-stop="1" style="width:min(760px,100%)">
    <div style="display:flex;align-items:center;margin-bottom:6px"><div style="font-size:17px;font-weight:700">根據第 ${S.cursor+1} 頁內容生成圖表</div><span style="flex:1"></span>
      <button data-act="closeModal" style="background:none;border:none;color:var(--mute);font-size:20px;cursor:pointer">×</button></div>
    <div style="border:1px solid var(--line);border-radius:8px;padding:14px;margin:12px 0 18px;font-size:14.5px;line-height:1.75;color:var(--mute)">
      <div style="color:var(--paper);font-weight:600;margin-bottom:4px">本頁重點：${esc(summary)}</div>
      ${esc(route)}新頁會插在本頁後面，原始簡報大綱與講稿保持不變。</div>
    <div class="chart-summary-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;font-size:14.5px">
      <div style="padding:10px;border:1px solid var(--line);border-radius:7px"><span class="lbl">資料來源</span><b style="display:block;color:var(--paper)">${hasTable?'上傳資料表':inline?'本頁明示數值':'本頁文字內容'}</b></div>
      <div style="padding:10px;border:1px solid var(--line);border-radius:7px"><span class="lbl">依目前設定將產生</span><b id="chartResolvedType" style="display:block;color:var(--paper)">${esc(typeName)}</b></div>
      <div style="padding:10px;border:1px solid var(--line);border-radius:7px"><span class="lbl">實際圖表項目</span><b id="chartResolvedCount" style="display:block;color:var(--paper)">正在核對</b>${hasTable?`<span class="hint">原始資料：${setup.table.rows.length} 列</span>`:''}</div>
    </div>
    <div id="chartResolvedDetail" role="status"></div>
    ${evidenceBox}
    <label style="display:grid;grid-template-columns:120px 1fr;gap:10px;align-items:center;margin-bottom:14px"><span class="lbl" style="margin:0">新圖表模板</span>
      <select data-chart-style-default style="width:100%;min-height:42px;font-size:14px">${!BUILTIN_CHART_STYLES.some(x=>x.id===(S.chartStyleDefault||'auto'))?`<option value="${esc(S.chartStyleDefault)}" selected>目前擷取的 PPTX 圖表風格</option>`:''}${BUILTIN_CHART_STYLES.map(x=>`<option value="${x.id}" ${x.id===(S.chartStyleDefault||'auto')?'selected':''}>${esc(x.name)}｜${esc(x.desc)}</option>`).join('')}</select></label>
    ${tableEditor}
    ${ready?`<div style="border-top:1px solid var(--line);margin-top:16px;padding-top:15px"><button class="btn full" data-act="chartSuggest" ${S.busy?'disabled':''}>依目前設定，請 ${esc(modelLabel())} 協助生成</button>
      <div class="hint" style="margin-top:8px">AI 依本頁標題、重點及講稿建議圖表；您調整過的欄位會優先保留。實際數值由網站讀表，關鍵詞不足時改用本頁內容結構圖。</div></div>`:''}
    <details style="margin-top:16px"><summary style="cursor:pointer;font-size:15px;font-weight:700;margin-bottom:10px">使用外部 AI 複製貼回</summary>
      <div class="lbl">一、複製本頁圖表任務</div>
      <textarea id="promptOut" readonly style="min-height:150px;font-size:14px;line-height:1.7">${esc(p)}</textarea>
      <button class="btn sm" data-act="copyPrompt" style="margin:8px 0 16px">複製指令</button>
      <div class="lbl">二、貼回 AI 產生的圖表內容</div>
      <textarea id="chartPaste" placeholder="請貼上 AI 回覆的完整內容，不需要自行修改格式" style="min-height:110px;font-size:14px;line-height:1.7"></textarea>
      <button class="btn pri full" data-act="importChartSpec" style="margin-top:10px">加入可編輯圖表頁</button>
    </details>
    ${!hasTable?`<button class="btn pri full" data-act="chartQuick" style="margin-top:12px">${inline?'使用本頁明示數值建立圖表':'建立本頁內容結構圖'}</button>`:''}
  </div></div>`;
}

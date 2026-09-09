function viewSettings(){
  const c=S.cfg, p=PROVIDERS[c.provider], u=usage();
  return `<div class="modal" data-act="closeModal"><div class="box" data-stop="1">
    <div style="display:flex;align-items:center;margin-bottom:18px">
      <div style="font-size:17px;font-weight:700">模型設定</div><span style="flex:1"></span>
      <button class="del" data-act="closeModal" style="background:none;border:none;color:var(--mute);font-size:20px;cursor:pointer">×</button></div>

    <div style="border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:18px;font-size:14px;line-height:1.75;color:var(--mute)">
      金鑰只會直接送到你選擇的 AI 服務。預設只保留到這個瀏覽器分頁關閉；共用電腦不要勾選記住金鑰。</div>
    ${c.provider==='openai'?`<div style="border:1px solid #E7A83E;background:#2A2112;color:#FFD993;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:14px;line-height:1.7">
      OpenAI 官方不建議在瀏覽器保存或直接使用 API 金鑰。本選項只供本機個人測試；GitHub Pages 正式版請透過自己的後端代理，或使用下方的 ChatGPT 複製貼回流程。</div>`:''}

    <div class="lbl">供應商</div>
    <div style="display:grid;gap:6px;margin-bottom:16px">
      ${Object.keys(PROVIDERS).filter(k=> k!=='course' || COURSE_ENDPOINT).map(k=>{
        const q=PROVIDERS[k];
        return `<button data-act="prov" data-k="${k}" style="display:flex;align-items:center;gap:8px;text-align:left;
          background:${c.provider===k?'var(--line)':'transparent'};border:1px solid ${c.provider===k?'var(--mark)':'var(--line)'};
          border-radius:6px;padding:9px 11px;cursor:pointer;color:var(--paper);font-size:13px;font-family:inherit">
          <span style="flex:1">${q.label}</span>
          ${q.free?`<span class="mono" style="font-size:12.5px;color:var(--cy);border:1px solid var(--cy);border-radius:3px;padding:3px 6px">${q.free}</span>`:''}
        </button>`;}).join('')}
    </div>
    <div class="hint" style="margin:-8px 0 16px">${esc(p.note)}${p.keyUrl?` <a href="${p.keyUrl}" target="_blank" rel="noopener" style="color:var(--cy)">申請 / 下載</a>`:''}</div>

    ${c.provider==='course'?`
    <div class="field"><div class="lbl">課程通行碼</div>
      <input type="password" id="cKey" value="${esc(c.key)}" placeholder="向課程主辦方索取" autocomplete="off"></div>
    <div class="field"><div class="lbl">要用哪個 AI</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${COURSE_MODELS.map(m=>`<button class="chip ${c.model===m.key?'on':''}" data-act="pickModel" data-k="${m.key}">${m.label}</button>`).join('')}</div>
      <div class="hint">主辦方可能只開放其中幾個，選到沒開放的會提示你換一個。</div></div>
    <input type="hidden" id="cBase" value="${esc(c.base)}">
    <input type="hidden" id="cModel" value="${esc(c.model)}">
    `:`
    <div class="field"><div class="lbl">API 金鑰</div>
      <input type="password" id="cKey" value="${esc(c.key)}" placeholder="${c.provider==='ollama'?'Ollama 不驗證，隨便填一個字':'貼上你的金鑰'}" autocomplete="off"></div>

    <div class="field"><div class="lbl">模型</div>
      <input type="text" id="cModel" value="${esc(c.model)}" list="modelList">
      <datalist id="modelList">${(p.models||[]).map(m=>`<option value="${m}">`).join('')}</datalist>
      ${(p.models||[]).length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">
        ${p.models.map(m=>`<button class="chip ${c.model===m?'on':''}" data-act="pickModel" data-k="${m}">${m}</button>`).join('')}</div>`:''}</div>

    <div class="field"><div class="lbl">端點</div>
      <input type="text" id="cBase" value="${esc(c.base)}"></div>
    `}

    <label style="display:flex;align-items:center;gap:10px;margin:4px 0 14px;font-size:15px;color:var(--paper)">
      <input type="checkbox" id="cRemember" ${S.rememberKey?'checked':''} ${c.provider==='openai'?'disabled':''}> 在這台電腦記住 API 金鑰${c.provider==='openai'?'（OpenAI 模式停用）':''}
    </label>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><div class="lbl">輸出上限（tokens）</div>
        <input type="number" id="cMax" value="${c.maxTokens}" min="500" max="16000" step="500"></div>
      <div class="field"><div class="lbl">請求間隔（毫秒）</div>
        <input type="number" id="cGap" value="${c.gapMs}" min="0" max="30000" step="1000"></div>
    </div>
    <div class="hint" style="margin-top:-8px">整份一次生成的輸出比較長，上限建議 6000 以上。間隔是為了避開「每分鐘幾次」的限制，免費額度留 6000 以上，本機 Ollama 填 0。</div>

    <div style="border:1px solid var(--line);border-radius:8px;padding:13px;margin-top:16px;font-size:14px;color:var(--mute);line-height:1.7">
      今天已送出 <span style="color:var(--paper);font-weight:600">${u.n}</span> 次請求
      <button class="btn sm" data-act="resetUsage" style="float:right;margin-top:-4px">歸零</button>
      <div class="hint" style="margin-top:6px">這是這台電腦自己數的，方便抓個大概，不是對方的實際計數。</div></div>

    <div style="border:1px solid var(--line);border-radius:8px;padding:13px;margin-top:16px;font-size:14px;color:var(--mute);line-height:1.7">
      這台電腦上的暫存資料
      <button class="btn sm ${S.confirmWipe?'danger':''}" data-act="clearLocalData" style="float:right;margin-top:-4px">${S.confirmWipe?'再按一次確定清除':'全部清除'}</button>
      <div class="hint" style="margin-top:6px">草稿、風格設定、規則、上傳的母片檔（存在 IndexedDB）、使用次數都留在這台電腦的這個瀏覽器裡，換電腦或換瀏覽器不會跟著走，也不會傳給別人。清除後會重新整理頁面，回到初始狀態。API 金鑰預設只存在分頁的 sessionStorage，關掉分頁就沒了。</div></div>

    <div style="border:1px solid var(--line);border-radius:8px;padding:13px;margin-top:16px;font-size:14px;color:var(--mute);line-height:1.7">
      外部程式庫（匯出 PPTX、解析 Word/PDF/Excel 需要）
      <button class="btn sm" data-act="checkLibs" style="float:right;margin-top:-4px">檢查連線</button>
      <div id="libStatus" style="margin-top:8px;line-height:1.8">${S.libStatus||'還沒檢查。解析檔案出現載入失敗時，按這裡看是哪個來源被擋。'}</div></div>

    <div style="display:flex;gap:8px;margin-top:18px">
      <button class="btn pri full" data-act="saveCfg">儲存</button>
      <button class="btn" data-act="testAI">測試 AI 連線</button>
      <button class="btn" data-act="clearKey">清除金鑰</button>
    </div>
  </div></div>`;
}


/* ============================================================================
   SLIDE FORGE — 單檔部署版
   資料全部留在使用者自己的瀏覽器，金鑰預設只放 sessionStorage，並只送到使用者選擇的 AI 服務。
   ========================================================================== */

/* ---------- 常數 ---------- */
const PRESETS = [
  {id:'blueprint',name:'藍圖',desc:'工程製圖感，深藍底細線網格',bg:'#0E2233',surface:'#143047',ink:'#EAF4FA',sub:'#7FA8C4',accent:'#3FD2C7',accent2:'#F5A524',rule:'#255273',grid:true,radius:2,serif:false,prompt:'語氣精準、工程導向，要點用名詞短語，避免形容詞堆疊。'},
  {id:'proof',name:'印刷樣張',desc:'紙白底、黑墨、洋紅標記',bg:'#F4F2ED',surface:'#FFFFFF',ink:'#16181C',sub:'#666B73',accent:'#E5197E',accent2:'#111318',rule:'#D5D1C8',grid:false,radius:0,serif:false,prompt:'語氣中性專業，像內部技術文件，句子短，不用行銷語言。'},
  {id:'midnight',name:'深夜霓虹',desc:'近黑底，青與洋紅高對比',bg:'#0B0B0F',surface:'#15151C',ink:'#F2F2F5',sub:'#8A8A99',accent:'#00E5C0',accent2:'#FF3D7F',rule:'#26262F',grid:false,radius:10,serif:false,prompt:'語氣有節奏感，標題短而有力，適合技術分享場合。'},
  {id:'field',name:'田野筆記',desc:'米白底、墨綠字，學術調性',bg:'#F2F1E9',surface:'#FBFAF5',ink:'#1E2B21',sub:'#5E6E62',accent:'#3F7D5B',accent2:'#B4652A',rule:'#D8D6C6',grid:false,radius:4,serif:true,prompt:'語氣沉穩，重視論證與資料來源，要點具體。'},
  {id:'bold',name:'巨型字體',desc:'白底黑字，黃色塊當重心',bg:'#FFFFFF',surface:'#FAFAFA',ink:'#0A0A0A',sub:'#5A5A5A',accent:'#FFD400',accent2:'#0A0A0A',rule:'#E4E4E4',grid:false,radius:0,serif:false,prompt:'語氣直接，每頁只講一件事，要點極短，最多八個字。'},
  {id:'sunrise',name:'晨光',desc:'漸暖底色，橘紅重點',bg:'#FFF6EE',surface:'#FFFFFF',ink:'#2A1D16',sub:'#7A6255',accent:'#E8622B',accent2:'#2F7D8C',rule:'#EBD9C9',grid:false,radius:8,serif:false,prompt:'語氣溫和好懂，適合對非技術聽眾說明。'}
];
const LAYOUTS = {cover:'封面',agenda:'目錄',bullets:'條列',twoCol:'雙欄對照',stat:'數據重點',chart:'資料圖表',quote:'引言',closing:'結尾'};
/* ============================================================
   課程主辦方請把這一行改成你的 Worker 網址，學員就不用自備金鑰。
   例：const COURSE_ENDPOINT = 'https://slideforge.你的帳號.workers.dev';
   留空的話，平台會退回「自備金鑰」與「用自己的 AI 工具」兩種模式。
   ============================================================ */
const COURSE_ENDPOINT = '';
const COURSE_MODELS = [
  {key:'gemini', label:'Gemini Flash'},
  {key:'geminiLite', label:'Gemini Flash-Lite'},
  {key:'claude', label:'Claude Sonnet'},
  {key:'claudeFast', label:'Claude Haiku'},
  {key:'gpt', label:'GPT'}
];

const PROVIDERS = {
  course:{label:'課程模式（不用自己準備金鑰）', proto:'proxy', free:'主辦方提供', vision:true,
    base:COURSE_ENDPOINT, model:'gemini', models:COURSE_MODELS.map(m=>m.key), keyUrl:'', rpm:0,
    note:'由課程主辦方統一提供模型額度，你只要填通行碼就能用。想換模型直接在上面選。'},
  gemini:{label:'Google Gemini', proto:'gemini', free:'免費額度', vision:true,
    base:'https://generativelanguage.googleapis.com', model:'gemini-3.5-flash-lite',
    models:['gemini-3.5-flash-lite','gemini-3.5-flash','gemini-3.1-flash-lite'],
    keyUrl:'https://aistudio.google.com/apikey', rpm:10,
    note:'申請金鑰不用信用卡。Flash-Lite 的每日次數最寬鬆，Flash 次之，Pro 在免費額度下幾乎只夠試用。Google 會調整額度，實際數字以官方頁面為準。'},
  openrouter:{label:'OpenRouter 免費模型', proto:'openai', free:'免費額度', vision:false,
    base:'https://openrouter.ai/api/v1', model:'openrouter/free',
    models:['openrouter/free'],
    keyUrl:'https://openrouter.ai/keys', rpm:20,
    note:'免費模型的 ID 結尾是 :free，名單會不定期輪動。填 openrouter/free 讓它自動挑一個還活著的。免費帳號大約每分鐘 20 次、每天 50 次。'},
  ollama:{label:'本機 Ollama', proto:'openai', free:'完全免費', vision:false,
    base:'http://localhost:11434/v1', model:'qwen3:8b',
    models:['qwen3:8b','llama3.1:8b','gemma3:12b'],
    keyUrl:'https://ollama.com/download', rpm:0,
    note:'模型跑在自己電腦上，沒有次數限制，資料也不外傳。需要先讓 Ollama 允許瀏覽器呼叫（設定 OLLAMA_ORIGINS=*），而且這個頁面最好也從本機開啟。金鑰欄位隨便填一個字即可。'},
  openai:{label:'OpenAI GPT（Responses API）', proto:'openaiResponses', free:'需 API 額度', vision:true,
    base:'https://api.openai.com/v1', model:'gpt-5-mini',
    models:['gpt-5-mini','gpt-5.4-mini'], keyUrl:'https://platform.openai.com/api-keys', rpm:0,
    note:'可使用 OpenAI GPT 的 Responses API；ChatGPT Plus／Pro 訂閱與 API 額度分開。瀏覽器直連只供本機個人測試，正式放在 GitHub Pages 時應改走自己的後端代理。'},
  compatible:{label:'其他 OpenAI 相容端點', proto:'openai', free:'依服務而定', vision:true,
    base:'https://api.groq.com/openai/v1', model:'',
    models:[], keyUrl:'', rpm:0,
    note:'Groq、OpenRouter 或自架服務可填在這裡，使用 Chat Completions 相容格式；端點必須允許瀏覽器呼叫（CORS）。'},
  anthropic:{label:'Anthropic', proto:'anthropic', free:'', vision:true,
    base:'https://api.anthropic.com', model:'claude-sonnet-4-5',
    models:['claude-sonnet-4-5','claude-haiku-4-5'],
    keyUrl:'https://console.anthropic.com/settings/keys', rpm:0,
    note:'品質最好，但沒有免費方案，claude.ai 的訂閱也不能用在 API 上。'}
};
const SERIF = "'Noto Serif TC',Georgia,serif";
const SANS  = "'IBM Plex Sans','Noto Sans TC',system-ui,sans-serif";
const PAGE_MIN=2, MAX_FILE_BYTES=30*1024*1024, MAX_TOTAL_UPLOAD_BYTES=80*1024*1024,
  MAX_TABLE_ROWS=5000, PROJECT_VERSION=6;
const clampNumber=(value,min,max,fallback)=>{
  const n=Number(value); return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
/* 截短標題與檔名時，不把 850 GWh、1,000 kWh、12.5% 等數值單位切成兩半。 */
/* @function clipText assets/js/core.js */

/* ---------- 狀態與儲存 ---------- */
const LS = {
  get(k,d){ try{ const v=localStorage.getItem('sf:'+k); return v===null?d:JSON.parse(v);}catch(e){return d} },
  set(k,v){ try{ localStorage.setItem('sf:'+k,JSON.stringify(v)); return true; }catch(e){
    setTimeout(()=>fail('瀏覽器儲存空間已滿，這次變更可能尚未保存。請移除不需要的長篇素材或較大的上傳檔案後再試一次。'),0); return false;
  } },
  del(k){ try{ localStorage.removeItem('sf:'+k); return true;}catch(e){return false} }
};
const uid = ()=>Math.random().toString(36).slice(2,9);
/* @function stripLegacyUploadBlocks assets/js/core.js */

let S = {
  view:'home', tab:'outline', cursor:0, busy:null, err:null, modal:null,
  topic:'', audience:'', tone:'', pages:0, instruction:'', brief:'', adv:false, homeFreeOpen:false, rulesOpen:false,
  rules: LS.get('rules',null),
  wizard: LS.get('wizardDone',false)?false:true, step:1, maxStep:1, scenario:null, prevScenario:null,
  md:'', mdBackup:'', outlineBasis:'', plan:'', uploads:[], globalUndo:null, uploadAssign:{},
  sourceMode:'latest',
  styleTab:'manual', msName:'', msBg:'#0E2233', msInk:'#EAF4FA', msAccent:'#3FD2C7', msRadius:0, msSerif:false,
  pptTemplate:null, templatePrefs:null, tplPreview:true, chartStyleLibrary:null, chartStyleDefault:'auto',
  styleId: LS.get('styleId','blueprint'),
  styles: PRESETS.concat(LS.get('customStyles',[])),
  materials: [], tables: [], slides: [],
  economy: LS.get('economy',true),
  cfg: Object.assign(
    COURSE_ENDPOINT
      ? {provider:'course',base:COURSE_ENDPOINT,model:'gemini',key:'',maxTokens:6000,gapMs:1500}
      : {provider:'gemini',base:PROVIDERS.gemini.base,model:PROVIDERS.gemini.model,key:'',maxTokens:6000,gapMs:7000},
    LS.get('cfg',{}))
};
S.rememberKey=!!LS.get('rememberKey',false);
S.rulesEdited=!!LS.get('rulesEdited',false);
/* 舊版的 openai 選項其實代表 Groq 等相容端點；自動搬到新的 compatible，避免更新後改用錯誤協定。 */
if(S.cfg.provider==='openai' && S.cfg.base && !/api\.openai\.com/i.test(S.cfg.base)) S.cfg.provider='compatible';
const sessionKeyName=provider=>'sf:apiKey:'+(provider||'gemini');
if(!S.rememberKey){
  try{ S.cfg.key=sessionStorage.getItem(sessionKeyName(S.cfg.provider))||sessionStorage.getItem('sf:apiKey')||''; }catch(e){ S.cfg.key=''; }
}
/* @function persistCfg assets/js/core.js */
/* Google 已停止讓新使用者呼叫 2.5 Flash-Lite。保留金鑰與其他設定，只移轉舊模型名稱。 */
if(S.cfg.provider==='gemini' && /^(models\/)?gemini-2\.5-flash-lite$/.test(S.cfg.model||'')){
  S.cfg.model=PROVIDERS.gemini.model;
  persistCfg();
}

/* 用量計數：讓人知道今天還剩多少免費額度 */
/* @function today assets/js/core.js */
/* @function usage assets/js/core.js */
/* @function bumpUsage assets/js/core.js */
const draft = LS.get('draft',null);
if(draft){
  Object.assign(S,{topic:draft.topic||'',audience:draft.audience||S.audience,tone:draft.tone||S.tone,
    pages:Number.isSafeInteger(Number(draft.pages))?Number(draft.pages):S.pages,
    materials:draft.materials||[],tables:draft.tables||[],slides:draft.slides||[],styleId:draft.styleId||S.styleId,
    brief:draft.manualBrief!==undefined?draft.manualBrief:stripLegacyUploadBlocks(draft.brief,draft.uploads),
    md:draft.md||'',mdBackup:draft.mdBackup||'',outlineBasis:draft.outlineBasis||'',scenario:draft.scenario||null,
    prevScenario:draft.prevScenario||draft.scenario||null,plan:draft.plan||'',
    uploads:draft.uploads||[],sourceMode:draft.sourceMode||'latest',uploadAssign:draft.uploadAssign||{},step:Math.min(5,Math.max(1,draft.step||1)),
    maxStep:Math.min(5,Math.max(1,draft.maxStep||draft.step||1)),
    tplPreview:draft.tplPreview!==false,templatePrefs:draft.templatePrefs||null,templateSessionEdits:draft.templateSessionEdits||{},
    chartStyleLibrary:draft.chartStyleLibrary||null,chartStyleDefault:draft.chartStyleDefault||'auto'});
  if(S.slides.length) S.wizard=false;
  S.uploads=(S.uploads||[]).map(u=>{
    if(!u.text&&Array.isArray(u.segments)&&u.segments.length){
      u.text=u.segments.map(s=>`【來源：${u.name}｜${u.kind==='pptx'?'投影片':'頁面'} ${s.page}】\n${s.text||''}`).join('\n\n').slice(0,80000);
      u.len=u.text.length;
    }
    return u;
  });
}
const curStyle = ()=>{
  const st=S.styles.find(s=>s.id===S.styleId)||S.styles[0];
  const radius=clampNumber(st&&st.radius,0,16,0);
  return st&&st.radius===radius?st:Object.assign({},st,{radius});
};
/* @function previewStyle assets/js/core.js */
const saveCustom = ()=> LS.set('customStyles', S.styles.filter(s=>!PRESETS.some(p=>p.id===s.id)));
const saveDraft = ()=> LS.set('draft',{v:PROJECT_VERSION,topic:S.topic,audience:S.audience,tone:S.tone,pages:S.pages,styleId:S.styleId,
  slides:(S.slides||[]).map(s=>Object.assign({},s,{history:[]})),materials:S.materials,tables:S.tables,
  brief:S.brief,manualBrief:S.brief,md:S.md,mdBackup:S.mdBackup,outlineBasis:S.outlineBasis,
  step:S.step,maxStep:S.maxStep,scenario:S.scenario,prevScenario:S.prevScenario,plan:S.plan,
  uploads:(S.uploads||[]).map(u=>{ const x=Object.assign({},u); delete x.block;
    if(Array.isArray(x.segments)&&x.segments.length) delete x.text; return x; }),sourceMode:S.sourceMode,uploadAssign:S.uploadAssign||{},
  templateSessionEdits:S.templateSessionEdits||{},
  tplPreview:S.tplPreview,templatePrefs:S.pptTemplate?{name:S.pptTemplate.name,key:S.pptTemplate.sessionKey,mapping:S.pptTemplate.mapping}:S.templatePrefs,
  chartStyleLibrary:S.chartStyleLibrary,chartStyleDefault:S.chartStyleDefault});
/* @function sourceYear assets/js/core.js */
/* @function enabledUploads assets/js/core.js */
/* @function activeUploads assets/js/core.js */
/* @function uploadBlock assets/js/core.js */
/* @function manualBrief assets/js/core.js */
/* 來源使用方式的單一對照表。UI 按鈕、政策文字與步驟提示都從這裡取，
   之後新增模式不會再有某一處漏改（舊版提示的模式名稱是寫死的字串）。 */
const SOURCE_MODES={
  latest:{label:'最新資料優先'},
  compare:{label:'跨年度比較',policy:'跨年度比較：保留各來源原始年份，不得把不同年度寫成同一時點。'},
  crosscountry:{label:'跨國比較',policy:'跨國比較：保留各資料原始國家，不得將不同國家寫在同一點；每一點只能描述一個國家（中央與地方也要分列）。'},
  selected:{label:'只用勾選來源',policy:'指定來源：只使用目前勾選的文件，不得引用未勾選資料。'}
};
/* @function sourceModeLabel assets/js/core.js */
/* @function sourcePolicyText assets/js/core.js */
/* @function buildSourceMaterial assets/js/core.js */
/* @function sourceMaterial assets/js/core.js */
/* @function activeTableIds assets/js/core.js */
/* @function availableTables assets/js/core.js */
/* @function slidePlainText assets/js/core.js */
/* @function sourceReference assets/js/core.js */
/* @function attachSourceNotes assets/js/core.js */

/* 缺件時在對應頁面的講稿補一行，讓「資料待補」在成品裡看得見。
   必須在 attachSourceNotes 之前呼叫，才會被保留在 [Sources·auto] 之前。 */
/* @function markMissingDataPages assets/js/core.js */

/* @function slideSourceLabels assets/js/core.js */
/* @function slideSourceFooter assets/js/core.js */
/* @function aiReady assets/js/core.js */
/* @function modelLabel assets/js/core.js */

/* @function set assets/js/core.js */
/* @function toast assets/js/core.js */
/* @function fail assets/js/core.js */
/* @function done assets/js/core.js */

/* ---------- 模型呼叫層（三種供應商） ---------- */
let lastCall = 0;
const sleep = ms => new Promise(r=>setTimeout(r,ms));

/* 免費額度通常卡在「每分鐘幾次」，所以呼叫之間強制留間隔 */
/* @function throttle assets/js/ai-client.js */

/* @function ask assets/js/ai-client.js */

/* @function askOnce assets/js/ai-client.js */
/* @function mkErr assets/js/ai-client.js */

/* @function parseJSON assets/js/ai-client.js */
/* 輸出被截斷時，把還沒關的括號補齊，至少救回前面完整的部分 */
/* @function closeBrackets assets/js/ai-client.js */

/* ---------- 素材切塊與檢索 ---------- */
/* @function chunkText assets/js/ai-client.js */
/* @function bigrams assets/js/ai-client.js */
/* @function allChunks assets/js/ai-client.js */
/* @function retrieve assets/js/ai-client.js */

/* ---------- 工具 ---------- */
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
/* @function download assets/js/file-utils.js */
/* 外部程式庫：依序試本機、jsdelivr、unpkg、cdnjs，任何一個成功就用它 */
const LIBS = {
  jszip:{ global:'JSZip', file:'jszip.min.js', urls:[
    './lib/jszip.min.js',
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js']},
  pptx:{ global:'PptxGenJS', file:'pptxgen.bundle.js', urls:[
    './lib/pptxgen.bundle.js',
    'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js',
    'https://unpkg.com/pptxgenjs@4.0.1/dist/pptxgen.bundle.js']},
  mammoth:{ global:'mammoth', file:'mammoth.browser.min.js', urls:[
    './lib/mammoth.browser.min.js',
    'https://cdn.jsdelivr.net/npm/mammoth@1.9.0/mammoth.browser.min.js',
    'https://unpkg.com/mammoth@1.9.0/mammoth.browser.min.js',
    'https://cdn.jsdelivr.net/npm/mammoth/mammoth.browser.min.js']},
  xlsx:{ global:'XLSX', file:'xlsx.full.min.js', urls:[
    './lib/xlsx.full.min.js',
    'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']},
  pdfjs:{ global:'pdfjsLib', file:'pdf.min.js', urls:[
    './lib/pdf.min.js',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js']}
};
const libCache={};

/* @function loadOne assets/js/file-utils.js */

/* 回傳 {lib, url}，url 用來推導同版本的 worker 位置 */
/* @function loadLib assets/js/file-utils.js */

/* 相容舊呼叫方式 */
/* @function loadScript assets/js/file-utils.js */

/* @function loadPdfjs assets/js/file-utils.js */
/* @function fileB64 assets/js/file-utils.js */

/* ---------- PowerPoint 母片：讀取版面、主題與預留位置 ---------- */
const R_EMBED_ATTR='r:embed';
const PPTX_NS = {
  p:'http://schemas.openxmlformats.org/presentationml/2006/main',
  a:'http://schemas.openxmlformats.org/drawingml/2006/main',
  r:'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  rel:'http://schemas.openxmlformats.org/package/2006/relationships',
  ct:'http://schemas.openxmlformats.org/package/2006/content-types'
};
/* @function xmlDoc assets/js/templates.js */
const xmlList=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
/* @function partPath assets/js/templates.js */
/* @function relsPath assets/js/templates.js */
/* @function zipText assets/js/templates.js */
/* @function shapeRect assets/js/templates.js */
/* @function phKey assets/js/templates.js */
/* @function placeholdersFrom assets/js/templates.js */
/* @function layoutRole assets/js/templates.js */
/* @function autoTemplateMap assets/js/templates.js */
/* @function themeColor assets/js/templates.js */
/* 這個形狀（或群組）裡最大的字級，用來判斷哪個文字框是標題 */
/* @function maxFontSize assets/js/templates.js */
/* 把形狀裡的文字清空，但保留形狀本身（例如樣板上的白色圓角標籤） */
/* @function blankText assets/js/templates.js */

/* 有些樣板（Canva／Google Slides 匯出）把設計畫在「投影片」上，母片與版面配置是空的。
   這種樣板要改用範例投影片當版型：抄它的裝飾圖形，並沿用它原本的文字框位置。 */
/* @function parseDesignSlides assets/js/templates.js */
/* 從範例投影片的文字框推出標題框與內容框 */
/* @function designBoxes assets/js/templates.js */

/* 從 PPTX 原生圖表抽取「視覺語言」，只取型別與色彩，不帶入範例數字。 */
/* @function parseChartStyleLibrary assets/js/templates.js */

/* @function parsePptTemplate assets/js/templates.js */
/* 把八種頁型對應到範例投影片：封面用第一張、結尾用最後一張，其餘循環使用中間幾張 */
/* @function designFeatures assets/js/templates.js */
/* 依每張範例投影片的版面特徵，替八種頁型各挑一張最像的樣板頁；
   舊版只是照順序循環，遇到「目錄頁、比較頁、圖表頁」都會配錯。 */
/* @function autoDesignMap assets/js/templates.js */
/* @function slideContentProfile assets/js/templates.js */
/* @function designSlideFor assets/js/templates.js */
/* @function templateLayoutFor assets/js/templates.js */
/* 母片是二進位，塞不進 localStorage；改存 IndexedDB，重新整理後自動還原。 */
/* @function idbTemplate assets/js/templates.js */
/* @function restoreTemplate assets/js/templates.js */
/* @function uploadPptTemplate assets/js/templates.js */
/* @function applyChartStyleToSlides assets/js/templates.js */
/* @function activateTemplateChartStyle assets/js/templates.js */
/* @function uploadChartStylePpt assets/js/templates.js */
/* @function pickFile assets/js/templates.js */
/* @function pickFiles assets/js/templates.js */
/* 如閔建議的「補助資訊資料夾所有檔案」：Chrome／Edge 可直接選資料夾，
   但保留原本多檔選擇與拖放入口，避免改壞既有流程。只送進網站原本支援的副檔名。 */
/* @function pickFolderFiles assets/js/templates.js */

/* 中文簡報的讀者要的是「3,860萬」「6.9億」，不是「39M」「690M」。 */
/* @function chartValueLabel assets/js/slide-render.js */
/* @function defaultTextStyle assets/js/slide-render.js */
/* @function slideTextStyle assets/js/slide-render.js */
/* @function statPt assets/js/slide-render.js */
  function webFontFamily(t,st){
  if(t&&t.fontName) return `'${t.fontName}',` + SANS;
  if(t.fontFamily==='serif') return SERIF;
  if(t.fontFamily==='mono') return "'IBM Plex Mono',Consolas,monospace";
  if(t.fontFamily==='sans') return SANS;
  return st.serif?SERIF:SANS;
}
/* @function pptFontFamily assets/js/slide-render.js */
/* @function textCss assets/js/slide-render.js */
/* @function chartPalette assets/js/slide-render.js */
const BUILTIN_CHART_STYLES=[
  {id:'auto',name:'跟隨簡報',desc:'沿用目前母片或網站風格，適合全篇一致',colors:[]},
  {id:'executive-blue',name:'專業藍',desc:'深藍主色、淺藍比較，適合政策與商務報告',colors:['#1F4E79','#6B9AC4'],showGrid:true},
  {id:'focus-gold',name:'焦點金',desc:'海軍藍搭配金色，數值標示清楚',colors:['#153B5B','#D59A2B'],showGrid:false,showValues:true},
  {id:'warm-editorial',name:'暖色報告',desc:'磚橘與赭金，適合成果與案例型內容',colors:['#B85C38','#D7A23A'],showGrid:true},
  {id:'soft-modern',name:'柔和現代',desc:'霧藍與灰紫，適合資訊量較多的比較圖',colors:['#536F91','#9B8AA5'],showGrid:true},
  {id:'accessible-contrast',name:'高對比易讀',desc:'深藍與橙色、加大標籤，適合長者與投影環境',colors:['#004C6D','#E69F00'],showGrid:true,showValues:true,labelSize:13,dataLabelSize:13,lineSize:4}
];
/* @function expandChartColors assets/js/slide-render.js */
/* @function chartDisplayStyle assets/js/slide-render.js */
/* @function pptChartStyleProps assets/js/slide-render.js */
/* @function chartUnitName assets/js/slide-render.js */
/* @function safeChartType assets/js/slide-render.js */
/* @function pptChartValue assets/js/slide-render.js */
/* @function renderChartHTML assets/js/slide-render.js */

/* ---------- 版面引擎：把一頁資料畫成 HTML ---------- */
/* 套用樣板時，編輯器改用「與匯出完全同一套版面計算」來預覽，
   底層鋪上樣板的裝飾圖，所見即所得。 */
/* @function renderTemplateSlide assets/js/slide-render.js */
/* @function renderSlide assets/js/slide-render.js */

/* 把編輯路徑寫回資料 */
/* @function editValue assets/js/slide-render.js */
/* @function applyEdit assets/js/slide-render.js */
/* @function pushHistory assets/js/slide-render.js */

/* ---------- AI 動作 ---------- */
/* @function genOutline assets/js/generation.js */

/* 一條龍：貼什麼都行，一次請求推斷設定並產出完整簡報 */
/* @function genFromBrief assets/js/generation.js */
/* ---------- 課程情境：內建任務規格；數據與政策內容必須由學員上傳 ---------- */
const SCENARIOS = {
  monthly:{
    name:'情境一　定期更新型',
    unit:'第三單元 3-1',
    desc:'比較 2024、2025 年夏季住宅用電與冷氣時，再依推廣資料提出高用電縣市節能策略。',
    example:'夏季住宅用電分析與夏月節能策略簡報',
    topic:'夏季住宅用電分析與夏月節能策略',
    role:'能源數據分析師兼簡報設計師',
    audience:'能源政策主管、縣市政府長官與節能推廣執行人員',
    pages:3, bulletCount:10, includeCover:true, includeAgenda:true, includeClosing:true,
    coverSubtitle:'2024～2025 年｜全台各縣市｜夏季 6～9 月｜住宅部門',
    sourceMode:'compare', templateSuggested:true,
    expectedTemplate:'White and Blue Simple Business Plan Presentation.pptx',
    outputName:'AI培力課程測試簡報.pptx',
    requiredUploads:[
      {key:'ac',label:'各縣市冷氣時數（Excel）',pattern:/冷氣時.*\.(xlsx|xls|csv)$/i,detect:'cooling',
        keywords:[['冷氣','空調']],kind:'table',pages:[1,2]},
      {key:'kwh',label:'各縣市售電／用電資訊（Excel）',pattern:/售電資訊.*\.(xlsx|xls|csv)$/i,detect:'sales',
        keywords:[['售電','用電','電量','度數']],kind:'table',pages:[1,2]},
      {key:'promo',label:'「節能推廣」資料夾中的至少一份策略來源',
        exclude:/冷氣時|售電資訊|White and Blue Simple Business Plan Presentation/i,kind:'content',pages:[3]}
    ],
    outline:'必要主題群一：2024～2025 年全台夏季住宅用電總覽（兩年各別總量、同期變化率、六都與非六都占比及變化率，可依內容拆成多頁）\n必要主題群二：用電增幅前 10 高縣市與冷氣時關聯（明示排序口徑，可將排名、冷氣時與關聯判讀拆頁）\n必要主題群三：依「節能推廣」來源提出夏月高用電縣市節能策略（可依縣市、措施與成效指標拆頁）',
    requirements:"【自由風格套用｜優先規則】\n樣板是選用，不要求任何指定檔名。已上傳 PPTX 時，以使用者該次選擇的母片、版面、品牌、字型、配色與插畫為準；未上傳時使用目前網站選用風格，也可正常生成及匯出。以下具名樣板頁型、配色與字型僅是課程參考：只有使用相應樣板時才參照，其他樣板依可用版面映射相同內容，不要求相同頁名、圖像或色塊，也不得強套參考樣式。保留可編輯文字、原生圖表表格、來源與講稿；不以整頁圖片代替。所有分析內容與彈性頁數規則不變。\n\n【資料核對優先】\n以下數值、排名、政策敘述與相關係數是本練習參考核對值，不能取代上傳原始資料。結果不同時據實呈現並說明差異；無支持來源標示待核對或待補。Spearman 以完整可比的 22 縣市配對計算，不能用前 10 名取代或將缺值補零。相關性不能證明天氣或節能行為造成變化，缺乏額外證據時因果敘述改為並列觀察及限制。合計關係使用未四捨五入原值核對。\n\n你是一位能源政策分析師兼簡報設計師。請依下列規格，用我上傳的檔案產出一份「可編輯」的 PowerPoint。\r\n\r\n【資料處理規則】\r\n1. 夏月定義為 6–9 月，對應台電夏月電價期間 6/1–9/30。\r\n2. 只取「住宅部門售電量_度」欄位，依年度加總 6–9 月。\r\n3. 六都＝台北市、新北市、桃園市、台中市、台南市、高雄市；其餘 16 縣市為非六都。\r\n4. 冷氣時取各縣市 6–9 月加總值。\r\n5. 單位換算：1 億度 ＝ 100,000,000 度，數值取小數 2 位。\r\n6. 變化率＝(2025 − 2024) ÷ 2024 × 100%，占比變化以「個百分點（pp）」表示。\r\n7. 相關性用 Spearman 等級相關，樣本為 22 縣市的「用電變化率 × 冷氣時變化率」。\r\n8. 若實際計算結果與題目假設相反（例如題目說「高增幅」但資料呈負成長），\r\n   請據實呈現並在頁面上說明改用「降幅最小」排序，不要為了符合題目而修改數據。\r\n\r\n【簡報結構】建議 6 頁（含封面、目錄、三個必要分析主題群與結尾），不是固定頁數。以下「第 1～3 頁」是分析主題群，可依內容量拆頁；頁數欄為 0 時依內容自動建議，使用者指定頁數時依該總頁數規劃。封面、目錄與結尾均計入總頁數，全部分析需求必須保留。\r\n\r\n■ 封面\r\n  主標：2024–2025 全台夏季／住宅用電分析與夏月節能策略\r\n  副標：住宅部門售電量 × 冷氣時｜資料期間 2024 年 6–9 月 vs. 2025 年 6–9 月\r\n  來源列：各縣市售電資訊、各縣市冷氣時、「節能推廣」資料夾\r\n\r\n■ 目錄（三項，含編號 01/02/03 與一行說明）\r\n\r\n■ 第 1 頁：全台夏季（6–9 月）住宅部門用電總覽\r\n  必含四項指標：\r\n    - 2 年夏月各別用電總量（2024：211.01 億度；2025：204.16 億度）\r\n    - 同期用電變化率（−3.25%，減少 6.85 億度）\r\n    - 六都占比及變化率（149.23 → 144.99 億度、−2.84%；占比 70.72% → 71.02%、+0.30 pp）\r\n    - 非六都占比及變化率（61.78 → 59.18 億度、−4.22%；占比 29.28% → 28.98%、−0.30 pp）\r\n  視覺：6–9 月逐月 2024 vs 2025 的「原生」群組長條圖\r\n        （43.06/48.88/58.33/60.74 對 42.58/50.46/54.43/56.69），\r\n        並以兩個大字級百分比呈現六都／非六都占比。\r\n  註腳：售電量依抄表期歸戶，較實際用電月份約遞延 1–2 個月，故 9 月數值偏高。\r\n\r\n■ 第 2 頁：用電增幅前 10 縣市與冷氣時的關聯\r\n  副標說明：2025 年夏月僅連江、金門正成長，故以「降幅最小」排序。\r\n  表格（10 列，欄位：排名／縣市／2025 夏月用電（億度）／用電變化率／冷氣時 2024→2025／冷氣時變化率）：\r\n    1 連江縣 0.13 +2.75% 944→885 −6.25%\r\n    2 金門縣 0.56 +0.64% 1,210→1,208 −0.17%\r\n    3 桃園市 20.99 −1.10% 1,889→2,056 +8.84%\r\n    4 新北市 35.62 −1.37% 1,159→1,675 +44.52%\r\n    5 台北市 21.69 −2.10% 1,935→2,071 +7.03%\r\n    6 南投縣 3.45 −2.63% 1,351→1,327 −1.78%\r\n    7 新竹縣 5.71 −2.67% 2,034→1,925 −5.36%\r\n    8 宜蘭縣 3.98 −2.73% 1,549→1,455 −6.07%\r\n    9 基隆市 2.87 −3.14% 1,930→2,010 +4.15%\r\n    10 台南市 16.88 −3.68% 2,134→2,050 −3.94%\r\n  三項關聯結論：\r\n    (1) 相關係數 0.62；全台冷氣時平均變化 −3.24% 與住宅用電 −3.25% 幾乎同步。\r\n    (2) 北台灣逆勢升溫、用電最抗跌：桃園 +8.8%、台北 +7.0%、基隆 +4.2%。\r\n    (3) 冷氣時大降的縣市降幅最深：台東 −20.9%／−7.48%、澎湖 −17.8%／−4.06%、\r\n        屏東 −13.4%／−5.85%，減量多來自天氣而非節能行為。\r\n  註腳：新北市 2024 年冷氣時（1,159）明顯低於鄰近縣市，疑為測站或統計基準差異，\r\n        +44.52% 宜保守解讀；嘉義縣、市共用同一組數值。\r\n\r\n■ 第 3 頁：夏月節能策略建議\r\n  推動對象：夏月用電前 10 大縣市（新北、台中、高雄、台北、桃園、台南、彰化、屏東、\r\n            新竹縣、雲林），合計占全台住宅夏月用電 84.7%。\r\n  以 01/02/03 三軸呈現，每軸 3 條具體措施，且每條都必須可回溯到「節能推廣」檔案：\r\n    01 設備汰換誘因\r\n       - 夏月於高用電縣市加碼家電汰舊換新積點（現行依售價回饋 5%、2 點＝1 元）\r\n       - 借鏡日本 Eco Point：冷氣、冰箱、電視依規格給 3,000–36,000 點，約售價 5%\r\n       - 簡化環保集點流程，改善回饋僅 0.5–1% 與手續 4 道程序的參與障礙\r\n    02 適溫與行為節電\r\n       - 冷氣適溫 26–28℃ 並搭配電扇；法國節能計畫推估空調調高 1℃ 可省電近 10% \r\n       - 濾網定期清掃、窗簾適切調整、換氣適當化，並同步宣導中暑預防\r\n       -避開夏月下午4點~晚上10點尖峰時間用電\r\n    03 家庭用電健檢\r\n       - 建立節能健檢師培訓與認證，推動家庭與社區用電健檢（借鏡日本 ECCJ 認證制度）\r\n       - 借鏡首爾蘆原區媽媽能源顧問團：到府健檢，該區人均 1,800 度遠低於首爾 3,060 度\r\n       - AMI 智慧電表結合台電 App 推家庭節能報告與用電警示，結合節能志工與通路宣導\r\n  分區推動重點（同一套策略在不同縣市權重不同）：\r\n    - 北台灣（桃園、新北、台北、基隆）：冷氣時逆勢上升、用電最抗跌，優先投入。\r\n    - 中南部（台中、高雄、台南、彰化）：合計 76.51 億度、規模最大。\r\n    - 台東、澎湖、屏東、雲林：降幅來自冷氣時大減，須防回溫反彈。\r\n  來源列：日本夏季節能措施、日本積點兌獎活動比較、\r\n          日本韓國及台灣家庭節能健檢推動策略、法國節能措施與我國借鏡。\r\n\r\n■ 結尾頁\r\n  THANK YOU ＋ 一句收束：「全民節電，動起來！落實生活節能好習慣 」\r\n\r\n【套版要求】\r\n1. 若已上傳 PPTX，直接沿用使用者選擇的模板，\r\n   沿用它原有的母片、背景紋理、插畫、字型與配色，只替換內容，不要另建版面。\r\n2. 依實際規劃頁數選用適合的樣板頁，必要時複用版面形成續頁，不固定只保留 6 頁。下列具名映射僅適用 White and Blue 課程參考，其他模板選其最接近內容需求的版面：\r\n   - 封面 → 樣板的 BUSINESS PLAN PRESENTATION 頁\r\n   - 目錄 → Table Of Content 頁（原 5 項刪到 3 項，多餘的圓點圖示一併刪除）\r\n   - 第 1 頁 → Financial Plan 頁（圖表＋兩個大百分比）\r\n   - 第 2 頁 → Business Overview 頁（左文右圖，刪掉插畫與裝飾弧形以放表格）\r\n   - 第 3 頁 → Operation 頁（01/02/03 橘色圓標卡）\r\n   - 結尾 → THANK YOU 頁\r\n3. 樣板配色：主藍 #26459B、深藍 #13224B、副標藍 #1A3272、中藍 #5C73B2、橘色重點。\r\n4. 圖表與表格一律用「原生」PowerPoint 物件，不可貼圖；樣板原本的折線圖是圖片，請刪除後改插原生圖表。\r\n5. 字型處理：英文與數字（BUSINESS、THANK YOU、01/02/03、百分比）保留樣板的\r\n   League Spartan／Glacial Indifference；所有文字執行另外設定東亞字型「微軟正黑體」，\r\n   避免中文顯示為方框。\r\n6. 每頁加上演講備忘稿（speaker notes），寫成可直接口述的講稿。\r\n7. 每頁均須加入頁碼，規格如下：\r\n - 每頁皆須顯示頁碼，包括封面、目錄及結尾頁。\r\n - 頁碼格式統一為 `1`、`2`、`3`等以此類推。\r\n - 頁碼固定置於每頁右下角，與頁面右緣及下緣保留一致的安全距離。\r\n - 頁碼須使用可編輯的 PowerPoint 文字物件，不可貼成圖片。\r\n - 頁碼字型沿用 League Spartan 或 Glacial Indifference，字級設定為 12 pt。 \r\n- 淺色背景頁使用深藍色 `#13224B`；深藍色背景區域使用白色，確保清楚可讀。\r\n - 所有頁碼的位置、字型、字級及格式必須一致。 \r\n- 頁碼不得與註腳、插畫、表格、圖表、裝飾圖形或其他文字重疊。 \r\n- 若右下角已有裝飾圖形或重要內容，可在維持整體一致性的前提下，將該頁頁碼水平向左微調，但垂直位置須與其他頁一致。 \r\n\r\n【字級與格式】 \r\n\r\n\r\n1. 建議字級層級： - 封面主標：30～40 pt - 內容頁標題：24～30 pt - 大型關鍵數字：28～42 pt - 小標題：18～22 pt - 內文：至少 15～18 pt - 表格：至少 11～13 pt - 註腳：10～11 pt \r\n2. 中文統一設定東亞字型「微軟正黑體」。 \r\n3. 英文、編號及大型數字沿用樣板的 League Spartan／Glacial Indifference。 \r\n4. 重點數字使用深藍或橘色，不得增加樣板以外的鮮豔色彩。 \r\n5. 若文字無法完整放入版面，須依下列優先順序處理： \r\n(1) 精簡句子，但不得刪除重要數據、條件或結論。\r\n(2) 加寬或加高文字框。 \r\n(3) 調整文字框、圖表、表格或插畫的位置。 \r\n(4) 適度調整行距與段落間距。\r\n(5) 最後才考慮縮小字級，且不得小於本指令所訂的最低字級。 \r\n6. 不得僅為避免溢出而使用自動縮小文字，導致內文字級過小或各頁字級不一致。 \r\n\r\n【圖文避讓】 \r\n1. 插畫及裝飾圖形周圍須保留適當安全距離，不得將其視為可放置文字的空白區域。\r\n2. 文字框不得覆蓋插畫、圖表、表格、右上角裝飾或頁面主要視覺元素。 \r\n3. 標題不得超過安全範圍，亦不得延伸至右上角裝飾圖形下方。 \r\n4. 圖表標籤、圖例及數值不得互相重疊，也不得被其他文字框或圖形遮擋。 \r\n5. 表格不得與標題、副標、分析結論或註腳重疊。 \r\n6. 註腳固定置於頁面底部，並與主要內容保留明確間距，不得壓到表格、圖表、插畫或裝飾圖形。 \r\n7. 若插畫與文字空間衝突，優先調整插畫大小與位置，並維持原始比例，不得直接將文字疊在插畫上。 \r\n\r\n【交付與檢查】\r\n1. 輸出可編輯的 .pptx，並列出檔案下載連結。\r\n2. 交付前須逐頁渲染成圖片，檢查 整份簡報，不得只檢查部分頁面。 \r\n3. 須確認沒有殘留下列樣板佔位文字：Headline Text、Sub Heading Text、Enter Name、\r\n     This sentence contains、Read More、Competitor、Lorem 等。\r\n4.須逐頁確認 \r\n- 所有文字均可完整顯示。\r\n- 沒有文字超出文字框。 \r\n- 沒有標題換行後與副標或內文重疊。 \r\n- 沒有圖片與文字重疊。 \r\n- 沒有圖表、圖例、標籤及數值互相重疊。 \r\n- 沒有表格超出頁面右緣或下緣。\r\n- 沒有註腳壓到表格、圖表或裝飾圖形。 \r\n- 插畫沒有遮住標題、數據或說明文字。 \r\n- 各頁留白與參考簡報相近。\r\n - 圖表與表格仍為可編輯的 PowerPoint 原生物件。 \r\n5. 須核對下列數據關係： \r\n- 六都用電量＋非六都用電量＝全台用電總量。 \r\n- 六都占比＋非六都占比＝100%。\r\n- 2024 年總量－2025 年總量＝減少 6.85 億度。\r\n- 表格排序、正負號、小數位數及百分比均與原始資料一致。\r\n6. 若逐頁渲染後發現文字過小、圖文重疊、留白失衡或資訊難以閱讀，必須繼續調整版面並重新渲染檢查，不得直接交付第一版。 \r\n7. 若有任何資料無法讀取，例如舊版 `.ppt` 無法解析，請在對應位置明確標示「待補」，不得自行臆測內容。",
    material:`【課堂任務】夏季住宅用電分析與夏月節能策略簡報
請使用學員上傳的兩份 Excel 原始資料與「節能推廣」來源完成分析。這段文字只定義任務，不包含任何可引用的數值；所有數值、排名、占比與策略依據都必須回到上傳檔案。`
  },
  compare:{
    name:'情境二　臨時交辦型',
    unit:'第三單元 3-2',
    desc:'彙整 2021～2026 年資料，以 2025～2026 現行方案比較四國，再提出台灣可執行的政策建議。',
    example:'國內外家電補助政策比較與台灣借鏡建議',
    topic:'國內外家電補助政策比較與台灣借鏡建議',
    role:'能源政策幕僚兼簡報設計師',
    audience:'能源政策決策主管與執行幕僚',
    pages:7, bulletCount:10, includeCover:false,
    coverSubtitle:'2021～2026 年資料整理｜2025～2026 年現行方案比較',
    sourceMode:'crosscountry', templateSuggested:true, requireSourceFooter:true, requireTimelinessNotes:true,
    expectedTemplate:'Smart Home.pptx',
    outputName:'國內外家電補助政策比較與台灣借鏡建議_套用樣板.pptx',
    /* 「至少一份」不足以做四國對照——只丟一份日本的比較表就會顯示通過，
       但第 2 頁的四國矩陣根本做不出來。拆成各國一項，缺哪一國看得見，
       系統也才知道哪份檔案屬於哪一國，能落實「不得把不同國家寫在同一點」。 */
    requiredUploads:[
      {key:'tw',label:'台灣的補助來源（能源署汰舊換新或貨物稅退減）',kind:'content',
        keywords:[['台灣','臺灣','我國','能源署','貨物稅']],pages:[1,2,4,5]},
      {key:'jp',label:'日本的補助來源（中央或東京都）',kind:'content',
        keywords:[['日本','東京都','經產省','日圓']],pages:[2,3]},
      {key:'kr',label:'韓國的補助來源',kind:'content',
        keywords:[['韓國','南韓','首爾','韓元']],pages:[2,3]},
      {key:'sg',label:'新加坡的補助來源（氣候友善家庭計畫）',kind:'content',
        keywords:[['新加坡','星國','氣候友善']],pages:[2,3]}
    ],
    outline:"主題群 1：議題定位與資料範圍\n主題群 2：四國家電補助政策對照\n主題群 3：2021–2026 政策演進\n主題群 4：台灣現況與四個政策缺口\n主題群 5：台灣政策建議\n主題群 6：附錄：資料落差與查證清單\n主題群 7：附錄：截止方案與換算基準\n建議 7 頁，可自行調整；不另加封面、目錄或結尾。",
    requirements:"【自由風格套用｜優先規則】\n樣板是選用，不要求任何指定檔名。已上傳 PPTX 時，以使用者該次選擇的母片、版面、品牌、字型、配色與插畫為準；未上傳時使用目前網站選用風格，也可正常生成及匯出。以下具名樣板頁型、配色與字型僅是課程參考：只有使用相應樣板時才參照，其他樣板依可用版面映射相同內容，不要求相同頁名、圖像或色塊，也不得強套參考樣式。保留可編輯文字、原生圖表表格、來源與講稿；不以整頁圖片代替。所有分析內容與彈性頁數規則不變。\n\n# 簡報生成指令：國內外家電補助政策比較與台灣借鏡建議\n\n## 角色與任務\n你是能源政策幕僚兼簡報設計師。請根據附件整理台灣、日本、韓國及新加坡的家電補助政策，完成跨國比較、政策演進分析及台灣政策建議，並依使用者選用風格或上傳 PPTX 套版，產出可編輯的 PowerPoint。\n\n## 附件\n- PPTX 樣板（選用）：可上傳任意檔名的模板；Smart Home.pptx 僅為課程參考，不是必備附件。\n- 「補助資訊」資料夾內 4 份檔案：政策分析資料。\n- 參考成果簡報：比對頁面結構、資訊密度、留白及排版方式。\n請先讀取全部附件；參考成果僅供版面與資訊層級比對，政策內容仍須回到原始附件及官方網站查證。\n\n## 分析範圍\n- 期間：2021–2026 年；比較台灣、日本、韓國、新加坡。\n- 日本須區分中央政府與東京都。\n- 現況比较採 2025–2026 年仍有效或可確認持續辦理的方案。\n- 政策演進僅比較新加坡「氣候友善家庭計畫」2021 年版與 2026 年版。\n- 比較計畫名稱、主管機關、補助對象、期間、金額、品項、回饋方式、汰舊回收及資料時點。\n\n## 資料處理原則\n1. 附件查不到的欄位填「檔案未載」，不得推測或挪用其他方案資料補足。\n2. 中央與地方方案分行標示，不得混為同一項國家政策。\n3. 已截止方案標示「（已截止）」，排除於現行方案對照，移至附錄。\n4. 韓國 2025 年一般民眾回饋方案已截止，不列入現行比較；韓電福利家庭方案若無法確認仍在受理，標示「有效性待確認」。\n5. 台灣資料須查證：\n   - 經濟部能源署：https://save3000.moeaea.gov.tw\n   - 財政部稅務入口網：https://www.etax.nat.gov.tw/etwmain/tax-info/purchase-energy-saving-appliance-reduced-commodity-tax-refund-area/consumer-online-apply\n6. 台灣分列「住宅家電汰舊換新節能補助」與「購買節能電器退還減徵貨物稅」。\n7. 外幣同時標示原幣與新臺幣，統一比較基準：JPY × 0.22、KRW × 0.024、SGD × 24。\n8. 每筆資料標示「附件｜2021／2023／2026」或「官網查證｜日期」。\n9. 外幣頁面註明：「金額換算為跨國比較用假設，非即時匯率」。\n10. 本指令中的政策狀態、數值及歷史敘述仍須以附件或官方來源核對。若本次無法連線查證，不得假稱已查證或填入虛構查證日期，改標「官網待查證」。政策建議必須與現行政策區分。\n\n## 簡報架構與彈性頁數\n建議 7 頁，以下為 5 個主文主題群及 2 個附錄主題群，不是固定七張。\n頁數欄為 0 時，依資料量、表格密度與可讀性自動建議；使用者指定頁數時，依該總頁數拆分或合併內容，全部七個主題群均須保留。不得為湊頁數刪除必要資訊。\n不另加封面、目錄或結尾頁。主文在前、附錄在後；拆頁時延續同主題版型，不靠縮小字體硬塞。\n\n### 主題群 1｜議題定位與資料範圍\n比較對象、分析期間、交辦來源、資料基礎、資料時點、現況比較與跨年分析的範圍取捨；已截止方案不納入現行比較。\n參考 Introduction 頁：左側保留家電插圖，右側黃色區塊整理重點。\n\n### 主題群 2｜四國家電補助政策對照\n用可編輯 PowerPoint 原生表格比較計畫／主管機關、補助對象、期間、金額、品項、回饋機制、汰舊回收、資料時點。\n台灣分列能源署補助與財政部退稅；日本分列中央政府與東京都；韓國不得使用已截止的一般民眾方案補足現行資料。缺漏標示「檔案未載」。\n\n### 主題群 3｜2021–2026 政策演進\n左側比較新加坡 2021 年版與 2026 年版：\n- S$225 增至 S$400，增加 77.8%。\n- 3 類增至 12 類，擴大為 4 倍。\n- 補助對象由特定 HDB 住宅擴大。\n- 主管機關兩版均為 NEA 與 PUB。\n右側三項跨國趨勢，每項至少兩國案例：\n1. 補助品項回應家庭多元需求。\n2. 採用購物當下折抵。\n3. 依所得或設備年限提供差異化補助。\n放大「77.8%」與「3 類增至 12 類」。\n\n### 主題群 4｜台灣現況與四個政策缺口\n上半部引用工研院「108 年家庭用電消費習慣調查」：\n- 超過 10 年冷氣約 864 萬台，占 42.63%。\n- 超過 10 年冰箱約 378 萬台，占 43.04%。\n- 加註「108年調查推估，不代表2026年即時存量」。\n下半部四项缺口，對照其他國家作法：\n1. 弱勢家戶須先墊款。\n2. 未依所得或家電機齡分級。\n3. 補助品項較少。\n4. 補助未與節能診斷及成效追蹤連結。\n沿用橘色及黃色圓角橫條。\n\n### 主題群 5｜台灣政策建議\n每項依「他國做法、台灣缺口、具體建議」呈現：\n1. 弱勢分級補助：補助購機及基本安裝費 30%，每戶 1 台，上限 NT$10,000。\n2. 通路即時折抵：先驗證資格並發放折抵碼，結帳直接折抵，通路於 30 日內核銷。\n3. 診斷連結汰換：優先補助逾 15 年且診斷為高耗電的家電，汰換後 3 個月回訪，滿 12 個月評估節電成效。\n頁面標示「政策建議，非現行方案。」\n參考 Best Practices 頁：左側大型黃色內容區、右側保留智慧住宅插圖。\n\n### 主題群 6｜附錄：資料落差與查證清單\n可編輯表格列出：\n- 官網補查的台灣資料。\n- 日本中央與東京都仍未載欄位。\n- 韓國福利家庭方案資料限制。\n- 新加坡 2021 與 2026 年版資料差異。\n- 台灣家電需求數據及匯率使用限制。\n欄位：項目／資料時點、已補查或已處理、仍未載／使用限制。\n\n### 主題群 7｜附錄：截止方案與換算基準\n整理韓國 2025 年一般民眾回饋方案、西班牙馬德里自治區方案、義大利 2025 年方案、新加坡 2021 年歷史方案、外幣換算基準，以及新加坡補助金額增幅及品項倍數計算式。\n\n## 樣板與排版要求\n### 樣板使用\n已上傳時沿用所選 PPTX 的母片、背景、裝飾圖像、版面比例、字型層級與配色；未上傳則使用所選網站風格。優先複製最接近內容需求的既有投影片再替換內容，不另建無關風格。不將樣板或整頁內容轉成圖片；表格、文字、數字及圖形保留為可編輯物件。\n\n### 字型與字級\n- 中文東亞字型：微軟正黑體。\n- 英文內文：Arial。\n- 英文標題、編號及大型數字：沿用 League Spartan 或 Glacial Indifference。\n- 主標題 40–50 pt；內容頁標題 24–30 pt；大型關鍵數字 28–42 pt；小標題 20–24 pt。\n- 內文不小於 18 pt；表格不小於 14 pt；註腳 10–11 pt；頁碼 12 pt。\n\n### 配色與版面\n深綠用於標題及表頭、黃色用於重點內容區、橘紅用於關鍵數字及政策建議，不增加樣板以外鮮豔色彩。標題採結論式寫法，關鍵數字放大。\n\n### 頁碼規格\n每張實際輸出投影片皆有頁碼，依最終總頁數 N 由 1 編至 N（不是固定 1 至 7）。\n使用單一阿拉伯數字，不加「第」、「頁」、斜線或總頁數。\n固定右下角，與右緣及下緣保持一致安全距離；使用可編輯 PowerPoint 文字物件，不得轉為圖片或併入背景。\n沿用母片字型，統一 12 pt，依背景選黑或白。位置、字型、字級、格式一致。\n不得與來源、插畫、表格、圖表、裝飾或其他文字重疊；若右下角有重要內容可水平左移，垂直位置維持一致。頁碼置於最上層。\n\n### 文字、圖像及頁碼避讓\n文字不得覆蓋插畫、裝飾、表格、圖表或頁碼；標題不得延伸至右上角裝飾。插畫與文字衝突先調整插畫大小位置，維持比例。\n表格及主要內容與底部來源、頁碼保留明確間距；資料來源靠左，右下角保留頁碼安全區，兩者不得互疊。\n不得僅以自動縮字處理溢出。文字放不下依序：\n1. 精簡文字但保留重要數據、條件、結論。\n2. 加寬或加高文字框。\n3. 調整文字框、表格、圖表或插畫位置。\n4. 調整行距及段落間距。\n5. 最後才縮字，不低於最低字級。\n仍過密時依頁數設定合理拆頁，不刪除必要內容。\n\n## 資料來源與講者備註\n每頁底部「資料來源：」列出附件名稱、頁碼或完整官方網址，靠左排列避開頁碼。\n每頁講者備註包含資料時點、時效限制、資料缺漏、口頭補充重點及完整來源。\n政策建議頁註明金額、比率及機制並非現行政策。\n\n## 交付前檢查\n逐頁渲染並檢查實際輸出的全部 N 頁，不只檢查七頁：\n- 頁碼正確依序 1 至 N、右下角、垂直位置一致、12 pt、格式字型一致、對比足夠、原生可編輯，且不與來源、插畫、表格、圖表或裝飾重疊。\n- 所有文字完整顯示、不超出文字框；標題、內文、圖片及表格不重疊。\n- 表格不超出頁面；來源不壓到表格、圖表、插畫或頁碼；插畫不遮住標題、數據或說明。\n- 表格與圖形仍為原生可編輯物件。\n- 無殘留樣板文字：Headline Text、Sub Heading Text、Enter Name、Read More、Competitor、Lorem。\n若無法實際渲染或完成官方查證，須如實說明未驗證項目，不得宣稱已通過。",
    material:`【課堂任務】國內外家電補助政策比較與台灣借鏡建議
請只依學員上傳的「補助資訊」來源整理政策。這段文字只定義任務，不代表任何國家目前真的有某項補助；來源未載的欄位請寫「檔案未載」，官方補查資料則需保留網址與查證日期。`
  },
  own:{
    name:'我自己的題目',
    unit:'自由發揮',
    desc:'貼上你手上的資料：會議記錄、統計表、政策文件、講稿都可以。',
    example:'流程與課程情境完全一樣',
    topic:'', role:'簡報內容與視覺設計顧問', audience:'一般決策與執行人員', pages:6, bulletCount:4, includeCover:true,
    outline:'', material:'', sourceMode:'latest'
  }
};

/* @function currentScenario assets/js/course.js */
/* @function uploadTableSignature assets/js/course.js */
/* @function uploadMatchesDetectedKind assets/js/course.js */
/* 一份上傳檔的可搜尋文字：檔名、試算表工作表標題與欄位名稱、內容前段。
   只靠檔名比對太脆弱——檔名改成「附件一.xlsx」就整份認不出來。 */
/* @function uploadHaystack assets/js/course.js */
/* keywords 是「群組的陣列」：群組之間 AND，群組內 OR。 */
/* @function keywordHit assets/js/course.js */
/* @function requiredKey assets/js/course.js */
/* @function uploadReqScore assets/js/course.js */
/* @function scenarioUploadStatus assets/js/course.js */
/* 缺件時，把「哪些頁面沒有資料可依據」算出來，供提示與講稿註記使用 */
/* @function missingPageNote assets/js/course.js */
/* @function scenarioTemplateStatus assets/js/course.js */

/* 結構化的簡報規範，對應課程第二單元 */
const RULES_BASE = {
  role:'專精於住宅節能診斷與推廣的高階顧問',
  audience:'縣市政府長官與社區村里長',
  pages:0, titleMax:15, kickerMax:20, bulletCount:4, bulletMax:30,
  units:true, banned:'顯著增加、非常多、大幅、相當不錯'
};
/* @function autoPageRecommendation assets/js/course.js */
/* 空白欄位在表單裡會回 null，直接 Object.assign 會把預設值蓋成 null，
   指令就會變成「總頁數固定為 null 頁」。這裡讓 null／非法數字退回預設值。 */
/* @function rulesObj assets/js/course.js */
/* @function buildRulesText assets/js/course.js */
/* 手動編輯規範可保留角色、文字風格等內容，但頁數必須以步驟三目前欄位為準。
   否則舊草稿中的「固定 3 頁」會與畫面上的 17 頁互相衝突。 */
/* @function effectiveRulesText assets/js/course.js */

/* v5 更新兩個課堂情境；保留舊大綱文字，但要求依新素材重新確認。 */
if(draft&&Number(draft.v||0)<PROJECT_VERSION&&currentScenario()&&S.scenario!=='own'){
  const sc=currentScenario(), r=rulesObj();
  S.plan=sc.outline||S.plan; S.sourceMode=sc.sourceMode||S.sourceMode;
  S.topic=sc.topic||S.topic; S.audience=sc.audience||S.audience; S.pages=sc.pages||S.pages;
  r.role=sc.role||r.role; r.audience=sc.audience||r.audience; r.pages=sc.pages||r.pages; r.bulletCount=sc.bulletCount||r.bulletCount;
  LS.set('rulesObj',r); S.rules=buildRulesText(r); LS.set('rules',S.rules);
  S.outlineBasis=''; S.maxStep=Math.min(S.maxStep,3); saveDraft();
}
/* v6：舊草稿若仍沿用情境預設的 3／5 頁，轉為依內容自動判斷；
   使用者曾手動指定其他頁數時則原樣保留。 */
if(draft&&Number(draft.v||0)<6){
  const sc=currentScenario(), r=rulesObj();
  if(!sc || Number(r.pages)===Number(sc.pages) || !Number.isFinite(Number(r.pages))){
    r.pages=0; S.pages=0; LS.set('rulesObj',r);
    if(!S.rulesEdited){ S.rules=buildRulesText(r); LS.set('rules',S.rules); }
    saveDraft();
  }
}

/* ---------- 檔案解析：Word / PDF / PowerPoint / Excel / CSV / 文字 ---------- */
const ACCEPT = '.txt,.md,.markdown,.csv,.tsv,.doc,.docx,.pdf,.ppt,.pptx,.xlsx,.xls';

/* @function pptxNodeText assets/js/file-import.js */
/* @function pptxNotesText assets/js/file-import.js */
/* @function orderedPptxSlidePaths assets/js/file-import.js */
/* @function parsePptxMaterial assets/js/file-import.js */

/* @function friendlyFileError assets/js/file-import.js */
/* @function decodeTextFile assets/js/file-import.js */
/* @function parseUpload assets/js/file-import.js */

/* @function csvRows assets/js/file-import.js */

/* @function tableRecord assets/js/file-import.js */
/* @function ensureBriefTables assets/js/file-import.js */

/* 把表格轉成文字，並且先在本機算好統計，不要讓 AI 自己加總 */
/* @function tableDigest assets/js/file-import.js */

/* @function handleUpload assets/js/file-import.js */
/* @function handleUploads assets/js/file-import.js */

/* ---------- AI 圖表助手：AI 選欄位，本機取值與繪圖 ---------- */
/* 中文倍數詞。3,860萬度 與 1.2億度 必須換算成同一個基準單位才能同框比較，
   否則圖表上會是 3860 對 1.2，差了一萬倍。 */
const NUM_SCALES={'兆':1e12,'億':1e8,'萬':1e4,'千':1e3,'k':1e3,'K':1e3,'M':1e6};
/* 數字後面認得的單位詞。刻意保守：認不得的尾巴一律當成不可解析，
   才不會把「10~20」「約 3 成」這種非數值讀成數字。 */
const UNIT_WORDS=/^(度|元|千元|萬元|億元|人|人次|戶|件|次|場|倍|項|個|台|支|家|所|校|班|小時|時|噸|公噸|公升|坪|平方公尺|平方公里|百分點|個百分點|kwh|mwh|gwh|kw|mw|gw|km|m2|℃|°c)$/i;
/* @function chartValue assets/js/charts.js */
/* @function chartNum assets/js/charts.js */
/* @function numericColumns assets/js/charts.js */

/* 情境一不能把 528 列 Excel 丟給 AI 猜合計。先在瀏覽器用完整資料確定性計算，
   再把結果交給 AI 負責敘述；這樣不受提示長度抽樣影響。 */
/* @function monthlyScenarioEvidence assets/js/charts.js */
/* @function monthlyComputedMarkdown assets/js/charts.js */
/* @function mergeMonthlyComputedPages assets/js/charts.js */
/* @function slideChartContext assets/js/charts.js */
/* @function chartContextText assets/js/charts.js */
/* @function chartTerms assets/js/charts.js */
/* @function chartRelevance assets/js/charts.js */
/* 情境一的原始 Excel 是逐月明細。圖表若直接使用原始列，排序後可能連續出現
   多筆「新北市」。圖表助手優先使用系統按夏季口徑算好的唯一分類資料。 */
/* @function monthlyDerivedChartTables assets/js/charts.js */
/* @function chartTablesForSlide assets/js/charts.js */
/* @function rankedChartTables assets/js/charts.js */
/* 將「目前投影片論點」與可用 Excel 資料先做一次本機比對。
   AI 只在這個證據範圍內選擇呈現方式；數值仍由網站直接讀表。 */
/* @function chartEvidencePlan assets/js/charts.js */
/* @function chartTableInfo assets/js/charts.js */
/* @function slideContentItems assets/js/charts.js */
/* @function ensureLayoutContent assets/js/charts.js */
/* @function slideFitWarnings assets/js/charts.js */
/* @function slideNumberSeries assets/js/charts.js */
/* @function buildChartPrompt assets/js/charts.js */
/* 欄名比對用的正規化：去掉空白與各種括號、統一全半形與大小寫。
   AI 回「補助件數」而表頭是「補助件數（件）」時，舊版比不到就整個放棄。 */
/* @function normHeader assets/js/charts.js */
/* @function resolveColumn assets/js/charts.js */
/* 類別欄不能固定拿第 0 欄。售電資訊這種表第一欄是「年月」，同一區間裡每一列都一樣，
   拿它當分類會畫出八根標籤完全相同的柱子。改成挑「相異值最多」的文字欄。 */
/* @function categoryColumnIndex assets/js/charts.js */
/* @function distinctLabelCount assets/js/charts.js */
/* @function aggregateDuplicateChartRows assets/js/charts.js */
/* @function quickChartSpec assets/js/charts.js */

/* 圖表建立視窗使用同一份資料判斷，不再只有一顆「交給 AI」按鈕。
   使用者能先看到資料表、分類、指標、筆數與建議圖型，再決定是否直接建立。 */
/* @function chartDraftSetup assets/js/charts.js */
/* @function manualChartSpec assets/js/charts.js */
/* AI 回覆送進圖表引擎前，再用本頁論點校驗一次資料表、分類與指標。
   使用者手動確認的欄位永遠優先，不會被這層自動改寫。 */
/* @function calibrateChartSpec assets/js/charts.js */
/* @function chartSlideFromSpec assets/js/charts.js */
/* @function insertChartSlide assets/js/charts.js */
const CHART_JSON_SCHEMA={
  type:'object',additionalProperties:false,
  properties:{
    tableId:{type:'string',description:'只能使用提示中列出的資料表 id'},
    mode:{type:'string',enum:['inline','content']},
    type:{type:'string',enum:['column','bar','line','doughnut','content']},
    categoryColumn:{type:'string'},
    valueColumns:{type:'array',items:{type:'string'},maxItems:2},
    sort:{type:'string',enum:['source','desc']},
    limit:{type:'integer',minimum:3,maximum:10},
    title:{type:'string',description:'20 字內'},
    kicker:{type:'string',description:'24 字內，不得推估數值'},
    items:{type:'array',maxItems:5,items:{type:'object',additionalProperties:false,
      properties:{label:{type:'string'},detail:{type:'string'}},required:['label','detail']}},
    note:{type:'string',description:'30 字內'}
  },
  required:['type','title','kicker','note']
};
/* @function suggestChart assets/js/charts.js */
/* @function importChartSpec assets/js/charts.js */

/* ---------- 用自己習慣的 AI 工具：產生指令 → 貼回結果 ---------- */

/* @function structuredTableEvidence assets/js/generation.js */

/* 表格逐列原值已經在［結構化表格原值］完整附上，素材段就不必再送一次。
   實測兩份 Excel 時，同一列會同時出現在兩段，白白拉長指令。 */
/* @function dropDuplicateTableRows assets/js/generation.js */

/* @function buildPrompt assets/js/generation.js */

/* 解析 AI 回覆。盡量寬鬆：不同工具的 Markdown 習慣差很多 */
/* @function parseMarkdownDeck assets/js/generation.js */

/* 課堂與自由流程共用的封面保護：AI 即使把第一個分析頁直接當首頁，
   也會補成真正的 cover 頁。sourceGroup=0 可避免封面吃到分析缺件標記。 */
/* @function ensureRequiredCover assets/js/generation.js */

/* @function prepareGeneratedSlides assets/js/generation.js */

/* 自動頁數模式不把十幾個條列硬塞在一張。只拆分既有內容、不補造資料；
   sourceGroup 保留原始主題群編號，讓缺件註記與來源判斷不會因拆頁錯位。 */
/* @function expandSlidesByContent assets/js/generation.js */

/* 貼上當下就先偵測，不要等按下一步才報錯 */
/* @function previewParse assets/js/generation.js */

/* @function importPasted assets/js/generation.js */

/* @function genLocal assets/js/generation.js */

/* @function normalize assets/js/generation.js */

/* @function genOne assets/js/generation.js */

/* @function genAll assets/js/generation.js */

/* @function reviseOne assets/js/generation.js */

/* @function createStyle assets/js/generation.js */

/* @function importStyle assets/js/generation.js */

/* @function addStyle assets/js/generation.js */

/* ---------- 匯出 ---------- */
/* @function exportOutline assets/js/pptx-export.js */

/* @function templateRect assets/js/pptx-export.js */
/* 整份簡報統一的標題級距：取樣板各版面定義的最大值，讀不到才用風格設定 */
/* @function deckTitlePt assets/js/pptx-export.js */
/* @function templateTheme assets/js/pptx-export.js */

/* 依文字框大小回推可用字級。pptxgenjs 的 fit:'shrink' 只有在 PowerPoint 開啟後
   才會生效，匯出的檔案本身沒有縮小，樣板的小型文字框就會被大字壓成疊字。
   這裡先在本機算好，保證框裡放得下。 */
/* @function fitFontSize assets/js/pptx-export.js */
/* @function legacyFitFontSize assets/js/pptx-export.js */
/* 同一套版面計算要同時餵給 PPTX 匯出與畫面預覽，兩邊才不會對不起來 */
/* @function pptxSink assets/js/pptx-export.js */
/* @function htmlSink assets/js/pptx-export.js */
/* @function addContentFlowPptx assets/js/pptx-export.js */
/* 每張輸出投影片用了哪一張範例投影片的設計，打包時要據此注入裝飾圖形 */
let DESIGN_ASSIGN={};
let EXPORT_SLIDE_COUNT=0;
/* @function originalTemplateSlideContent assets/js/pptx-export.js */

/* @function downloadBlob assets/js/pptx-export.js */
/* @function pptxFileName assets/js/pptx-export.js */
/* @function nextRelId assets/js/pptx-export.js */
/* @function applyPowerPointTemplate assets/js/pptx-export.js */

/* 母片的可用文字區較小時，不再把整頁縮成小字，而是在匯出版本自動拆續頁。
   原編輯內容不變，所有文字、數字與資料序列都會保留。 */
/* @function prepareTemplateSlides assets/js/pptx-export.js */

/* @function exportPPTX assets/js/pptx-export.js */

/* ---------- 演示模式 ---------- */
let pIdx=0;
/* @function present assets/js/ui-components.js */
/* @function pShow assets/js/ui-components.js */
/* @function pFit assets/js/ui-components.js */
/* @function pClose assets/js/ui-components.js */
addEventListener('resize',()=>{ pFit(); fitAll(); });
addEventListener('keydown',e=>{
  if(document.getElementById('present').classList.contains('on')){
    if(e.key==='Escape') pClose();
    if(e.key==='ArrowRight'||e.key===' ') pShow(pIdx+1);
    if(e.key==='ArrowLeft') pShow(pIdx-1);
  }
});

/* ---------- 畫面 ---------- */
/* @function styleSwatch assets/js/ui-components.js */
/* 從兩個顏色推出中間色，讓自訂風格只要挑三個顏色就好 */
/* @function hexToRgb assets/js/ui-components.js */
/* @function mix assets/js/ui-components.js */
/* @function contrastRatio assets/js/ui-components.js */

/* @function templateTextIssues assets/js/ui-components.js */
/* @function templateChoicePanel assets/js/ui-components.js */
/* @function templateModeInfo assets/js/ui-components.js */
/* @function templateBox assets/js/ui-components.js */

/* @function styleBox assets/js/ui-components.js */
/* @function materialBox assets/js/ui-components.js */

/* @function sourceLibraryBox assets/js/ui-components.js */

/* @function scenarioFilesBox assets/js/ui-components.js */

/* @function textPanel assets/js/ui-components.js */
/* @function builtinChartStyleBox assets/js/ui-components.js */
/* @function chartStyleLibraryBox assets/js/ui-components.js */
/* @function chartPanel assets/js/ui-components.js */
/* @function ensureTextStyle assets/js/ui-components.js */

/* @function viewHome assets/js/ui-editor.js */

/* @function topbar assets/js/ui-editor.js */

/* @function viewEditor assets/js/ui-editor.js */

/* @function viewOwnAI assets/js/ui-editor.js */

/* @function viewChartAI assets/js/ui-editor.js */

/* ---------- 導引模式：照課綱一步一步走 ---------- */
const STEPS = [
  {n:1, t:'選擇情境',      u:'第三單元'},
  {n:2, t:'準備素材',      u:'第三單元'},
  {n:3, t:'建立規範',      u:'第二單元'},
  {n:4, t:'生成大綱',      u:'第三單元'},
  {n:5, t:'風格與母片',    u:'第二單元 2-3'}
];

/* @function wizardBasis assets/js/ui-wizard.js */
/* @function monthlyOutlineNeedsRefresh assets/js/ui-wizard.js */
/* @function wizardCheckpoint assets/js/ui-wizard.js */
/* @function firstBlockedStep assets/js/ui-wizard.js */
/* @function advanceWizard assets/js/ui-wizard.js */
/* @function inferredWizardMaxStep assets/js/ui-wizard.js */
let wizardRefreshTimer=null;
/* @function refreshWizardCheckpoint assets/js/ui-wizard.js */
/* @function applyWizardCheckpoint assets/js/ui-wizard.js */

/* @function stepBar assets/js/ui-wizard.js */
/* @function teach assets/js/ui-wizard.js */
/* @function navRow assets/js/ui-wizard.js */

/* @function viewWizard assets/js/ui-wizard.js */

/* @function readRulesForm assets/js/ui-wizard.js */
/* @function saveRulesForm assets/js/ui-wizard.js */

/* 產生課程格式的 Markdown 大綱 */
/* @function genMD assets/js/ui-wizard.js */

/* @function finishWizard assets/js/ui-wizard.js */

/* @function viewSettings assets/js/ui-settings.js */

/* ---------- 渲染與縮放 ---------- */
/* @function fitAll assets/js/ui-events.js */
/* @function render assets/js/ui-events.js */

/* ---------- 事件 ---------- */
document.addEventListener('click', async e=>{
  const t = e.target.closest('[data-act]'); if(!t) return;
  if(t.dataset.act==='closeModal' && e.target.closest('[data-stop]') && !e.target.closest('button[data-act="closeModal"]')) return;
  const a=t.dataset.act, i=+t.dataset.i, id=t.dataset.id;

  const map = {
    home:()=>{ S.view='home'; S.wizard=false; LS.set('wizardDone',true); saveDraft(); render(); },
    resume:()=>{ S.view='editor'; render(); },
    settings:()=>{ S.modal='settings'; render(); },
    closeModal:()=>{ S.modal=null; S.err=null; render(); },
    clearErr:()=>{ S.err=null; render(); },
    tab:()=>{ S.tab=t.dataset.k; render(); },
    tabExport:()=>{ S.tab='export'; render(); },
    go:()=>{ S.cursor=i; render(); },
    style:()=>{ S.styleId=id; LS.set('styleId',id); saveDraft(); render(); },
    delStyle:()=>{ S.styles=S.styles.filter(s=>s.id!==id); if(S.styleId===id) S.styleId=S.styles[0].id;
      saveCustom(); LS.set('styleId',S.styleId); saveDraft(); render(); },
    layout:()=>{ const s=S.slides[S.cursor]; if(!s) return; pushHistory(S.cursor); ensureLayoutContent(s,t.dataset.k); s.status='edited'; saveDraft(); render(); },
    up:()=>{ if(i>0){ const a2=S.slides; [a2[i-1],a2[i]]=[a2[i],a2[i-1]]; S.cursor=i-1; saveDraft(); render(); } },
    down:()=>{ if(i<S.slides.length-1){ const a2=S.slides; [a2[i+1],a2[i]]=[a2[i],a2[i+1]]; S.cursor=i+1; saveDraft(); render(); } },
    dup:()=>{ S.slides.splice(i+1,0,Object.assign(JSON.parse(JSON.stringify(S.slides[i])),{id:uid(),history:[]})); saveDraft(); render(); },
    del:()=>{ if(S.slides.length<=1) return fail('至少要保留一頁。可以先「新增一頁」再刪掉這頁。');
      S.slides.splice(i,1); S.cursor=Math.max(0,Math.min(S.cursor,S.slides.length-1)); saveDraft(); render(); },
    add:()=>{ S.slides.push({id:uid(),layout:'bullets',title:'新頁面',bullets:[{h:'要點',d:''}],note:'',footer:clipText(S.topic||'',24),status:'draft',history:[]}); S.cursor=S.slides.length-1; saveDraft(); render(); },
    undo:()=>{ if(S.globalUndo&&Array.isArray(S.globalUndo.slides)){ S.slides=S.globalUndo.slides; S.globalUndo=null; saveDraft(); render(); return; }
      const s=S.slides[S.cursor], h=(s.history||[]), prev=h.pop(); if(prev){ S.slides[S.cursor]=Object.assign({},prev,{id:s.id,history:h}); saveDraft(); render(); } },
    present:()=>present(),
    tplPreview:()=>{ S.tplPreview=!S.tplPreview; saveDraft(); render(); },
    refreshTplPreview:()=>{ S.tplPreview=true; saveDraft(); render(); toast('母片預覽已重新整理'); setTimeout(()=>done(),900); },
    autoTemplateCurrent:()=>{ const s=S.slides[S.cursor]; if(!s) return;
      delete s.designIndex; delete s.templateLayoutPath; s.status='edited'; S.tplPreview=true; saveDraft(); render(); },
    autoTemplateAll:()=>{ if(!S.pptTemplate) return;
      S.pptTemplate.mapping=autoTemplateMap(S.pptTemplate.layouts||[]);
      (S.slides||[]).forEach(s=>{ delete s.designIndex; delete s.templateLayoutPath; });
      S.tplPreview=true; saveDraft(); render(); toast('所有頁面已重新自動配版'); setTimeout(()=>done(),1200); },
    addTemplateCover:()=>{ if(!(S.slides||[]).length) return fail('請先完成大綱並建立簡報內容。');
      S.globalUndo={slides:JSON.parse(JSON.stringify(S.slides))};
      S.slides=prepareGeneratedSlides(S.slides); S.cursor=0; S.tplPreview=true;
      saveDraft(); render(); toast('已補上封面，並優先套用母片的封面版面'); setTimeout(()=>done(),1400); },
    goStep:()=>{ syncStep(); const n=+t.dataset.k;
      if(n>S.maxStep) return;
      if(n>S.step){ const blocked=firstBlockedStep(n); if(blocked){ S.step=blocked.step; return fail('步驟 '+blocked.step+' 尚未完成：'+blocked.msg); } }
      S.step=n; saveDraft(); render(); },
    pickScenario:()=>{
      const k=t.dataset.k, sc=SCENARIOS[k];
      const changed=!!S.scenario&&S.scenario!==k;
      S.scenario=k;
      if(!S.brief.trim() || S.brief===((SCENARIOS[S.prevScenario]||{}).material||'')) S.brief=sc.material||'';
      S.prevScenario=k;
      if(sc.role||sc.audience||sc.pages){
        const r=rulesObj();
        if(sc.role) r.role=sc.role;
        if(sc.audience) r.audience=sc.audience;
        r.pages=0;
        if(sc.bulletCount) r.bulletCount=sc.bulletCount;
        LS.set('rulesObj',r);
        S.rules=buildRulesText(r); LS.set('rules',S.rules);
      }
      if(Object.prototype.hasOwnProperty.call(sc,'topic')) S.topic=sc.topic||'';
      if(sc.sourceMode) S.sourceMode=sc.sourceMode;
      if(sc.audience) S.audience=sc.audience;
      S.pages=0;
      S.plan = sc.outline||'';
      if(changed){ S.mdBackup=S.md||S.mdBackup; S.md=''; S.outlineBasis=''; S.maxStep=Math.min(S.maxStep,3); }
      saveDraft(); render();
    },
    resetMat:()=>{ const sc=SCENARIOS[S.scenario]||{}; S.brief=sc.material||''; if(sc.sourceMode) S.sourceMode=sc.sourceMode; saveDraft(); render(); },
    /* 只清文字框。舊版連 S.uploads 與 S.tables 一起清掉，使用者會在毫無提示的情況下
       失去所有已上傳的來源，然後只看到「請貼上內容或上傳一份素材」。 */
    clearMat:()=>{ S.brief=''; S.confirmClearSources=false; saveDraft(); render(); },
    clearSources:()=>{
      if(!(S.uploads||[]).length) return;
      if(!S.confirmClearSources){ S.confirmClearSources=true; render();
        setTimeout(()=>{ if(S.confirmClearSources){ S.confirmClearSources=false; render(); } },6000); return; }
      S.uploads=[]; S.tables=[]; S.lastUploadError=null; S.confirmClearSources=false; saveDraft(); render();
    },
    sourceMode:()=>{ S.sourceMode=t.dataset.k||'latest'; saveDraft(); render(); },
    toggleUpload:()=>{ const u=(S.uploads||[]).find(x=>x.id===id); if(!u) return;
      u.enabled=u.enabled===false; saveDraft(); render(); },
    delUpload:()=>{
      const u=(S.uploads||[]).find(x=>x.id===id); if(!u) return;
      const ids=new Set(u.tableIds||[]);
      S.tables=(S.tables||[]).filter(table=>!ids.has(table.id));
      S.uploads=S.uploads.filter(x=>x.id!==u.id); saveDraft(); render();
    },
    upMatW:()=>pickFiles(ACCEPT, files=>handleUploads(files)),
    upSources:()=>pickFiles(ACCEPT, files=>handleUploads(files)),
    upFolder:()=>pickFolderFiles(ACCEPT, files=>handleUploads(files)),
    toStep2:()=>advanceWizard(2),
    toStep3:()=>advanceWizard(3),
    toStep4:()=>advanceWizard(4),
    toStep5:()=>advanceWizard(5),
    genMD:()=>genMD(),
    finishWizard:()=>finishWizard(),
    wizardPreviewPage:()=>{S.wizardPreviewIndex=Number(t.dataset.i)||0;render();},
    autoArrangeDeck:()=>{
      S.globalUndo={slides:JSON.parse(JSON.stringify(S.slides))};
      S.slides=ensureRequiredCover(S.slides).map(s=>chooseContentLayout(JSON.parse(JSON.stringify(s))));
      saveDraft();render();
    },
    skipWizard:()=>{ syncStep(); S.wizard=false; LS.set('wizardDone',true); saveDraft(); render(); },
    wizard:()=>{ S.wizard=true; S.view='home'; S.maxStep=Math.max(S.maxStep,inferredWizardMaxStep()); S.step=inferredWizardMaxStep(); LS.set('wizardDone',false); saveDraft(); render(); },
    brief:()=>{ readHome(); genFromBrief(); },
    ownai:()=>{ syncStep(); readHome(); S.modal='ownai'; render(); },
    chartAi:()=>{ ensureBriefTables(); const cur=S.slides[S.cursor]||{}, slideId=cur.id||'';
      if(S.chartDraftSlideId!==slideId){ S.chartDraftSlideId=slideId; S.chartDraftTableId=''; S.chartDraftTableLocked=false; S.chartDraftFieldsConfirmed=false; }
      S.modal='chartAi'; render(); },
    upChartStyle:()=>pickFile('.pptx',uploadChartStylePpt),
    chooseTemplatePage:()=>{const s=S.slides[S.cursor]; if(!s)return; pushHistory(S.cursor); s.designIndex=Number(t.dataset.k); s.templateMode='sample';
      /* 手動指定代表使用者願意採用該資訊圖版面，清除先前自動安全判斷；其他頁不受影響。 */
      delete s.templateAutoSafeFor;delete s.templatePlainLayoutFor;delete s.templateSafeDesignIndex;
      S.tplPreview=true; saveDraft();render();},
    templateOriginal:()=>{const s=S.slides[S.cursor];if(!s)return;pushHistory(S.cursor);delete s.designIndex;s.templateMode='master';S.tplPreview=true;saveDraft();render();},
    previewSplit:()=>{S.globalUndo={slides:JSON.parse(JSON.stringify(S.slides))};S.slides=prepareTemplateSlides(regroupFiveItemPages(S.slides));S.cursor=Math.min(S.cursor,S.slides.length-1);saveDraft();render();},
    useTemplateChartStyle:()=>activateTemplateChartStyle(),
    goChartTab:()=>{ S.tab='chart'; render(); },
    chartStyle:()=>{ const style=t.dataset.k||'template-classic', s=S.slides[S.cursor];
      S.chartStyleDefault=style;
      if(s&&s.layout==='chart'&&s.chart&&s.chart.type!=='content'){ pushHistory(S.cursor); s.chart.styleId=style; s.status='edited'; }
      saveDraft(); render(); },
    chartStyleAll:()=>applyChartStyleToSlides(t.dataset.k||'template-classic'),
    clearChartLibrary:()=>{ S.chartStyleLibrary=null; if(/^template-/.test(S.chartStyleDefault||'')) S.chartStyleDefault='auto';
      (S.slides||[]).forEach(s=>{ if(s&&s.chart&&/^template-/.test(s.chart.styleId||'')) s.chart.styleId='auto'; }); saveDraft(); render(); },
    chartSuggest:()=>suggestChart(),
    importChartSpec:()=>importChartSpec(),
    chartBuildManual:()=>{ try{ insertChartSlide(manualChartSpec()); }catch(err){ fail(err.message); } },
    chartQuick:()=>{ try{ insertChartSlide(quickChartSpec()); }catch(err){ fail(err.message); } },
    chartType:()=>{ const s=S.slides[S.cursor]; if(s&&s.chart&&s.chart.type!=='content'&&(s.chart.series||[]).length){ pushHistory(S.cursor); s.chart.type=t.dataset.k; s.status='edited'; saveDraft(); render(); } },
    textToggle:()=>{ const s=S.slides[S.cursor]; if(!s) return; pushHistory(S.cursor);
      const style=ensureTextStyle(s), key=t.dataset.k; style[key]=!style[key]; s.status='edited'; saveDraft(); render(); },
    textAlign:()=>{ const s=S.slides[S.cursor]; if(!s) return; pushHistory(S.cursor);
      ensureTextStyle(s).align=t.dataset.k; s.status='edited'; saveDraft(); render(); },
    textApplyAll:()=>{ const cur=S.slides[S.cursor]; if(!cur) return; const style=JSON.parse(JSON.stringify(slideTextStyle(cur)));
      S.globalUndo={slides:JSON.parse(JSON.stringify(S.slides))};
      S.slides.forEach(s=>{ s.textStyle=JSON.parse(JSON.stringify(style)); s.status='edited'; }); saveDraft(); render(); },
    textReset:()=>{ const s=S.slides[S.cursor]; if(!s) return; pushHistory(S.cursor); s.textStyle=null; s.status='edited'; saveDraft(); render(); },
    copyPrompt:()=>{
      const el=document.getElementById('promptOut'); if(!el) return;
      const say=m=>{ t.textContent=m; setTimeout(()=>{ if(t) t.textContent='複製指令'; },1800); };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(el.value).then(()=>say('已複製 ✓')).catch(()=>fallback());
      } else fallback();
      function fallback(){
        el.removeAttribute('readonly'); el.focus(); el.select(); el.setSelectionRange(0,999999);
        let ok=false; try{ ok=document.execCommand('copy'); }catch(e){}
        el.setAttribute('readonly','readonly');
        say(ok?'已複製 ✓':'已全選，請按 Ctrl+C');
      }
    },
    editRules:()=>{ const b=document.getElementById('rulesBox'); if(b){ S.rules=b.value; S.rulesEdited=true; LS.set('rulesEdited',true); }
      S.rulesOpen=!S.rulesOpen; render(); },
    saveRules:()=>{ const b=document.getElementById('rulesBox'); if(b){ S.rules=b.value; LS.set('rules',S.rules);
        S.rulesEdited=true; LS.set('rulesEdited',true); }
      S.rulesOpen=false; render(); },
    resetRules:()=>{ S.rulesEdited=false; LS.set('rulesEdited',false);
      S.rules=buildRulesText(); LS.set('rules',S.rules); render(); },
    importPasted:()=>importPasted(),
    confirmOutline:()=>{
      syncStep(); const parsed=S.md.trim()?previewParse(S.md):null;
      if(!parsed||!parsed.ok||parsed.thin) return fail(!parsed?'請先貼上或生成大綱。':parsed.ok?'只解析到一頁且沒有條列，請先補齊。':parsed.msg);
      if(monthlyOutlineNeedsRefresh()) return fail('Excel 已成功讀取並算出資料，但目前大綱仍是上傳前的「資料待補」版本。請按「用 AI 生成大綱」重新生成，不要直接確認舊內容。');
      S.outlineBasis=wizardBasis(); saveDraft(); render();
    },
    adv:()=>{ readHome(); S.adv=!S.adv; render(); },
    outline:()=>{ readHome(); genOutline(); },
    local:()=>{ readHome(); genLocal(); },
    mode:()=>{ S.economy = t.dataset.k==='eco'; LS.set('economy',S.economy); render(); },
    prov:()=>{ readCfgFields(); const k=t.dataset.k, q=PROVIDERS[k], old=S.cfg.provider;
      try{ sessionStorage.setItem(sessionKeyName(old),S.cfg.key||''); }catch(e){}
      let nextKey=''; try{ nextKey=sessionStorage.getItem(sessionKeyName(k))||''; }catch(e){}
      /* compatible 沒有預設模型；沿用上一個供應商的模型名稱會留下無效值（例如把 Gemini 的模型名帶到 Groq） */
      S.cfg.provider=k; S.cfg.base=q.base; S.cfg.key=nextKey;
      S.cfg.model=q.model||(k==='compatible'?'':S.cfg.model);
      if(old!==k) S.rememberKey=false;
      S.cfg.gapMs = k==='ollama' ? 0 : (q.rpm ? Math.ceil(62000/q.rpm) : 2000);
      persistCfg(); render(); },
    pickModel:()=>{ readCfgFields(); S.cfg.model=t.dataset.k; persistCfg(); render(); },
    resetUsage:()=>{ LS.set('usage',{d:today(),n:0}); render(); },
    checkLibs:async()=>{
      const box=document.getElementById('libStatus'); if(!box) return;
      box.innerHTML='檢查中…';
      const names={jszip:'PPTX 內容與母片解析',pptx:'PPTX 匯出',mammoth:'Word 解析',xlsx:'Excel 解析',pdfjs:'PDF 解析'};
      const out=[];
      for(const k of Object.keys(LIBS)){
        try{
          const {url}=await loadLib(k);
          const host=/^\.\//.test(url)?'本機 lib 資料夾':url.replace(/^https:\/\//,'').split('/')[0];
          out.push(`<span style="color:var(--cy)">✓</span> ${names[k]}　<span class="mono" style="font-size:13px">${host}</span>`);
        }catch(e){
          out.push(`<span style="color:var(--warn)">✗</span> ${names[k]}　全部來源都連不到`);
        }
        box.innerHTML=out.join('<br>');
      }
      const bad=out.filter(x=>x.includes('✗')).length;
      out.push(bad
        ? `<div style="margin-top:8px;color:var(--warn);line-height:1.6">把對應的 .js 檔下載後放進與本頁面同一層的 <code>lib</code> 資料夾即可離線使用，詳見說明文件。</div>`
        : `<div style="margin-top:8px;color:var(--cy)">全部正常。</div>`);
      box.innerHTML=out.join('<br>');
      S.libStatus=box.innerHTML;
    },
    genAll:()=>genAll(),
    regen:()=>genOne(S.cursor).catch(err=>fail(err.message)),
    revise:()=>{ readEditorFields(); reviseOne(); },
    styleTab:()=>{ readManual(); S.styleTab=t.dataset.k; render(); },
    upTemplate:()=>pickFile('.pptx',uploadPptTemplate),
    clearTemplate:()=>{ S.pptTemplate=null; S.templatePrefs=null; idbTemplate('del'); saveDraft(); render(); },
    mkManual:()=>{
      readManual();
      const bg=S.msBg||'#0E2233', ink=S.msInk||'#EAF4FA', accent=S.msAccent||'#3FD2C7';
      const ns={ id:uid(), name:(S.msName||'').trim()||'自訂風格', desc:'自己選的配色',
        bg, ink, accent, accent2:accent,
        surface:mix(bg,ink,.07), sub:mix(bg,ink,.55), rule:mix(bg,ink,.2),
        grid:false, radius:clampNumber(S.msRadius,0,16,0), serif:!!S.msSerif,
        prompt:'語氣自然、具體。' };
      S.styles=S.styles.concat([ns]); S.styleId=ns.id;
      saveCustom(); LS.set('styleId',ns.id); saveDraft();
      S.msName=''; render();
    },
    mkStyle:()=>{ const el=document.getElementById('styleDesc'); createStyle(el?el.value:''); },
    impStyle:()=>pickFile('.pdf,.png,.jpg,.jpeg',importStyle),
    addMat:()=>{ const el=document.getElementById('matDraft'); if(el&&el.value.trim()){ S.materials.push({id:uid(),name:'貼上的文字 '+(S.materials.length+1),text:el.value.trim()}); saveDraft(); render(); } },
    upMat:()=>pickFile(ACCEPT, async f=>{
      toast('讀取 '+f.name);
      try{ const parsed=await parseUpload(f), text=parsed.text;
        S.materials.push({id:uid(),name:f.name,text,tableIds:(parsed.tables||[]).map(t=>t.id)});
        S.tables=(S.tables||[]).concat(parsed.tables||[]); saveDraft(); done(); }
      catch(e){ fail(friendlyFileError(e)); } }),
    delMat:()=>{ const m=S.materials.find(one=>one.id===id), ids=new Set((m&&m.tableIds)||[]);
      S.materials=S.materials.filter(m=>m.id!==id); S.tables=(S.tables||[]).filter(t=>!ids.has(t.id)); saveDraft(); render(); },
    pptx:()=>exportPPTX(), md:()=>exportOutline(),
    saveCfg:()=>{
      const g=x=>{const el=document.getElementById(x);return el?el.value:'';};
      const maxRaw=Number(g('cMax'));
      if(!Number.isFinite(maxRaw)||maxRaw<500||maxRaw>16000){
        const el=document.getElementById('cMax'); if(el) el.value=clampNumber(maxRaw,500,16000,2000);
        return fail('輸出上限必須介於 500 至 16000 tokens，已調整欄位值，請確認後再儲存。');
      }
      S.cfg=Object.assign({},S.cfg,{key:g('cKey').trim(),base:g('cBase').trim(),model:g('cModel').trim(),
        maxTokens:clampNumber(g('cMax'),500,16000,2000), gapMs:clampNumber(g('cGap'),0,30000,0)});
      const remember=document.getElementById('cRemember'); S.rememberKey=S.cfg.provider==='openai'?false:!!(remember&&remember.checked);
      persistCfg(); S.modal=null; S.err=null; render();
    },
    testAI:async()=>{
      readCfgFields();
      const remember=document.getElementById('cRemember'); S.rememberKey=S.cfg.provider==='openai'?false:!!(remember&&remember.checked);
      toast('正在測試 AI 連線…');
      try{ const out=await askOnce('你是連線測試。','請只回覆 OK。'); persistCfg();
        toast('AI 連線成功'+(out?'，模型已有回應。':'。')); setTimeout(()=>done(),1800); }
      catch(e){ fail('AI 連線測試失敗：'+(e.message||e)); }
    },
    clearKey:()=>{ S.cfg.key=''; S.rememberKey=false; persistCfg(); render(); },
    clearLocalData:()=>{
      if(!S.confirmWipe){ S.confirmWipe=true; render();
        setTimeout(()=>{ if(S.confirmWipe){ S.confirmWipe=false; render(); } },6000); return; }
      try{ Object.keys(localStorage).filter(k=>k.indexOf('sf:')===0).forEach(k=>localStorage.removeItem(k)); }catch(e){}
      try{ Object.keys(sessionStorage).filter(k=>k.indexOf('sf:')===0).forEach(k=>sessionStorage.removeItem(k)); }catch(e){}
      try{ if(window.indexedDB&&indexedDB.deleteDatabase) indexedDB.deleteDatabase('sf-tpl'); }catch(e){}
      toast('已清除這台電腦上的資料，正在重新整理…');
      setTimeout(()=>{ try{ location.reload(); }catch(e){} },700);
    }
  };
  if(map[a]) map[a]();
});

/* 表單即時同步 */
document.addEventListener('input', e=>{
  if(e.target.id==='txtTitleSize'){ const out=document.getElementById('txtTitleOut'); if(out) out.textContent=e.target.value+' pt'; return; }
  if(e.target.id==='txtBodySize'){ const out=document.getElementById('txtBodyOut'); if(out) out.textContent=e.target.value+' pt'; return; }
  if(e.target.id==='txtStatSize'){ const out=document.getElementById('txtStatOut'); if(out) out.textContent=e.target.value+' pt'; return; }
  if(e.target.id==='txtLetterSpacing'){ const out=document.getElementById('txtLetterOut'); if(out) out.textContent=e.target.value; return; }
  if(e.target.id==='txtLineSpacing'){ const out=document.getElementById('txtLineOut'); if(out) out.textContent=e.target.value; return; }
  if(e.target.id==='fBrief'){ S.brief=e.target.value; return; }
  if(e.target.id==='wMat'){
    S.brief=e.target.value;
    const b=document.querySelector('[data-act="toStep3"]'); if(b) b.disabled=!sourceMaterial(30000).trim();
    const c=document.querySelector('#wMatCount'); if(c) c.textContent=S.brief.length+' 字';
    refreshWizardCheckpoint();
    return;
  }
  if(e.target.id==='wMD'){
    S.md=e.target.value;
    const ok=S.md.trim()?previewParse(S.md):null;
    const b=document.querySelector('[data-act="toStep5"]');
    if(b) b.disabled=!(ok&&ok.ok);
    const h=document.getElementById('mdHint');
    if(h){
      if(!ok) h.innerHTML='貼回來之後可以直接改，確認沒問題再往下。';
      else if(ok.ok && ok.thin) h.innerHTML='<span style="color:var(--warn)">只抓到一頁，也沒有條列，'+
        '可能只貼到一半；請補齊後再往下。</span>';
      else if(ok.ok) h.innerHTML='<span style="color:var(--cy)">讀到 '+ok.n+' 頁：'+
        ok.titles.map(x=>esc(x)).join('、')+(ok.n>3?' …':'')+'</span>';
      else h.innerHTML='<span style="color:var(--warn)">'+esc(ok.msg)+'</span>';
    }
    refreshWizardCheckpoint();
    return;
  }
  if(/^r(Role|Aud|Pages|Title|Kicker|Count|Len|Ban|Units)$/.test(e.target.id)){
    const preview=document.getElementById('rulesPreview'), r=readRulesForm();
    if(preview&&r) preview.textContent=buildRulesText(r);
    refreshWizardCheckpoint(); return;
  }
  if(e.target.id==='fPages'){ S.pages=+e.target.value;
    const l=e.target.parentElement.querySelector('.lbl'); if(l) l.textContent='頁數　'+(S.pages||'自動'); }
});
/* @function readHome assets/js/ui-events.js */
/* @function syncStep assets/js/ui-events.js */
/* @function readManual assets/js/ui-events.js */
/* @function readCfgFields assets/js/ui-events.js */
/* @function readEditorFields assets/js/ui-events.js */
document.addEventListener('focusout', e=>{
  if(e.target.id==='fTopic'||e.target.id==='fAud'||e.target.id==='fTone'){ readHome(); saveDraft(); return; }
  if(e.target.id==='fNote'||e.target.id==='fIns'){ readEditorFields(); saveDraft(); return; }
  const ed=e.target.closest('[data-edit]');
  if(ed && ed.isContentEditable){
    applyEdit(S.cursor, ed.dataset.edit, ed.innerText.trim());
  }
});
/* 首頁自由生成區塊會在 render() 後重建；同步開合狀態，避免上傳、切換風格
   或其他既有操作後突然收合。此狀態只保留於當次使用，不寫入草稿或 localStorage。 */
document.addEventListener('toggle',e=>{
  if(e.target&&e.target.matches&&e.target.matches('details[data-home-free]')){
    S.homeFreeOpen=!!e.target.open;
  }
},true);
document.addEventListener('change',e=>{
  if(/^chart(CategoryPick|ValuePick2?|TypePick|LimitPick|TitlePick)$/.test(e.target.id||'')){S.chartDraftFieldsConfirmed=true;refreshChartSelectionSummary();}
  if(e.target.dataset&&Object.prototype.hasOwnProperty.call(e.target.dataset,'chartStyleDefault')){
    const ids=['chartCategoryPick','chartValuePick','chartValuePick2','chartTypePick','chartLimitPick','chartTitlePick'];
    const fields=ids.map(id=>[id,document.getElementById(id)?.value]);
    S.chartStyleDefault=e.target.value||'auto'; saveDraft(); render();
    fields.forEach(([id,value])=>{const el=document.getElementById(id);if(el&&value!=null)el.value=value;}); refreshChartSelectionSummary();return;
  }
  if(e.target.dataset&&Object.prototype.hasOwnProperty.call(e.target.dataset,'chartTable')){
    S.chartDraftTableId=e.target.value||''; S.chartDraftTableLocked=true; S.chartDraftFieldsConfirmed=false;
    S.chartDraftSlideId=((S.slides[S.cursor]||{}).id)||''; render(); return;
  }
  /* 自動比對認錯或認不出來時，使用者可以直接指定哪一份檔案對應哪一項需求 */
  if(e.target.dataset&&e.target.dataset.assignReq){
    const key=e.target.dataset.assignReq, val=e.target.value||'';
    S.uploadAssign=Object.assign({},S.uploadAssign||{});
    if(val) S.uploadAssign[key]=val; else delete S.uploadAssign[key];
    saveDraft(); render();
    return;
  }
  if(e.target.dataset&&e.target.dataset.uploadYear){
    const u=(S.uploads||[]).find(x=>x.id===e.target.dataset.uploadYear), raw=String(e.target.value||'').trim();
    if(u){ u.year=raw?Number(raw):null; u.blockHeader=`【來源檔案：${u.name}${u.year?`｜年份 ${u.year}`:''}${u.pages?`｜${u.pages} 頁`:''}】`; saveDraft(); render(); }
    return;
  }
  if(e.target.dataset&&e.target.dataset.templateMap){
    if(S.pptTemplate){ S.pptTemplate.mapping[e.target.dataset.templateMap]=e.target.value; saveDraft(); render(); }
    return;
  }
  if(e.target.id==='previewTemplateLayout'){
    const cur=S.slides[S.cursor]; if(!cur) return;
    pushHistory(S.cursor); cur.templateLayoutPath=e.target.value||''; cur.status='edited'; S.tplPreview=true; saveDraft(); render(); return;
  }
  if(e.target.id==='previewDesign'){
    const cur=S.slides[S.cursor]; if(!cur) return;
    pushHistory(S.cursor); cur.designIndex=Number(e.target.value)||0; cur.status='edited'; S.tplPreview=true; saveDraft(); render(); return;
  }
  if(e.target.id==='txtDesign'){
    const cur=S.slides[S.cursor]; if(!cur) return;
    pushHistory(S.cursor); cur.designIndex=Number(e.target.value)||0; cur.status='edited'; saveDraft(); render(); return;
  }
  const map={txtFont:'fontFamily',txtFontName:'fontName',txtStatSize:'statSize',txtTitleSize:'titleSize',txtBodySize:'bodySize',txtLetterSpacing:'letterSpacing',txtLineSpacing:'lineSpacing',txtTitleColor:'titleColor',txtBodyColor:'bodyColor'};
  const key=map[e.target.id]; if(!key) return;
  const s=S.slides[S.cursor]; if(!s) return; pushHistory(S.cursor);
  const ts=ensureTextStyle(s);
  ts[key]=['titleSize','bodySize','statSize','letterSpacing','lineSpacing'].includes(key)?Number(e.target.value):e.target.value;
  /* 記住使用者是否真的調過字級；沒調過就沿用全簡報統一的級距 */
  if(key==='titleSize') ts.titleSizeSet=true;
  if(key==='bodySize') ts.bodySizeSet=true;
  if(key==='statSize') ts.statSizeSet=true;
  s.status='edited'; saveDraft(); render();
});
document.getElementById('present').addEventListener('click', e=>{ if(e.target.id==='present') pClose(); });

/* 拖放上傳 */
/* 一律攔下拖放，否則在沒有 dropZone 的畫面（編輯器、首頁）誤放檔案，
   瀏覽器會直接開啟該檔案、離開正在編輯的頁面。 */
['dragenter','dragover'].forEach(ev=>document.addEventListener(ev, e=>{
  e.preventDefault();
  const z=document.getElementById('dropZone'); if(!z) return;
  z.style.borderColor='var(--mark)'; z.style.background='#1A1420';
}));
document.addEventListener('dragleave', e=>{
  const z=document.getElementById('dropZone'); if(!z||e.relatedTarget) return;
  z.style.borderColor='var(--line)'; z.style.background='transparent';
});
document.addEventListener('drop', e=>{
  e.preventDefault();
  const z=document.getElementById('dropZone');
  if(z){ z.style.borderColor='var(--line)'; z.style.background='transparent'; }
  const files=e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
  if(!files.length) return;
  if(z) handleUploads(files);
  else fail('請在「素材與來源」區塊拖入檔案，或用上傳按鈕選檔。');
});

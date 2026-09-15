/* 任意母片相容與圖表一致性補丁（附加式，不修改既有檔案）
   1) 版面配置座標與投影片尺寸不符時改為等比換算，不再整批丟棄。
   2) 範例投影片的文字框先排除跑到版面外或被圖片壓住的框，避免整頁退回乾淨版面。
   3) 仍要退回時保留範例頁裝飾，只把內容移到真正的留白區。
   4) 預覽與 PowerPoint 圖表使用同一組色盤、字級與數值單位。
   5) 重新開啟工具時預設乾淨畫面，舊進度改為可選擇還原。 */

/* ---------- 1. 版面配置座標換算 ----------
   Canva／Google Slides 匯出的 PPTX 常把投影片放大成 20 英吋，版面配置卻仍是
   10 英吋的舊座標。原本的處理是整批丟棄，母片模式因此完全沒有版面資訊。 */
const UTF_CANVASES=[[13.333,7.5],[10,7.5],[12,6.75],[10,5.625],[11,8.5],[7.5,10]];
async function utfRecoverLayoutRects(t){
  const JSZip=(await loadLib('jszip')).lib,zip=await JSZip.loadAsync(t.buffer);
  const masterCache={};
  async function masterMap(layoutPath){
    const rp=relsPath(layoutPath),rf=zip.file(rp);if(!rf)return {};
    const rd=xmlDoc(await rf.async('text'),rp);
    const rel=xmlList(rd,'Relationship').find(x=>/slideMaster$/.test(x.getAttribute('Type')||''));
    const mp=rel?partPath(layoutPath,rel.getAttribute('Target')):'';
    if(!mp)return {};
    if(masterCache[mp])return masterCache[mp];
    const md=xmlDoc(await zipText(zip,mp),mp),map={};
    placeholdersFrom(md).forEach(p=>{ if(p.rect)map[phKey(p.type,p.idx)]=p.rect; });
    return (masterCache[mp]=map);
  }
  const found=[];
  for(const l of t.layouts||[]){
    if(!l.path||l.path==='__auto__'||!zip.file(l.path)){found.push(null);continue;}
    const d=xmlDoc(await zipText(zip,l.path),l.path);
    found.push(placeholdersFrom(d,await masterMap(l.path)));
  }
  return found;
}
function utfApplyRescale(t,recovered){
  const W=Number(t.width)||0,H=Number(t.height)||0;
  const rects=recovered.flat().filter(Boolean).map(p=>p&&p.rect).filter(Boolean);
  if(!(W>0&&H>0)||!rects.length)return false;
  const reachX=Math.max(...rects.map(r=>r.x+r.w)),reachY=Math.max(...rects.map(r=>r.y+r.h));
  const minX=Math.min(...rects.map(r=>r.x)),minY=Math.min(...rects.map(r=>r.y));
  if(!(reachX>0&&reachY>0)||minX<-.02||minY<-.02)return false;
  const canvas=UTF_CANVASES.find(c=>Math.abs((W/H)/(c[0]/c[1])-1)<.015&&reachX<=c[0]+.02&&reachY<=c[1]+.02&&reachX>=c[0]*.70&&reachY>=c[1]*.70);
  if(!canvas)return false;
  const sx=W/canvas[0],sy=H/canvas[1];
  if(Math.abs(sx-1)<.02&&Math.abs(sy-1)<.02)return false;
  (t.layouts||[]).forEach((l,i)=>{
    const src=recovered[i];if(!src)return;
    l.placeholders=src.map(p=>Object.assign({},p,{rect:p.rect?
      {x:p.rect.x*sx,y:p.rect.y*sy,w:p.rect.w*sx,h:p.rect.h*sy}:null}));
  });
  t.placeholderFit=true;
  t.placeholderRescaled=canvas[0]+'×'+canvas[1]+' 英吋 → '+W.toFixed(2)+'×'+H.toFixed(2)+' 英吋';
  if(typeof autoTemplateMap==='function')t.mapping=autoTemplateMap(t.layouts);
  return true;
}
const utfParseBefore=parsePptTemplate;
parsePptTemplate=async function(file){
  const t=await utfParseBefore(file);
  try{
    if(t&&t.placeholderFit===false&&t.buffer)utfApplyRescale(t,await utfRecoverLayoutRects(t));
  }catch(e){}
  return t;
};

/* ---------- 2. 範例投影片文字框的可用性判斷 ---------- */
function utfArea(r){return Math.max(0,Number(r&&r.w)||0)*Math.max(0,Number(r&&r.h)||0);}
function utfOverlap(a,b){
  return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*
         Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
}
function utfClip(r,W,H){
  const x=Math.max(0,r.x),y=Math.max(0,r.y);
  return {x,y,w:Math.min(r.x+r.w,W)-x,h:Math.min(r.y+r.h,H)-y};
}
const utfDesignBoxesBefore=designBoxes;
designBoxes=function(design,W,H){
  W=Number(W)||13.333;H=Number(H)||7.5;
  const base=utfDesignBoxesBefore(design,W,H);
  if(!base)return base;
  /* 範例頁上的圖片：文字若大面積落在上面，輸出到 PowerPoint 一定壓字。 */
  const covers=((design&&design.preview)||[]).filter(p=>p.src&&utfArea(p)>W*H*.01);
  const usable=r=>{
    if(!r||!(r.w>0&&r.h>0))return null;
    if(utfOverlap(r,{x:0,y:0,w:W,h:H})<utfArea(r)*.6)return null;   // 大半在版面外
    const c=utfClip(r,W,H);
    if(!(c.w>W*.04&&c.h>H*.03))return null;
    if(covers.reduce((n,p)=>Math.max(n,utfOverlap(c,p)),0)>utfArea(c)*.45)return null;
    return c;
  };
  return {title:usable(base.title)||utfClip(base.title,W,H),
    bodies:(base.bodies||[]).map(usable).filter(Boolean)};
};

/* ---------- 3. 退回乾淨版面前，先保留裝飾只換內容區 ---------- */
/* 版面上兩張插圖之間的空隙常小於原本要求的最小寬度，找不到就整條橫跨畫面，
   標題因此直接壓在插圖上。改成放不下時逐步放寬，先求不壓到圖。 */
const utfEmptyRegionBefore=emptyDesignRegion;
emptyDesignRegion=function(design,frame,minWidth,minHeight=.35){
  const first=utfEmptyRegionBefore(design,frame,minWidth,minHeight);
  if(first||!design)return first;
  for(const [w,h] of [[.68,.85],[.46,.65]]){
    const r=utfEmptyRegionBefore(design,frame,minWidth*w,minHeight*h);
    if(r)return r;
  }
  return null;
};

function utfClearRegion(design,W,H){
  if(typeof emptyDesignRegion!=='function')return null;
  for(const f of [{x:W*.06,y:H*.22,w:W*.88,h:H*.66},{x:W*.05,y:H*.30,w:W*.90,h:H*.56}]){
    const r=emptyDesignRegion(design,f,W*.22,H*.30);
    if(r&&r.w*r.h>=W*H*.10)return r;
  }
  return null;
}
const UTF_HARD=/重疊|超出投影片邊界|區域無效/;
/* 頁碼與資料來源這類小字是工具自己加的註記，壓到插圖只是小瑕疵；
   不該因為它而放棄整份模板設計。判斷以標題、內文與圖表為準。 */
function utfContentSevere(plan){
  const design=plan&&plan.design;if(!design)return 0;
  return severeDecorativeCollisions(plan).filter(h=>{
    const b=h.box;
    if(b&&b.edit)return true;
    if(b&&Number(b.h)>.42)return true;
    return !b||b.__chart===true;
  }).length;
}
function utfHardIssues(list){return (list||[]).filter(x=>UTF_HARD.test(String(x)));}
const utfTemplatePlanBefore=templatePlan;
templatePlan=function(s,idx=0,layout=null,st=curStyle(),pptx=null){
  const plan=utfTemplatePlanBefore(s,idx,layout,st,pptx);
  const t=S.pptTemplate;
  /* 只接手「自動判斷後整頁放棄範例頁」的情形；使用者自訂內容區或手動指定範例頁不動。 */
  if(!t||!plan||plan.mode!=='safe'||s.templateArea||Number(s.designIndex)||
     !(t.designSlides||[]).length||s.templateFitMode==='preserve')return plan;
  const keep={safe:s.templateAutoSafeFor,plain:s.templatePlainLayoutFor,
    auto:s.templateAutoDesignIndex,mode:s.templateFitMode};
  const restore=()=>{
    delete s.templateArea;s.templateFitMode=keep.mode;
    if(keep.safe)s.templateAutoSafeFor=keep.safe;else delete s.templateAutoSafeFor;
    if(keep.plain)s.templatePlainLayoutFor=keep.plain;else delete s.templatePlainLayoutFor;
    if(keep.auto)s.templateAutoDesignIndex=keep.auto;else delete s.templateAutoDesignIndex;
  };
  const attempt=(design,region)=>{
    delete s.templateAutoSafeFor;delete s.templatePlainLayoutFor;
    s.templateAutoDesignIndex=design.index;
    if(region)s.templateArea={x:region.x/t.width*100,y:region.y/t.height*100,
      w:region.w/t.width*100,h:region.h/t.height*100};
    else delete s.templateArea;
    s.templateFitMode='reflow';
    let c=adaptiveTemplatePlan(s,idx,templateLayoutFor(s.layout,s),st,pptx);
    shrinkTemplateTextToFit(c.ops);
    c=repairTemplateOverlap(c);
    const issues=templateOperationIssues(c.ops),hard=utfHardIssues(issues).length;
    const severe=utfContentSevere(c);
    /* 「需續頁」代表這個方案已經放不下、會少掉條列，不能當作可接受的方案。 */
    const overflow=issues.filter(x=>/需續頁|圖表可用高度不足/.test(String(x))).length;
    const tight=issues.length-hard-overflow;
    return {plan:c,design,region,hard,severe,overflow,tight,soft:issues.length-hard,
      score:hard*1000+severe*200+overflow*400+tight*3+(Number(design.complexity)||0)*.05};
  };
  let best=null;
  try{
    // Rank all designs by usable space before limiting work, including later layouts.
    const list=(t.designSlides||[]).map(d=>{
      const r=utfClearRegion(d,t.width,t.height);
      const cover=/cover|title|封面/i.test(d.name||'');
      return {d,score:(r?utfArea(r):0)+(s.layout==='cover'&&cover?t.width*t.height:0)-(s.layout!=='cover'&&cover?t.width*t.height:0)};
    }).sort((a,b)=>b.score-a.score).slice(0,40).map(x=>x.d);
    /* 乾淨版面用的內容區也列為候選：內容量大時保留範例頁裝飾，
       只要文字與圖表沒有壓到插圖就仍然算安全。 */
    const wide=plan.area&&plan.area.w>0&&plan.area.h>0?{...plan.area}:null;
    const cands=[];
    for(const d of list){
      const region=utfClearRegion(d,t.width,t.height);
      if(region)cands.push({d,region});
      cands.push({d,region:null});
      if(wide)cands.push({d,region:wide});
    }
    for(const c of cands){
      let r;try{ r=attempt(c.d,c.region); }catch(e){ continue; }
      /* 內容偏多只是「需要續頁」的提醒，既有匯出流程本來就會提示；
         不因為這種提醒就把整份模板的設計丟掉。 */
      if(r.hard||r.severe||r.overflow)continue;
      if(!best||r.score<best.score)best=r;
      if(!r.tight)break;
    }
  }catch(e){}
  restore();
  if(!best)return plan;
  /* 以最後選定的範例頁與內容區重算，確保匯出時裝飾與文字來自同一個方案。 */
  try{
    const final=attempt(best.design,best.region);
    const out=final.plan;
    delete s.templateArea;s.templateFitMode=keep.mode;
    s.templateAutoDesignIndex=best.design.index;
    delete s.templateAutoSafeFor;delete s.templatePlainLayoutFor;
    out.mode='designRegion';
    return out;
  }catch(e){ restore(); return plan; }
};

/* 內容超過範例頁留白區時，寧可多一頁續頁，也不要為了塞下去而放棄整份模板設計。
   只在匯出（含「將匯出續頁套入編輯器」）時作用，不改動編輯器內的原始頁面。 */
function utfBestRegion(){
  const t=S.pptTemplate;
  if(!t||!t.designMode||!(t.designSlides||[]).length)return null;
  let best=null;
  for(const d of (t.designSlides||[]).slice(0,40)){
    const r=utfClearRegion(d,t.width,t.height);
    if(r&&(!best||r.w*r.h>best.w*best.h))best=r;
  }
  return best;
}
const utfPrepareBefore=prepareTemplateSlides;
prepareTemplateSlides=function(slides){
  const base=utfPrepareBefore(slides);
  const t=S.pptTemplate,region=utfBestRegion();
  if(!t||!region)return base;
  const th=templateTheme(curStyle(),null);
  const pt=Math.max(16,Math.round(16*templateScale()));
  const opt={fontFace:th.bodyFont,fontSize:pt,margin:0,valign:'top',breakLine:false,
    charSpacing:0,lineSpacingMultiple:1.35,w:region.w};
  const gap=Math.max(.09,t.height*.017);
  const need=items=>items.reduce((sum,b)=>sum+measuredTextHeight(
    [{text:String(b.h||'')},{text:String(b.d||'')}].filter(r=>r.text.trim()),opt),0)
    +gap*Math.max(0,items.length-1);
  const out=[];
  base.forEach(s=>{
    const items=s.bullets||[];
    /* 「完全固定原位置」連頁數也固定，這裡同樣不再依留白區分頁。 */
    if(s.templateFitMode==='preserve'||!['bullets','agenda','closing'].includes(s.layout)||items.length<2||
       need(items)<=region.h+.01){out.push(s);return;}
    const groups=[];let cur=[];
    items.forEach(b=>{
      const next=cur.concat([b]);
      if(cur.length&&need(next)>region.h){groups.push(cur);cur=[b];}else cur=next;
    });
    if(cur.length)groups.push(cur);
    groups.forEach((g,i)=>out.push(Object.assign(JSON.parse(JSON.stringify(s)),{
      title:i?String(s.title||'未命名')+'（續 '+(i+1)+'）':s.title,
      bullets:g,exportContinuation:!!s.exportContinuation||i>0})));
  });
  return out;
};

/* ---------- 4. 圖表：預覽與匯出一致 ----------
   中文簡報習慣「1.2萬」「6.9億」，但 PowerPoint 的數值格式沒有萬／億的除數。
   改成「統一單位換算 + 座標軸單位標示」，兩邊顯示相同，來源資料與原始數值不變。 */
function utfChartDomain(values){
  const finite=values.map(Number).filter(Number.isFinite);
  let min=Math.min(0,...finite),max=Math.max(0,...finite);
  if(max===min)max=min+1;
  // Reserve room at both value-axis ends for labels, without changing data points.
  const padding=(max-min)*.16;
  if(min<0)min-=padding;
  if(max>0)max+=padding;
  return {min,max,span:max-min};
}
function utfChartUnit(chart){
  const vals=((chart&&chart.series)||[]).flatMap(s=>(s.values||[]).map(Number)).filter(Number.isFinite);
  if(!vals.length)return {div:1,suffix:'',decimals:0};
  const max=Math.max(...vals.map(Math.abs));
  const div=max>=1e8?1e8:max>=1e4?1e4:1,suffix=div===1e8?'億':div===1e4?'萬':'';
  const nonzero=vals.map(v=>Math.abs(v)/div).filter(v=>v>0);
  const smallest=Math.min(...nonzero);
  const scientific=max/div>=1e6||smallest<1e-4;
  const decimals=div>1?Math.min(6,Math.max(1,Math.ceil(-Math.log10(smallest))+1)):vals.some(v=>!Number.isInteger(v))?Math.min(6,Math.max(1,Math.ceil(-Math.log10(smallest))+1)):0;
  return {div,suffix,decimals,scientific};
}
function utfUnitNote(chart){
  const u=utfChartUnit(chart);
  if(!u.suffix)return '';
  const s0=(((chart||{}).series||[])[0])||{};
  const raw=String(s0.unit||'').trim()||(String(s0.name||'').match(/（([^（）]{1,6})）\s*$/)||[])[1]||'';
  return '單位：'+u.suffix+raw;
}
const utfFormatCode=u=>u.scientific?'0.0E+00':u.decimals?'#,##0.'+'0'.repeat(u.decimals):'#,##0';
function utfChartScale(){
  const t=S.pptTemplate;
  if(!t)return 1;
  return Math.max(1,Math.min(1.9,Math.min((Number(t.width)||13.333)/13.333,(Number(t.height)||7.5)/7.5)));
}
const utfStylePropsBefore=pptChartStyleProps;
pptChartStyleProps=function(chart,st,count){
  const labels=((chart&&chart.labels)||[]).length;
  const out=utfStylePropsBefore(chart,st,count);
  /* 分類各自著色的樣式（例如「重點比較」）在預覽是每根一個顏色，
     匯出時卻只拿到系列數的色盤。色盤長度改成與預覽同一套計算。 */
  if(out.varyColors&&labels>((out.chartColors||[]).length))
    out.chartColors=utfStylePropsBefore(chart,st,labels).chartColors;
  const k=utfChartScale(),u=utfChartUnit(chart),code=utfFormatCode(u);
  const up=v=>Math.round(Math.max(9,(Number(v)||11)*k));
  out.catAxisLabelFontSize=up(out.catAxisLabelFontSize);
  out.valAxisLabelFontSize=up(out.valAxisLabelFontSize);
  out.dataLabelFontSize=Math.min(12,up(out.dataLabelFontSize));
  if(out.legendFontSize)out.legendFontSize=up(out.legendFontSize);
  if(safeChartType(chart)==='doughnut'){out.__utfDiv=1;return out;}
  out.dataLabelFormatCode=code;
  out.valAxisLabelFormatCode=code;
  if(u.suffix){
    out.showValAxisTitle=true;
    out.valAxisTitle=utfUnitNote(chart);
    out.valAxisTitleFontSize=up(11);
  }
  out.__utfDiv=u.div;                       // 由 addChart 換算，並在送進程式庫前移除
  if(['bar','column','line'].includes(safeChartType(chart))){
    const domain=utfChartDomain((chart.series||[]).flatMap(s=>(s.values||[]).map(v=>Number(v)/u.div)));
    out.valAxisMinVal=domain.min;out.valAxisMaxVal=domain.max;
  }
  return out;
};
/* 兩條匯出路徑（模板 sink 與網站風格）都會呼叫投影片的 addChart，統一在這裡換算。 */
const utfLoadLibBefore=loadLib;
loadLib=async function(name){
  const mod=await utfLoadLibBefore(name);
  try{
    const proto=name==='pptx'&&mod&&mod.lib&&mod.lib.prototype;
    if(proto&&!proto.__utfPatched){
      const addSlide=proto.addSlide;
      proto.addSlide=function(){
        const sl=addSlide.apply(this,arguments);
        if(sl&&typeof sl.addChart==='function'&&!sl.__utfChart){
          const base=sl.addChart.bind(sl);
          sl.addChart=(type,data,opts)=>{
            const o=Object.assign({},opts||{}),div=Number(o.__utfDiv)||1;
            delete o.__utfDiv;
            const rows=(data||[]).map(d=>div===1?d:Object.assign({},d,
              {values:(d.values||[]).map(v=>{const n=Number(v);return Number.isFinite(n)?n/div:v;})}));
            return base(type,rows,o);
          };
          sl.__utfChart=true;
        }
        return sl;
      };
      proto.__utfPatched=true;
    }
  }catch(e){}
  return mod;
};
/* 預覽端使用同一組換算，畫面與 PowerPoint 顯示相同的數字。 */
const utfRenderChartBefore=renderChartHTML;
renderChartHTML=function(chart,st,extra){
  // Advanced objects retain raw values and manage their own axes and table cells.
  if(!chart||chart.type==='content'||['table','scatter','stacked100'].includes(chart.type))return utfRenderChartBefore(chart,st,extra);
  const u=utfChartUnit(chart);
  const scaled=u.div===1?chart:JSON.parse(JSON.stringify(chart));
  if(u.div!==1)(scaled.series||[]).forEach(s=>{ s.values=(s.values||[]).map(v=>{
    const n=Number(v);return Number.isFinite(n)?n/u.div:v; }); });
  const before=chartValueLabel;
  chartValueLabel=n=>{
    const v=Number(n);
    if(!Number.isFinite(v))return '';
    if(u.scientific)return v.toExponential(1);
    return v.toLocaleString('en-US',{minimumFractionDigits:u.decimals,maximumFractionDigits:u.decimals});
  };
  let html;
  try{ html=utfRenderChartBefore(scaled,st,extra); }
  finally{ chartValueLabel=before; }
  /* 單一數列時 PowerPoint 不畫圖例，預覽也不要畫，兩邊才一致。 */
  if(((chart.series||[]).length||0)<=1)
    html=html.replace(/<span style="display:inline-flex;align-items:center;gap:8px;[^"]*">[\s\S]*?<\/span>/g,'');
  const note=utfUnitNote(chart);
  if(note)html=html.replace(/(<div style="height:28px;font-size:15px;color:[^"]*">)/,
    '$1<span style="opacity:.85">'+esc(note)+'</span>');
  return html;
};

/* ---------- 5. 重新開啟時的乾淨畫面 ---------- */
let UTF_RESUMING=false;
(function utfCleanStart(){
  const KEY='prevDraft',FLAG='sf:utfResume';
  /* 使用者按下「還原上次進度」之後的那一次載入不再清空。 */
  try{ if(sessionStorage.getItem(FLAG)){ sessionStorage.removeItem(FLAG); UTF_RESUMING=true; return; } }catch(e){}
  const draft=LS.get('draft',null);
  const has=d=>!!d&&((d.slides||[]).length||(d.materials||[]).length||(d.uploads||[]).length||d.templatePrefs?.name||(d.tables||[]).length||
    String(d.md||'').trim()||String(d.topic||'').trim()||String(d.brief||'').trim());
  if(has(draft))LS.set(KEY,draft);
  LS.del('draft');
  Object.assign(S,{topic:'',audience:'',tone:'',pages:0,brief:'',md:'',mdBackup:'',outlineBasis:'',plan:'',
    materials:[],tables:[],slides:[],uploads:[],uploadAssign:{},scenario:null,prevScenario:null,
    sourceMode:'latest',step:1,maxStep:1,cursor:0,view:'home',globalUndo:null,err:null,busy:null,modal:null});
  Object.assign(S,{pptTemplate:null,templatePrefs:null,templateSessionEdits:{},chartStyleLibrary:null,chartStyleDefault:'auto',instruction:'',adv:false,homeFreeOpen:false});
  S.wizard=true;
  function banner(){
    const d=LS.get(KEY,null);
    if(!d||document.getElementById('utfResume'))return;
    const pages=(d.slides||[]).length,files=(d.uploads||[]).length;
    const bar=document.createElement('div');
    bar.id='utfResume';bar.setAttribute('role','status');
    bar.style.cssText='position:fixed;left:18px;bottom:18px;z-index:9999;max-width:330px;'+
      'background:#12202c;color:#e9f2f8;border:1px solid rgba(255,255,255,.18);border-radius:10px;'+
      'padding:14px 16px;font:14px/1.6 "Noto Sans TC",system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28)';
    bar.innerHTML='<div style="margin-bottom:10px">已開啟乾淨的工作區。上次的進度仍保留著'+
      (pages?'（'+pages+' 頁'+(files?'、'+files+' 份素材':'')+'）':'')+'，需要的話可以還原。</div>'+
      '<button type="button" id="utfGo" style="margin-right:8px;padding:7px 12px;border-radius:7px;border:0;'+
      'background:#3FD2C7;color:#06222a;font-weight:700;cursor:pointer">還原上次進度</button>'+
      '<button type="button" id="utfNo" style="padding:7px 12px;border-radius:7px;border:1px solid rgba(255,255,255,.3);'+
      'background:transparent;color:#e9f2f8;cursor:pointer">保持乾淨</button>';
    document.body.appendChild(bar);
    bar.querySelector('#utfGo').onclick=()=>{
      const prev=LS.get(KEY,null);
      if(prev){LS.set('draft',prev);LS.del(KEY);}
      try{ sessionStorage.setItem(FLAG,'1'); }catch(e){}
      location.reload();
    };
    bar.querySelector('#utfNo').onclick=()=>{bar.remove();};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(banner,0));
  else setTimeout(banner,0);
})();
// Restoring a stored template is opt-in, and must belong to the restored draft.
const utfRestoreBefore=restoreTemplate;
restoreTemplate=async function(){
  if(!UTF_RESUMING||!S.templatePrefs?.name)return;
  const rec=await idbTemplate('get').catch(()=>null);
  if(rec?.name===S.templatePrefs.name)return utfRestoreBefore();
};

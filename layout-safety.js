/* Shared template geometry for preview, pagination and native PowerPoint export. */
const textMeasureCanvas=document.createElement('canvas');
const textMeasureContext=textMeasureCanvas.getContext('2d');
function textValue(v){return Array.isArray(v)?v.map(x=>x.text||'').join('\n'):String(v==null?'':v);}
function measuredTextHeight(value,o){
  const text=textValue(value);if(!text)return 0;
  const pt=Number(o.fontSize)||18, t=S.pptTemplate;
  const cjk=(t&&t.fonts&&(t.fonts.minorEa||t.fonts.majorEa))||'Microsoft JhengHei';
  textMeasureContext.font=`${o.italic?'italic ':''}${o.bold?'bold ':''}${pt}px "${o.fontFace||cjk}", "${cjk}"`;
  const width=Math.max(1,(Number(o.w)||0)*72-pt*.65-4);
  let lines=0;
  for(const paragraph of text.split('\n')){
    let used=0;lines++;
    for(const ch of paragraph){
      const cw=textMeasureContext.measureText(ch).width+Math.max(0,Number(o.charSpacing)||0);
      if(used&&used+cw>width){lines++;used=0;}
      used+=cw;
    }
  }
  // 保留字身與 Office 換字的誤差，但不要雙重灌水：舊版同時套 1.70 下限與 ×1.25，
  // 20pt／行距 1.7 會算成 2.125 倍行高，六條列因此被拆成六頁。
  const ls=Math.max(1.32,(Number(o.lineSpacingMultiple)||1.35)*1.08);
  /* PowerPoint 的東亞字型替換、段落行高與換行位置會比 Canvas 更保守。
     預留 22% Office 誤差，避免瀏覽器判定放得下、真正匯出後最後一行才被裁掉。 */
  return (lines*pt*ls+3)/72*1.22;
}
/* 圖表文字的字級：跟著內文走，但保留可讀下限與上限 */
function chartLabelPt(bodyPt){return Math.max(11,Math.min(20,Math.round((Number(bodyPt)||18)*.7)));}
function operationRecorder(){
  const ops=[], sink={html:false};
  for(const k of ['text','rect','roundRect','chart','notes'])sink[k]=(...args)=>ops.push({kind:k,args});
  return {ops,sink};
}
function intersection(a,b){return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));}
/* 大型自訂畫布只調整自動推算的模板容量，不改寫使用者明確指定的字級。 */
function templateScale(){
  const t=S.pptTemplate;if(!t)return 1;
  return Math.max(.9,Math.min(1.5,Math.min(t.width/13.333,t.height/7.5)));
}
function planProblems(ops){
  const t=S.pptTemplate,out=[],boxes=[];
  for(const op of ops){
    const o=op.kind==='text'?op.args[1]:op.kind==='chart'?op.args[2]:null;if(!o)continue;
    if(op.kind==='text'&&!textValue(op.args[0]).trim())continue;
    const label=o.edit==='title'?'標題':op.kind==='chart'?'圖表':'文字';
    if(![o.x,o.y,o.w,o.h].every(Number.isFinite)||o.w<=0||o.h<=0){out.push(label+'區域無效');continue;}
    if(o.x<-.01||o.y<-.01||o.x+o.w>t.width+.01||o.y+o.h>t.height+.01)out.push(label+'超出投影片邊界');
    const need=(op.kind==='text')?(Number(o.needH)||measuredTextHeight(op.args[0],o)):0;
    if(op.kind==='text'&&need>o.h+.015)out.push(label+'空間不足');
    for(const prev of boxes)if(intersection(o,prev)>.012)out.push(label+'與其他內容重疊');
    boxes.push(o);
  }
  return [...new Set(out)];
}
function rotatedBounds(r){
  const a=Math.abs(Number(r.rot)||0)%180;if(a<.1)return {...r};
  const rad=a*Math.PI/180,c=Math.abs(Math.cos(rad)),s=Math.abs(Math.sin(rad));
  const w=r.w*c+r.h*s,h=r.w*s+r.h*c,cx=r.x+r.w/2,cy=r.y+r.h/2;
  return {...r,x:cx-w/2,y:cy-h/2,w,h};
}
function designObstacles(design){
  const t=S.pptTemplate,W=t.width,H=t.height;
  return ((design&&design.preview)||[]).filter(r=>(r.lineObject||(r.w>W*.018&&r.h>H*.028&&r.w*r.h>W*H*.0015))&&!(r.w>W*.78&&r.h>H*.78))
    .map(rotatedBounds).map(r=>{
      /* PowerPoint 的群組、外框與旋轉物件在實際顯示時常比 XML 邊界略大。
         所有裝飾物都加入安全距離，線條與連接圖再多留一點，避免看似沒有
         幾何交集，實際卻壓到標題或正文。 */
      const pad=r.lineObject?.12:.07;
      return {...r,x:r.x-pad,y:r.y-pad,w:r.w+pad*2,h:r.h+pad*2};
    });
}
function usableDesignCapacity(design,type){
  const t=S.pptTemplate,W=t.width,H=t.height,db=designBoxes(design,W,H),bodies=(db&&db.bodies||[])
    .filter(r=>r.w>=W*.18&&r.h>=H*.12&&r.y+r.h<=H*.94);
  const clear=emptyDesignRegion(design,{x:W*.06,y:H*.23,w:W*.88,h:H*.64},W*.24,H*.28);
  const largest=bodies.slice().sort((a,b)=>b.w*b.h-a.w*a.h)[0]||null;
  let capacity=Math.max(largest?largest.w*largest.h:0,clear?clear.w*clear.h*.86:0),two=false;
  if(type==='twoCol'){
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j],apart=a.x+a.w<=b.x+.08||b.x+b.w<=a.x+.08;
      const same=Math.abs(a.y-b.y)<H*.16;
      if(apart&&same){two=true;capacity=Math.max(capacity,a.w*a.h+b.w*b.h);}
    }
  }
  if(type==='chart')capacity=Math.max(capacity,clear?clear.w*clear.h:0);
  return {capacity,largest,clear,two};
}
function requiredDesignCapacity(slide){
  const t=S.pptTemplate,p=slideContentProfile(slide),scale=templateScale();
  const custom=slide.textStyle&&slide.textStyle.bodySizeSet,pt=Math.max(18,custom?Number(slide.textStyle.bodySize)||18:18*scale);
  let need=p.chars*1.45*Math.pow(pt/72,2)+p.items*.42*scale;
  if(slide.layout==='chart'&&slide.chart&&slide.chart.type!=='content')need=Math.max(need,t.width*t.height*.22);
  if(slide.layout==='twoCol')need=Math.max(need,t.width*t.height*.13);
  if(slide.layout==='cover'||(slide.layout==='closing'&&p.items<2))need=Math.min(need,t.width*t.height*.12);
  return need;
}
const mergedBaseDesignSlideFor=designSlideFor;
designSlideFor=function(type,slide){
  const t=S.pptTemplate;if(!t)return null;
  if(slide&&slide.templateMode==='master')return null;
  /* 安全模式不搬入會與內容碰撞的範例頁裝飾；母片、Logo、頁尾、主題仍保留。 */
  if(slide&&slide.templateAutoSafeFor===t.name)return null;
  if(slide&&Number(slide.designIndex))return mergedBaseDesignSlideFor(type,slide);
  const alternate=(t.designSlides||[]).find(d=>d.index===Number(slide&&slide.templateAutoDesignIndex));
  if(alternate)return alternate;
  if(!t.designMode||!(t.designSlides||[]).length)return null;
  const p=slideContentProfile(slide),need=requiredDesignCapacity(slide),base=t.designMap&&(t.designMap[type]||t.designMap.bullets);
  let best=null,bestScore=-1e9,bestCap=0,bestUsable=null;
  for(const d of t.designSlides){
    const f=designFeatures(d,t.designSlides.length,t.height),u=usableDesignCapacity(d,type);
    let score=Math.min(45,u.capacity/(need||1)*18)+(d.index===base?9:0)-(Number(d.complexity)||0)*.035;
    if(type==='cover')score+=(f.first?60:0)+(f.boxes<=3?5:0);
    if(type==='closing')score+=p.items>1
      ? (f.last?4:0)+Math.min(26,u.capacity/(need||1)*12)
      : (f.last?48:0)+(/thank|謝謝|感謝|conclusion|結論/i.test(f.hint)?24:0);
    if(type==='twoCol')score+=u.two?24:-12;
    if(type==='chart')score+=(f.chart?22:0)+(u.clear&&u.clear.w/u.clear.h>1.25?8:0);
    if(type==='stat')score+=(f.shortBig?18:0);
    if(type==='quote')score+=(/quote|citation|「|“/i.test(f.hint)?16:0);
    if(type!=='cover'&&f.first)score-=9;if(type!=='closing'&&f.last&&t.designSlides.length>2)score-=7;
    if(d.fullSlidePicture&&!u.largest)score-=35;
    if((Number(d.complexity)||0)>45&&(p.chars>60||p.items>1||type==='chart'||type==='twoCol'))score-=70;
    if(score>bestScore){best=d;bestScore=score;bestCap=u.capacity;bestUsable=u;}
  }
  /* 預設忠實保留模板風格。容量不足不在這裡直接捨棄範例頁；後續會先嘗試
     有下限的縮字，再依真正的越界／重疊結果決定是否重排。 */
  return best;
};
function emptyDesignRegion(design,frame,minWidth,minHeight=.35){
  const blocks=designObstacles(design), gap=.07;
  const xs=[frame.x,frame.x+frame.w],ys=[frame.y,frame.y+frame.h];
  for(const r of blocks){
    for(const x of [r.x-gap,r.x+r.w+gap])if(x>frame.x&&x<frame.x+frame.w)xs.push(x);
    for(const y of [r.y-gap,r.y+r.h+gap])if(y>frame.y&&y<frame.y+frame.h)ys.push(y);
  }
  const unique=a=>[...new Set(a.map(n=>Math.round(n*100)/100))].sort((a,b)=>a-b);
  const xx=unique(xs).slice(0,80),yy=unique(ys).slice(0,80);let best=null,score=0;
  for(let i=0;i<xx.length;i++)for(let j=i+1;j<xx.length;j++){
    const w=xx[j]-xx[i];if(w<minWidth)continue;
    for(let a=0;a<yy.length;a++)for(let b=a+1;b<yy.length;b++){
      const r={x:xx[i],y:yy[a],w,h:yy[b]-yy[a]};if(r.h<minHeight)continue;
      const area=r.w*r.h;if(area<=score)continue;
      if(blocks.some(p=>intersection(r,p)>.01))continue;
      score=area;best=r;
    }
  }
  return best;
}
function templateRegion(s,design,titleBottom){
  const t=S.pptTemplate,W=t.width,H=t.height;
  let r={x:W*.075,y:Math.max(H*.25,titleBottom+.12),w:W*.85,h:H*.64};
  const candidates=(designBoxes(design,W,H)?.bodies||[]).filter(b=>b.w>=W*.20&&b.h>=H*.24&&b.y+b.h>titleBottom+H*.25);
  if(candidates.length){
    const obstacles=designObstacles(design), overlap=box=>obstacles.reduce((n,o)=>n+intersection(box,o),0);
    r={...candidates.sort((a,b)=>overlap(a)-overlap(b)||(b.w*b.h-a.w*a.h))[0]};
  }
  const frame={x:W*.075,y:Math.max(H*.25,titleBottom+.12),w:W*.85,h:H*.86-Math.max(H*.25,titleBottom+.12)};
  const clear=emptyDesignRegion(design,frame,W*.19,H*.36);
  /* 先尊重模板文字框；內容明顯超過該框容量時，改用較大的空白區。 */
  const currentArea=r.w*r.h,clearArea=clear?clear.w*clear.h:0,load=slideContentProfile(s);
  const candidateOverlap=design?designObstacles(design).reduce((n,o)=>n+intersection(r,o),0):0;
  /* 圖表優先使用真正沒有插圖遮擋的橫向空白區；其他頁若推測文字框明顯壓到
     圖片或大型裝飾，也先在同一張範例頁中換到可用留白，不急著捨棄整頁風格。 */
  if(clear&&(!candidates.length||
      (s.layout==='chart'&&clearArea>=W*H*.16)||
      (candidateOverlap>currentArea*.08&&clearArea>=currentArea*.58)||
      ((load.chars>150||load.items>=4)&&clearArea>currentArea*1.20)))r=clear;
  if(s.templateArea)r={x:s.templateArea.x/100*W,y:s.templateArea.y/100*H,w:s.templateArea.w/100*W,h:s.templateArea.h/100*H};
  r.x=Math.max(W*.025,Math.min(r.x,W*.90));r.w=Math.max(W*.06,Math.min(r.w,W*.975-r.x));
  r.y=Math.max(titleBottom+.12,r.y);r.h=Math.max(.01,Math.min(r.h,H*.86-r.y));
  return r;
}
function adaptiveTemplatePlan(s,idx,layout,st,pptx){
  const t=S.pptTemplate,W=t.width,H=t.height, {ops,sink}=operationRecorder(), th=templateTheme(st,layout), design=designSlideFor(s.layout,s);
  const safeMode=s.templateAutoSafeFor===t.name;
  const tx=s.textStyle?slideTextStyle(s):null, hx=c=>String(c||'#000000').replace('#','');
  const font=tx&&tx.fontName?tx.fontName:th.bodyFont;
  const bodyPt=Math.max(16,tx&&tx.bodySizeSet?tx.bodySize:th.bodySize||18);
  let titlePt=Math.max(24,tx&&tx.titleSizeSet?tx.titleSize:deckTitlePt(st));
  /* 封面標題在非母片模式本來就會放大一級，套母片後不該反而縮回內頁大小 */
  if(s.layout==='cover'&&!(tx&&tx.titleSizeSet)) titlePt=Math.round(titlePt*1.15);
  /* 字距要帶進來，行距也要照使用者設定走——舊版的 Math.max(1.36,…) 會把調小的行距吃掉，
     字距則從頭到尾沒有出現在這個物件裡，所以文字面板那兩根滑桿在母片模式完全沒作用。 */
  const base={fontFace:font,fontSize:bodyPt,color:hx(tx&&tx.bodyColor||th.sub),margin:0,valign:'top',breakLine:false,
    charSpacing:tx?Number(tx.letterSpacing)||0:0,
    lineSpacingMultiple:tx?Math.max(1.05,Number(tx.lineSpacing)||1.35):1.35};
  const db=designBoxes(design,W,H), rawTitle=!safeMode&&db&&db.title;
  let title={x:W*.075,y:H*.055,w:W*.85};
  if(rawTitle&&rawTitle.w>=W*.35&&rawTitle.y<H*.18)title={x:Math.max(W*.025,rawTitle.x),y:Math.max(H*.03,rawTitle.y),w:Math.min(rawTitle.w,W*.95-rawTitle.x)};
  const titleClear=!safeMode&&emptyDesignRegion(design,{x:W*.075,y:H*.04,w:W*.85,h:H*.20},W*.35);
  if(titleClear)title={x:titleClear.x,y:titleClear.y,w:titleClear.w};
  const titleOpts={...base,...title,fontFace:tx&&tx.fontName?tx.fontName:th.titleFont,fontSize:titlePt,bold:tx?!!tx.titleBold:true,color:hx(tx&&tx.titleColor||th.ink),edit:'title'};
  titleOpts.h=measuredTextHeight(s.title,titleOpts);
  sink.text(s.title||'',titleOpts);
  const area=safeMode
    ? {x:W*.075,y:Math.max(H*.25,titleOpts.y+titleOpts.h+.12),w:W*.85,h:H*.86-Math.max(H*.25,titleOpts.y+titleOpts.h+.12)}
    : templateRegion(s,design,titleOpts.y+titleOpts.h);let y=area.y;
  let gap=Math.max(.09,H*.017);
  let dropped=0;
  const areaBottom=()=>area.y+area.h;
  const fits=h=>!(y+h>areaBottom()+0.01&&y>area.y+0.01)&&y+h<=H-0.25;
  function add(value,edit,extra={}){
    if(!textValue(value).trim())return;
    const o={...base,x:area.x,y,w:area.w,...extra,edit};o.h=measuredTextHeight(value,o);
    /* 超出內容區就不再往下畫。舊版只是一路累加 y，最後幾條會落在投影片外面，
       畫面上直接看到文字掉出去。放不下的交給續頁，並在頁面上說明。 */
    if(!fits(o.h)){ dropped++; return; }
    sink.text(value,o);y+=o.h+gap;
  }
  /* 一條條列的標題與說明合併成同一個文字框。兩個框就是兩份內距、兩倍間距，
     六條列會變成十二個框十一個間距，內容區當然放不下，於是一路拆頁。 */
  function addRuns(runs){
    runs=runs.filter(r=>String(r.text||'').trim());
    if(!runs.length) return;
    runs.forEach((r,i)=>{ r.options=Object.assign({},r.options,{breakLine:i<runs.length-1}); });
    if(runs.length===1){ const r=runs[0]; return add(r.text,r.options.edit,{bold:!!r.options.bold,color:r.options.color||undefined}); }
    const o={...base,x:area.x,y,w:area.w};o.h=measuredTextHeight(runs,o);
    if(!fits(o.h)){ dropped++; return; }
    sink.text(runs,o);y+=o.h+gap;
  }
  /* 續頁不重複核心結論。exportContinuation 這個旗標本來就有寫入，只是沒有任何地方讀它；
     每一頁都重印一次結論，等於把內容區吃掉一大塊，續頁因此越拆越多。 */
  if(s.kicker&&!s.exportContinuation)add(s.kicker,'kicker',{bold:true,color:hx(th.accent)});
  if(s.layout==='chart'&&s.chart&&s.chart.type!=='content'){
    const ch=s.chart, type=safeChartType(ch), data=(ch.series||[]).map(one=>({name:chartUnitName(one),labels:ch.labels||[],values:(one.values||[]).map(pptChartValue)}));
    const h=area.y+area.h-y;
    sink.chart(type==='line'?'line':type==='doughnut'?'doughnut':'bar',data,{x:area.x,y,w:area.w,h:Math.max(.1,h),
      barDir:type==='bar'?'bar':'col',showTitle:false,showLegend:data.length>1,legendPos:'b',showCatName:false,showBorder:false,
      /* 圖表座標與數值標籤跟著使用者的內文字級走。固定 12pt 會讓套完母片的圖表
         看起來比預覽小一號，也是「字被壓縮」的來源之一。 */
      catAxisLabelFontFace:font,valAxisLabelFontFace:font,
      catAxisLabelFontSize:chartLabelPt(bodyPt),valAxisLabelFontSize:chartLabelPt(bodyPt),dataLabelFontSize:chartLabelPt(bodyPt),
      catAxisLabelRotate:type==='column'&&(ch.labels||[]).some(l=>String(l).length>6)?-35:0,
      showCatAxis:type!=='doughnut',showValAxis:type!=='doughnut',lineSize:3,
      ...pptChartStyleProps(ch,{...st,accent:th.accent,accent2:th.accent2,ink:th.ink,sub:th.sub,rule:th.sub,bg:th.surface},type==='doughnut'?data[0]?.labels.length||1:data.length)});
    if(h<1.4)ops.push({kind:'problem',args:['圖表可用高度不足']});
    y+=h;
  }else if(s.layout==='chart'&&s.chart){
    (s.chart.items||[]).forEach((item,i)=>addRuns([
      {text:String(i+1)+'. '+(item.label||''),options:{bold:true}},
      {text:String(item.detail||''),options:{}}]));
  }else if(s.layout==='twoCol'){
    /* 特殊模板進入重排模式時仍維持真正雙欄；舊邏輯把兩欄依序往下排，
       不但失去比較語意，第二欄也容易壓到第一欄最後一段。 */
    const cols=(s.columns||[]).slice(0,2), colGap=cols.length>1?Math.max(.24,W*.025):0;
    const colW=cols.length>1?(area.w-colGap)/2:area.w;
    let maxBottom=area.y;
    cols.forEach((c,i)=>{
      const cx=area.x+i*(colW+colGap);let cy=area.y;
      const put=(value,edit,extra={})=>{
        if(!textValue(value).trim())return;
        const o={...base,x:cx,y:cy,w:colW,...extra,edit};o.h=measuredTextHeight(value,o);
        if(cy+o.h>areaBottom()+.01){dropped++;return;}
        sink.text(value,o);cy+=o.h+gap;
      };
      put(c.h,`c:${i}:h`,{bold:true,color:hx(i?th.accent2:th.accent)});
      (c.items||[]).forEach((v,j)=>put(String(v==null?'':v),`c:${i}:items:${j}`));
      maxBottom=Math.max(maxBottom,cy);
    });
    y=maxBottom;
  }else if(s.layout==='stat'){
    /* 數據頁的大數字照使用者在「文字」面板設定的字級走。
       舊版一律壓到 Math.min(54, titlePt*1.5)，設 96pt 會被砍成 52.5pt。
       真的放不下時才逐級調降，而且會留下紀錄讓編輯器提示，不默默縮小。 */
    const wantStat=statPt(tx,Math.max(54,Math.min(96,Math.round(titlePt*1.6))));
    const statFloor=Math.max(40,bodyPt*2);
    const probe={...base,x:area.x,y,w:area.w,bold:true,fontSize:wantStat};
    let statPtUse=wantStat, room=Math.max(.6,area.y+area.h-y-(s.stat&&s.stat.label?bodyPt/72*2:0));
    while(statPtUse>statFloor&&measuredTextHeight(s.stat&&s.stat.value,{...probe,fontSize:statPtUse})>room) statPtUse-=4;
    if(statPtUse<wantStat) ops.push({kind:'problem',args:['數據字級已由 '+wantStat+'pt 調整為 '+statPtUse+'pt 才放得下，可加大內容區或縮短說明']});
    add(s.stat&&s.stat.value,'stat:value',{fontSize:statPtUse,bold:true,color:hx(th.accent)});
    add(s.stat&&s.stat.label,'stat:label');
  }else if(s.layout==='quote'){
    add(s.quote&&s.quote.text,'quote:text',{italic:true});add(s.quote&&s.quote.by,'quote:by');
  }else{
    add(s.subtitle,'subtitle');
    // Fit up to five complete items before considering a continuation page.
    // Change font size uniformly, never stretch text or discard descriptions.
    const items=s.bullets||[];
    if(items.length>0&&items.length<=5&&s.templateFitMode!=='preserve'){
      const runs=items.map(b=>[{text:String(b.h||'')},{text:String(b.d||'')}].filter(r=>r.text.trim()));
      const needed=()=>runs.reduce((sum,r)=>sum+measuredTextHeight(r,{...base,w:area.w}),0)+gap*Math.max(0,runs.length-1);
      const room=areaBottom()-y;
      if(needed()>room)gap=Math.min(gap,Math.max(.07,H*.009));
      const floor=Math.max(16,Math.round(16*templateScale()));
      while(base.fontSize>floor&&needed()>room)base.fontSize=Math.max(floor,base.fontSize-1);
    }
    (s.bullets||[]).forEach((b,i)=>addRuns([
      {text:String(b.h||''),options:{bold:true,edit:`b:${i}:h`}},
      {text:String(b.d||''),options:{edit:`b:${i}:d`}}]));
  }
  if(dropped>0){
    const o={...base,x:area.x,y:Math.min(y,H-0.55),w:area.w,fontSize:Math.max(11,Math.round(bodyPt*.6)),color:hx(th.sub),h:0.24};
    sink.text(`（此版面容量有限，其餘 ${dropped} 項會排入續頁）`,o);
    ops.push({kind:'problem',args:['內容區高度不足，需續頁']});
  }
  if(y-gap>area.y+area.h+.01)ops.push({kind:'problem',args:['內容區高度不足，需續頁']});
  const source=(s.chart&&s.chart.source)||slideSourceFooter(s);
  const footer=[(source&&!s.exportContinuation)?'資料來源：'+source:'',s.footer||''].filter(Boolean).join('\n');
  if(footer){const o={...base,x:W*.075,y:H*.89,w:W*.70,fontSize:10};o.h=measuredTextHeight(footer,o);sink.text(footer,o);}
  if(s.layout!=='cover'&&!templateHasNativePageNumber(layout)){
  const numberOpts={...base,x:W*.84,y:H*.93,w:W*.09,fontSize:10,align:'right'};
  numberOpts.h=measuredTextHeight(String(idx+1).padStart(2,'0'),numberOpts);
  sink.text(String(idx+1).padStart(2,'0'),numberOpts);
  }
  if(s.note)sink.notes(s.note);
  return {ops,mode:safeMode?'safe':'reflow',area,design};
}
function decorativeCollisions(plan){
  const design=plan&&plan.design;if(!design)return [];
  const blocks=designObstacles(design),hits=[];
  for(const op of plan.ops||[]){
    const box=op.kind==='text'?op.args[1]:op.kind==='chart'?op.args[2]:null;
    if(!box||!box.w||!box.h||(op.kind==='text'&&!textValue(op.args[0]).trim()))continue;
    const area=box.w*box.h;
    for(const obstacle of blocks){
      const overlap=intersection(box,obstacle);if(overlap<=Math.max(.008,area*.018))continue;
      /* 完整包住文字的純色底板屬於模板預留區，不視為碰撞。 */
      const panel=!obstacle.src&&!obstacle.lineObject&&overlap>=area*.84;
      if(!panel){hits.push({box,obstacle});break;}
    }
  }
  return hits;
}
function severeDecorativeCollisions(plan){
  const design=plan&&plan.design;if(!design)return [];
  const blocks=designObstacles(design),hits=[];
  for(const op of plan.ops||[]){
    const box=op.kind==='text'?op.args[1]:op.kind==='chart'?op.args[2]:null;
    if(!box||!box.w||!box.h||(op.kind==='text'&&!textValue(op.args[0]).trim()))continue;
    const area=box.w*box.h;
    for(const obstacle of blocks){
      const overlap=intersection(box,obstacle);
      const panel=!obstacle.src&&!obstacle.lineObject&&overlap>=area*.84;
      if(!panel&&overlap>Math.max(.025,area*.10)){hits.push({box,obstacle});break;}
    }
  }
  return hits;
}
function templateShrinkMinimum(o){
  const edit=String(o&&o.edit||''), current=Number(o&&o.fontSize)||18;
  if(edit==='title')return Math.min(current,24);
  if(edit==='stat:value')return Math.min(current,28);
  if(edit==='quote:text')return Math.min(current,20);
  if(edit==='subtitle'||edit==='kicker'||edit==='stat:label'||edit==='quote:by')return Math.min(current,16);
  /* 主要內容維持老人家也較容易閱讀的 16pt 下限；頁碼、頁尾等非編輯文字不動。 */
  return edit?Math.min(current,16):current;
}
function measuredUnwrappedTextWidth(value,o){
  const t=S.pptTemplate,pt=Number(o.fontSize)||18,cjk=(t&&t.fonts&&(t.fonts.minorEa||t.fonts.majorEa))||'Microsoft JhengHei';
  textMeasureContext.font=`${o.italic?'italic ':''}${o.bold?'bold ':''}${pt}px "${o.fontFace||cjk}", "${cjk}"`;
  return Math.max(...textValue(value).split('\n').map(line=>textMeasureContext.measureText(line).width+
    Math.max(0,line.length-1)*Math.max(0,Number(o.charSpacing)||0)),0)/72*1.04;
}
function shrinkTemplateTextToFit(ops){
  let changed=0;
  for(const op of ops||[]){
    if(op.kind!=='text')continue;
    const value=op.args[0],o=op.args[1];
    if(!o||!o.edit||!textValue(value).trim()||!Number.isFinite(Number(o.h)))continue;
    const min=templateShrinkMinimum(o), original=Number(o.fontSize)||18;
    let size=original,need=measuredTextHeight(value,o);
    const singleLine=['title','stat:value','quote:text'].includes(String(o.edit||''));
    let tooWide=singleLine&&measuredUnwrappedTextWidth(value,o)>Number(o.w)*.985;
    while((need>Number(o.h)+.015||tooWide)&&size>min){
      size=Math.max(min,size-1);
      o.fontSize=size;
      need=measuredTextHeight(value,o);
      tooWide=singleLine&&measuredUnwrappedTextWidth(value,o)>Number(o.w)*.985;
    }
    o.needH=need;
    if(size<original){o.templateShrunkFrom=original;changed++;}
  }
  return changed;
}
function templateOperationIssues(ops){
  return [...new Set([...planProblems(ops),...(ops||[]).filter(o=>o.kind==='problem').map(o=>o.args[0])])];
}
/* 只修正已發生的內容互撞；候選方案必須完整通過檢查才採用。
   不改文字、數值、字型、圖表或母片；失敗時保留原方案交給原有續頁流程。 */
function repairTemplateOverlap(plan){
  if(!planProblems(plan.ops).some(x=>x.includes('重疊')))return plan;
  const candidate={...plan,ops:plan.ops.map(op=>({kind:op.kind,args:op.args.map(a=>
    a&&typeof a==='object'?JSON.parse(JSON.stringify(a)):a)}))};
  const movable=[],fixed=[];
  for(const op of candidate.ops){
    const o=op.kind==='text'?op.args[1]:op.kind==='chart'?op.args[2]:null;
    if(!o||op.kind==='text'&&!textValue(op.args[0]).trim())continue;
    const paths=op.kind==='text'?[o.edit,...(Array.isArray(op.args[0])?op.args[0].map(r=>r.options&&r.options.edit):[])].filter(Boolean):[];
    if(paths.length&&!paths.includes('title'))movable.push(o);else fixed.push(o);
  }
  movable.sort((a,b)=>a.y-b.y||a.x-b.x);
  const gap=.08,bottom=S.pptTemplate.height*.87;
  for(const o of movable){
    for(let attempt=0;attempt<=fixed.length;attempt++){
      const hits=fixed.filter(p=>intersection(o,p)>.012);
      if(!hits.length)break;
      const next=Math.max(...hits.map(p=>p.y+p.h))+gap;
      // 僅容許局部移動，不能把內容搬到另一個區域或頁尾。
      if(next-o.y>S.pptTemplate.height*.18||next+o.h>bottom)return plan;
      o.y=next;
    }
    fixed.push(o);
  }
  if(planProblems(candidate.ops).length||severeDecorativeCollisions(candidate).length)return plan;
  candidate.overlapAdjusted=true;
  return candidate;
}
function alternateTemplatePlan(s,idx,layout,st,pptx,currentPlan){
  const t=S.pptTemplate, current=currentPlan&&currentPlan.design, originalAuto=s.templateAutoDesignIndex;
  let best=null,bestScore=Infinity,bestIndex=0;
  for(const d of (t.designSlides||[]).slice(0,60)){
    if(current&&d.index===current.index)continue;
    s.templateAutoDesignIndex=d.index;
    delete s.templateAutoSafeFor;delete s.templatePlainLayoutFor;
    const candidate=adaptiveTemplatePlan(s,idx,templateLayoutFor(s.layout,s),st,pptx);
    shrinkTemplateTextToFit(candidate.ops);
    const issues=templateOperationIssues(candidate.ops),hits=severeDecorativeCollisions(candidate);
    const f=designFeatures(d,t.designSlides.length,t.height);
    let semanticPenalty=0;
    if(s.layout==='cover'&&!f.first)semanticPenalty+=18;
    if(s.layout==='chart'&&!f.chart)semanticPenalty+=6;
    if(s.layout==='twoCol'&&!usableDesignCapacity(d,'twoCol').two)semanticPenalty+=5;
    const score=issues.length*1000+hits.length*120+semanticPenalty+(Number(d.complexity)||0)*.05;
    if(score<bestScore){bestScore=score;best=candidate;bestIndex=d.index;}
    if(!issues.length&&!hits.length&&semanticPenalty===0)break;
  }
  if(!best){
    if(originalAuto)s.templateAutoDesignIndex=originalAuto;else delete s.templateAutoDesignIndex;
    return null;
  }
  s.templateAutoDesignIndex=bestIndex;
  /* 再算一次，確保 DESIGN_ASSIGN 指向最後選定的範例頁，而不是搜尋過程中的最後一頁。 */
  best=adaptiveTemplatePlan(s,idx,templateLayoutFor(s.layout,s),st,pptx);
  shrinkTemplateTextToFit(best.ops);
  best.mode='alternate';
  return best;
}
function templatePlan(s,idx=0,layout=null,st=curStyle(),pptx=null){
  const autoMode=!s.templateFitMode||s.templateFitMode==='auto';
  /* 預設忠實套用模板：不要只因頁型或文字量就移除範例頁裝飾。安全標記只保留給
     本次實際檢查仍無法排除的越界、內容互撞或裝飾碰撞。 */
  if(autoMode&&s.templateAutoSafeFor===S.pptTemplate.name){
    delete s.templateAutoSafeFor;delete s.templatePlainLayoutFor;delete s.templateSafeDesignIndex;
  }
  if(autoMode)delete s.templateAutoDesignIndex;
  /* 自動模式每次都從原始模板重新評估，避免前一次安全回退永久把這一頁鎖在乾淨版面。 */
  layout=autoMode?templateLayoutFor(s.layout,s):(layout||templateLayoutFor(s.layout,s));
  const preDesign=designSlideFor(s.layout,s);
  const record=operationRecorder();
  try{originalTemplateSlideContent(record.sink,s,idx,layout,st,pptx||{ChartType:{line:'line',doughnut:'doughnut',bar:'bar'}});}catch(e){record.ops.push({kind:'problem',args:[e.message]});}
  for(const op of record.ops)if(op.kind==='text'){
    const o=op.args[1]; delete o.fit; delete o.autoFit; delete o.shrinkText;
    /* 自動模式允許必要時縮字；固定原位模式仍完整尊重使用者指定字級。 */
    if(o.edit&&s.templateFitMode==='preserve')o.fontSize=Math.max(16,Number(o.fontSize)||18);
    /* 需求高另存欄位，不要直接撐大框高。
       舊版先撐大再檢查，「空間不足」那一條因此永遠不會成立，
       只剩重疊與越界兩項，而且撐大後還會製造出原本沒有的假重疊。 */
    o.needH=measuredTextHeight(op.args[0],o);
  }
  if(autoMode)shrinkTemplateTextToFit(record.ops);
  let originalPlan={ops:record.ops,mode:'original',design:preDesign};
  if(s.templateFitMode!=='preserve')originalPlan=repairTemplateOverlap(originalPlan);
  record.ops=originalPlan.ops;
  /* 使用模板原生文字框時，裝飾與文字的相鄰或包覆通常是設計的一部分；先以內容本身
     的越界與互撞為準，不因頁型或微小裝飾交集直接切換成乾淨版面。 */
  const needsFlow=s.templateFitMode==='reflow'||s.templateArea||record.ops.some(op=>op.kind==='problem')||planProblems(record.ops).length||severeDecorativeCollisions(originalPlan).length;
  if(needsFlow&&s.templateFitMode!=='preserve'){
    let plan=adaptiveTemplatePlan(s,idx,layout,st,pptx);
    shrinkTemplateTextToFit(plan.ops);
    plan=repairTemplateOverlap(plan);
    let unresolved=templateOperationIssues(plan.ops).length, severe=severeDecorativeCollisions(plan).length;
    if((unresolved||severe)&&plan.design&&!Number(s.designIndex)){
      const alternate=alternateTemplatePlan(s,idx,layout,st,pptx,plan);
      if(alternate){
        plan=alternate;unresolved=templateOperationIssues(plan.ops).length;severe=severeDecorativeCollisions(plan).length;
      }
    }
    /* 重排後以文字／圖表本身的越界與互撞作為安全回退依據。範例頁上的色塊、
       線條與圖示常刻意貼近文字，不能再因小幅裝飾交集就整頁移除風格。 */
    if((unresolved||severe)&&plan.design&&s.templateAutoSafeFor!==S.pptTemplate.name){
      s.templateAutoSafeFor=S.pptTemplate.name;s.templatePlainLayoutFor=S.pptTemplate.name;delete s.templateSafeDesignIndex;
      delete DESIGN_ASSIGN[idx];plan=adaptiveTemplatePlan(s,idx,templateLayoutFor(s.layout,s),st,pptx);shrinkTemplateTextToFit(plan.ops);plan.mode='safe';
      plan=repairTemplateOverlap(plan);
    }
    return plan;
  }
  return originalPlan;
}
function templatePlanIssues(plan){return [...new Set([...planProblems(plan.ops),...plan.ops.filter(o=>o.kind==='problem').map(o=>o.args[0])])];}
function addTemplateSlideContent(sink,s,idx,layout,st,pptx,preparedPlan){
  const finalPlan=preparedPlan||templatePlan(s,idx,layout,st,pptx);
  /* 匯出裝飾與文字必須使用同一份最後方案，不使用候選搜尋留下的索引。 */
  if(finalPlan.design&&finalPlan.mode!=='safe')DESIGN_ASSIGN[idx]=finalPlan.design.index;
  else delete DESIGN_ASSIGN[idx];
  for(const op of finalPlan.ops){
    if(op.kind==='problem')continue;
    /* PowerPoint 的中文行尾標點可能懸掛到框外，保留小幅右側內距。 */
    if(op.kind==='text'&&op.args[1].margin===0&&
      (op.args[1].edit||(Array.isArray(op.args[0])&&op.args[0].some(r=>r.options&&r.options.edit))))op.args[1].margin=[0,8,0,0];
    if(op.kind==='chart'&&sink.html){
      const o=op.args[2],t=S.pptTemplate,th=templateTheme(st,layout);
      sink.parts.push(`<div class="template-chart-preview" style="position:absolute;left:${o.x/t.width*100}%;top:${o.y/t.height*100}%;width:${o.w/t.width*100}%;height:${o.h/t.height*100}%">${renderChartHTML(s.chart,{...st,accent:th.accent,accent2:th.accent2,ink:th.ink,sub:th.sub})}</div>`);
    }else sink[op.kind](...op.args);
  }
}
templateTextIssues=function(s){return s&&S.pptTemplate?templatePlanIssues(templatePlan(s)):[];};
function splitTextExact(value){
  const chars=Array.from(String(value||''));if(chars.length<2)return null;
  let cut=Math.floor(chars.length/2);
  for(let i=cut;i>cut*.65;i--)if(/[。；，、\n ]/.test(chars[i-1])){cut=i;break;}
  return [chars.slice(0,cut).join(''),chars.slice(cut).join('')];
}
function splitTemplateContent(s){
  const clone=()=>JSON.parse(JSON.stringify(s)),a=clone(),b=clone();
  const half=list=>[list.slice(0,Math.ceil(list.length/2)),list.slice(Math.ceil(list.length/2))];
  if(s.layout==='chart'&&s.chart){
    const c=s.chart;
    if(c.type!=='content'&&(c.labels||[]).length>1&&safeChartType(c)!=='doughnut'){
      const [la,lb]=half(c.labels),n=la.length;a.chart.labels=la;b.chart.labels=lb;
      a.chart.series=c.series.map(x=>({...x,values:x.values.slice(0,n)}));b.chart.series=c.series.map(x=>({...x,values:x.values.slice(n)}));return [a,b];
    }
    if(c.type==='content'&&(c.items||[]).length>1){[a.chart.items,b.chart.items]=half(c.items);return [a,b];}
  }
  if((s.bullets||[]).length>1){[a.bullets,b.bullets]=half(s.bullets);return [a,b];}
  if(s.layout==='twoCol'){
    const populated=(s.columns||[]).filter(c=>c.h||(c.items||[]).length);
    if(populated.length>1){[a.columns,b.columns]=half(populated);return [a,b];}
    const c=populated[0];if(c&&(c.items||[]).length>1){const [x,y]=half(c.items);a.columns=[{...c,items:x}];b.columns=[{...c,items:y}];return [a,b];}
  }
  const fields=[];
  if(s.subtitle)fields.push(['subtitle']);
  (s.bullets||[]).forEach((v,i)=>{if(v.d)fields.push(['bullets',i,'d']);if(v.h)fields.push(['bullets',i,'h']);});
  (s.columns||[]).forEach((c,i)=>(c.items||[]).forEach((v,j)=>fields.push(['columns',i,'items',j])));
  if(s.quote&&s.quote.text)fields.push(['quote','text']);
  if(s.chart&&s.chart.type==='content')(s.chart.items||[]).forEach((v,i)=>{if(v.detail)fields.push(['chart','items',i,'detail']);});
  const get=(o,p)=>p.reduce((v,k)=>v[k],o),set=(o,p,v)=>{let cur=o;for(const k of p.slice(0,-1))cur=cur[k];cur[p[p.length-1]]=v;};
  fields.sort((x,y)=>String(get(s,y)).length-String(get(s,x)).length);
  if(fields.length){const p=fields[0],pair=splitTextExact(get(s,p));if(pair&&String(get(s,p)).length>24){set(a,p,pair[0]);set(b,p,pair[1]);return [a,b];}}
  return null;
}
/* 找出這一頁最多能放下幾條條列：從全部開始往下試，第一個沒有版面問題的就用它。
   只在條列數 ≥ 2 時啟用，其餘情況交回原本的對半切。 */
function greedyBulletSplit(s){
  const list=s.bullets||[];
  if(!Array.isArray(list)||list.length<2) return null;
  const clone=n=>{ const c=JSON.parse(JSON.stringify(s)); c.bullets=list.slice(0,n); return c; };
  for(let n=list.length-1;n>=1;n--){
    if(!templateTextIssues(clone(n)).length){
      const a=clone(n), b=JSON.parse(JSON.stringify(s)); b.bullets=list.slice(n);
      return [a,b];
    }
  }
  return null;
}
prepareTemplateSlides=function(slides){
  const out=[];
  slides.forEach((source,index)=>{
    const base=JSON.parse(JSON.stringify(source)),queue=[];
    if(['bullets','agenda','closing'].includes(base.layout)&&(base.bullets||[]).length>5){
      for(let i=0;i<base.bullets.length;i+=5)queue.push({...base,bullets:base.bullets.slice(i,i+5)});
    }else queue.push(base);
    let sequence=0,attempts=0;
    while(queue.length){
      const s=queue.shift();s.exportOrigin=source.exportOrigin||source.id||'page-'+index;
      /* 續頁旗標要在檢查「放不放得下」之前就設好。舊版是決定完才設，
         於是每一頁的容量計算都把核心結論與來源列算進去，越拆越多頁。 */
      if(sequence)s.exportContinuation=true; else delete s.exportContinuation;
      const issues=templateTextIssues(s);
      /* 條列先用「這一頁最多放得下幾條」來切，放不下才退回原本的對半切。
         對半切會把 6 條變成 1+1+1+2+1 這種零碎結果；貪婪切法直接給 2+2+2。 */
      const split=issues.length&&attempts++<80?(greedyBulletSplit(s)||splitTemplateContent(s)):null;
      if(split){queue.unshift(...split);continue;}
      if(sequence){s.id=String(s.exportOrigin)+'-continuation-'+sequence;s.exportContinuation=true;}
      out.push(s);sequence++;
    }
  });
  return out;
};
const originalTemplateChoicePanel=templateChoicePanel;
templateChoicePanel=function(s){
  if(!s)return '';
  const plan=templatePlan(s),a=s.templateArea||{x:7.5,y:27,w:85,h:57},design=designSlideFor(s.layout,s),scale=templateScale();
  const adaptation=plan.mode==='safe'?'保留母片、Logo、頁尾、字體與配色，改用乾淨版面，不加入遮罩或額外框線'
    :(design?'沿用範例頁視覺與安全區':'內容較多或模板過密：沿用母片、配色與字體，改用寬版安全內容區');
  const modeLabel=plan.mode==='safe'?'目前採用：模板安全模式':plan.mode==='alternate'?'目前採用：模板替代版面':plan.mode==='reflow'?'目前採用：保留模板，重新排列內容區':'目前採用：原模板文字位置';
  return originalTemplateChoicePanel(s)+`<div style="font-size:15px;line-height:1.6;margin-top:10px"><b>${modeLabel}</b>
    <div class="hint" style="margin:5px 0"><b>智慧套用判斷：</b>${adaptation}${scale>1.08?`；此模板為大型畫布，已使用大型畫布容量計算`:''}</div>
    <label style="display:block">文字放置方式<select id="templateFitMode"><option value="auto" ${!s.templateFitMode||s.templateFitMode==='auto'?'selected':''}>優先忠實套用，必要時縮字</option><option value="preserve" ${s.templateFitMode==='preserve'?'selected':''}>完全固定原位置，空間不足時提醒</option><option value="reflow" ${s.templateFitMode==='reflow'?'selected':''}>直接重新排列內容區</option></select></label>
    <details><summary>調整內容／圖表區域</summary><div class="hint">以投影片百分比設定；字級保持不變。可避開 Logo、插圖與頁尾。</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${[['x','左側'],['y','上方'],['w','寬度'],['h','高度']].map(([k,n])=>`<label>${n} %<input type="number" data-area-key="${k}" value="${a[k]}" min="1" max="95" step="0.5"></label>`).join('')}</div><button class="chip" id="resetTemplateArea">回復自動區域</button></details>
    <div class="hint">重排可能改變原圖示與文字的對應位置，請檢查預覽。圖表可繼續使用獨立的圖表風格庫。</div></div>`;
};
document.addEventListener('change',e=>{
  const s=S.slides[S.cursor];if(!s)return;
  if(e.target.id==='templateFitMode'){pushHistory(S.cursor);s.templateFitMode=e.target.value;saveDraft();render();}
  if(e.target.dataset.areaKey){const n=Number(e.target.value);if(!Number.isFinite(n))return;pushHistory(S.cursor);s.templateArea={...(s.templateArea||{x:7.5,y:27,w:85,h:57}),[e.target.dataset.areaKey]:Math.max(1,Math.min(95,n))};s.templateFitMode='reflow';saveDraft();render();}
});
document.addEventListener('click',e=>{if(e.target.id==='resetTemplateArea'){const s=S.slides[S.cursor];if(!s)return;pushHistory(S.cursor);delete s.templateArea;saveDraft();render();}});

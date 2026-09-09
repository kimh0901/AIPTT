function exportOutline(){
  const md=['# '+(S.topic||'簡報'),'','對象：'+S.audience+'｜風格：'+curStyle().name+'｜共 '+S.slides.length+' 頁','']
  .concat(S.slides.map((s,i)=>{
    const L=['## '+String(i+1).padStart(2,'0')+'. '+s.title+'　`'+LAYOUTS[s.layout]+'`'];
    if(s.kicker) L.push('','> '+s.kicker);
    if(s.subtitle) L.push('',s.subtitle);
    if(s.layout==='bullets'||s.layout==='closing') (s.bullets||[]).forEach(b=>L.push('- **'+b.h+'**'+(b.d?'　'+b.d:'')));
    if(s.layout==='twoCol') (s.columns||[]).forEach(c=>{ L.push('','**'+c.h+'**'); (c.items||[]).forEach(it=>L.push('- '+it)); });
    if(s.layout==='stat'&&s.stat) L.push('','> '+s.stat.value+' — '+s.stat.label);
    if(s.layout==='chart'&&s.chart) L.push('','圖表：'+({column:'柱狀圖',bar:'橫條圖',line:'折線圖',doughnut:'圓環圖'}[s.chart.type]||s.chart.type)+
      '｜'+(s.chart.series||[]).map(one=>one.name).join('、')+'｜資料來源：'+(s.chart.source||''));
    if(s.layout==='quote'&&s.quote) L.push('','> '+s.quote.text+'　—— '+(s.quote.by||''));
    if(s.note) L.push('','講稿：'+s.note);
    return L.join('\n');
  })).join('\n\n');
  download(clipText(S.topic||'簡報',20)+'-大綱.md',md,'text/markdown;charset=utf-8');
}

function templateRect(layout,types,index,fallback){
  const arr=(layout&&layout.placeholders||[]).filter(p=>types.includes(p.type)&&p.rect&&p.rect.w>.1&&p.rect.h>.1);
  return Object.assign({},arr[index||0]&&arr[index||0].rect||fallback);
}

function deckTitlePt(st){
  const t=S.pptTemplate, sizes=((t&&t.layouts)||[]).map(l=>Number(l.titleSize)||0).filter(Boolean);
  return Math.max(18, sizes.length?Math.max(...sizes):(Number(st&&st.titleSize)||35));
}

function templateTheme(st,layout){
  const t=S.pptTemplate||{}, c=t.colors||{}, f=t.fonts||{};
  const resolve=(ref,fallback)=>{ if(!ref) return fallback; if(ref[0]==='#') return ref;
    const mapped=(layout&&layout.clrMap&&layout.clrMap[ref])||ref; return c[mapped]||fallback; };
  const titleInk=resolve(layout&&layout.titleColorRef,c.dk1||st.ink), bodyInk=resolve(layout&&layout.bodyColorRef,c.dk1||st.sub);
  return {ink:titleInk,sub:bodyInk,accent:c.accent1||st.accent,accent2:c.accent2||st.accent2,surface:c.lt2||c.lt1||st.surface,
    titleFont:f.major||pptFontFamily({fontFamily:'theme'},st),bodyFont:f.minor||pptFontFamily({fontFamily:'theme'},st),
    /* 中文字型另外帶；匯出後會用它改寫 <a:ea>，讓中文不會被指定成母片的英文字型 */
    cjkFont:f.minorEa||f.majorEa||'Microsoft JhengHei',
    titleSize:Number(layout&&layout.titleSize)||0,bodySize:(layout&&layout.bodySize)||18};
}

function fitFontSize(text, box, want, opts){
  opts=opts||{};
  const requested=Number(opts.min)||10;
  /* 忠實套版時允許必要縮字，但保留可讀下限：標題／大數字至少 24pt，正文至少 16pt。
     空間在此下限仍不足時，由 layout-safety 改為重排，不會繼續壓成小字。 */
  const min=Math.max(requested,Number(want)>=24?24:16), line=Number(opts.line)||1.24;
  const str=String(text==null?'':text); if(!str.trim()) return Number(want)||18;
  const w=Math.max(.35,(box.w||1)-(opts.pad==null ? .08 : opts.pad)), h=Math.max(.18,box.h||1);
  let units=0; for(const ch of str) units += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uff60]/.test(ch)?1:0.55;
  const hard=(str.match(/\n/g)||[]).length;
  let size=Math.max(min,Number(want)||18);
  for(let i=0;i<80&&size>min;i++){
    const em=size/72,perLine=Math.max(1,Math.floor(w/em));
    const rows=Math.max(1+hard,Math.ceil(units/perLine)+hard);
    if(rows*em*line<=h)break;
    size--;
  }
  return Math.round(size);
}

function legacyFitFontSize(text, box, want, opts){
  opts=opts||{};
  const requested=Number(opts.min)||10, min=Math.max(requested,Number(want)>=24?24:16), line=Number(opts.line)||1.24;
  const str=String(text==null?'':text); if(!str.trim()) return want;
  const w=Math.max(.35,(box.w||1)-(opts.pad==null ? .08 : opts.pad)), h=Math.max(.18,box.h||1);
  /* 中文字寬約等於字高，英數與空白約 0.55 倍 */
  let units=0; for(const ch of str) units += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uff60]/.test(ch)?1:0.55;
  const hard=(str.match(/\n/g)||[]).length;
  let size=Math.max(min,want);
  for(let i=0;i<60 && size>min;i++){
    const em=size/72, perLine=Math.max(1,Math.floor(w/em));
    const rows=Math.max(1+hard,Math.ceil(units/perLine)+hard);
    if(rows*em*line<=h) break;
    size--;
  }
  return Math.round(size);
}

function pptxSink(pptx,sl){
  return {html:false,
    /* 空字串不要在 PPTX 裡留一個空文字框（預覽可編輯所以照舊顯示，匯出則略過） */
    text:(t,o)=>{
      const str=Array.isArray(t)?t.map(x=>(x&&x.text!=null)?x.text:'').join(''):String(t==null?'':t);
      if(!str.trim()) return;
      const fixed={...o}; delete fixed.fit; delete fixed.autoFit;
      sl.addText(t,fixed);
    },
    rect:o=>sl.addShape(pptx.ShapeType.rect,o),
    roundRect:o=>sl.addShape(pptx.ShapeType.roundRect,o),
    chart:(type,data,o)=>sl.addChart(type,data,o),
    notes:t=>sl.addNotes(t)};
}

function htmlSink(W,H,editable){
  /* 預覽舞台固定 1280×720 px 代表整張投影片，所以 pt 要換算成該尺度的 px，
     不能直接用 CSS 的 pt（那是 1pt=1.333px，跟投影片比例對不起來）。 */
  const parts=[], ppi=1280/Math.max(1,W), pt=v=>((Number(v)||18)/72*ppi).toFixed(2)+'px';
  const pc=(v,tot)=>(v/tot*100).toFixed(3)+'%';
  const col=c=>'#'+String(c||'000000').replace('#','');
  const box=o=>`left:${pc(o.x||0,W)};top:${pc(o.y||0,H)};width:${pc(o.w||0,W)};height:${pc(o.h||0,H)}`;
  return {html:true,parts,
    text:(t,o)=>{
      o=o||{};
      const runs=Array.isArray(t)?t.filter(x=>x&&x.text!=null):[{text:String(t==null?'':t),options:o}];
      const txt=runs.map(x=>x.text).join('\n');
      const canEdit=!!(editable&&(o.edit||runs.some(r=>r.options&&r.options.edit)));
      if(!txt.trim()&&!canEdit) return;
      const face=f=>f?`'${String(f).replace(/['"\\]/g,'')}',`:'';
      /* 字距與行距要真的送到畫面上。舊版 line-height 寫死 1.24、完全沒有 letter-spacing，
         所以文字面板的兩根滑桿拉到哪裡預覽都不會變。 */
      const lh=Math.max(1.05,Number(o.lineSpacingMultiple)||1.3);
      const ls=Number(o.charSpacing)||0;
      const editCss='outline:1px dashed rgba(0,0,0,.18);outline-offset:2px;border-radius:2px;min-height:1em;';
      const span=(text,ro,path)=>{
        const on=!!(editable&&path);
        const attr=on?` data-edit="${esc(path)}" contenteditable="true" spellcheck="false"`+
          (o.placeholder?` data-placeholder="${esc(o.placeholder)}"`:'')+` title="可直接點這裡修改"`:'';
        const bold=(ro&&ro.bold!==undefined)?ro.bold:o.bold, ital=(ro&&ro.italic!==undefined)?ro.italic:o.italic;
        const cl=(ro&&ro.color)||o.color, fs=(ro&&ro.fontSize)||o.fontSize;
        /* 不允許 flex 壓扁段落高度：字形不會一起縮小，下一段會因此疊上來。 */
        return `<span${attr} style="display:block;flex:0 0 auto;min-height:min-content;font-size:${pt(fs)};line-height:${lh.toFixed(2)};`+
          `letter-spacing:${(ls/72*ppi).toFixed(2)}px;font-weight:${bold?700:400};`+
          `font-style:${ital?'italic':'normal'};color:${col(cl)};text-align:${o.align||'left'};`+
          `white-space:pre-wrap;word-break:break-word;width:100%;${on?editCss:''}`+
          `font-family:${face((ro&&ro.fontFace)||o.fontFace)}'Microsoft JhengHei','Noto Sans TC',sans-serif">${esc(text)}</span>`;
      };
      const inner=runs.map(r=>span(r.text,r.options,(r.options&&r.options.edit)||(runs.length===1?o.edit:''))).join('');
      parts.push(`<div style="position:absolute;${box(o)};display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;`+
        `justify-content:${o.valign==='mid'?'center':o.valign==='bottom'?'flex-end':'flex-start'};`+
        `align-items:stretch">${inner}</div>`);
    },
    rect:o=>parts.push(`<div style="position:absolute;${box(o)};background:${col(o.fill&&o.fill.color)}"></div>`),
    roundRect:o=>parts.push(`<div style="position:absolute;${box(o)};background:${col(o.fill&&o.fill.color)};`+
      `border-radius:${(ppi*.06).toFixed(1)}px;border:1px solid rgba(0,0,0,.14)"></div>`),
    chart:(type,data,o)=>parts.push(`<div style="position:absolute;${box(o)};border:1px dashed rgba(0,0,0,.3);`+
      `display:grid;place-items:center;color:rgba(0,0,0,.45);font-size:${(ppi*.16).toFixed(0)}px">［圖表區］</div>`),
    notes:()=>{}};
}

function addContentFlowPptx(sink,chart,box,style){
  const items=(chart.items||[]).slice(0,5), n=items.length;
  if(!n) return;
  const hx=c=>String(c||'#000000').replace('#','').toUpperCase(), horizontal=box.w/n>=1.55&&box.h>=2.25&&n<=4;
  if(!horizontal){
    const gap=.08, rowH=Math.max(.45,(box.h-gap*(n-1))/n);
    items.forEach((item,i)=>{
      const y=box.y+i*(rowH+gap), color=i%2?style.accent2:style.accent, showDetail=rowH>=.78&&box.w>=4.5&&item.detail;
      sink.roundRect({x:box.x,y,w:box.w,h:rowH,rectRadius:.05,fill:{color:hx(style.surface)},line:{color:hx(style.sub),transparency:58,width:.8}});
      sink.rect({x:box.x,y,w:.07,h:rowH,fill:{color:hx(color)},line:{color:hx(color)}});
      sink.text(String(i+1).padStart(2,'0'),{x:box.x+.18,y:y+.08,w:.48,h:Math.max(.24,rowH-.16),fontFace:style.font,fontSize:11,bold:true,color:hx(color),align:'center',valign:'mid',margin:0,fit:'shrink'});
      sink.text(item.label||'重點',{x:box.x+.78,y:y+.08,w:showDetail?box.w*.34:box.w-.98,h:Math.max(.24,rowH-.16),fontFace:style.font,fontSize:16,bold:true,color:hx(style.ink),valign:'mid',margin:.02,fit:'shrink'});
      if(showDetail) sink.text(item.detail,{x:box.x+box.w*.42,y:y+.08,w:box.w*.54,h:Math.max(.24,rowH-.16),fontFace:style.font,fontSize:13,color:hx(style.sub),valign:'mid',margin:.02,fit:'shrink'});
    });
    return;
  }
  const arrowW=n>1?.22:0, gap=n>1?.05:0, cardW=(box.w-(n-1)*(arrowW+gap))/n, cardH=Math.max(1.55,Math.min(2.45,box.h*.68)), y=box.y+(box.h-cardH)/2;
  items.forEach((item,i)=>{
    const x=box.x+i*(cardW+arrowW+gap);
    sink.rect({x,y,w:cardW,h:cardH,fill:{color:hx(style.surface)},line:{color:hx(style.sub),transparency:58,width:.8}});
    sink.rect({x,y,w:cardW,h:.07,fill:{color:hx(i%2?style.accent2:style.accent)},line:{color:hx(i%2?style.accent2:style.accent)}});
    sink.text(String(i+1).padStart(2,'0'),{x:x+.12,y:y+.22,w:cardW-.24,h:.22,fontFace:style.font,fontSize:8,color:hx(style.sub),align:'center',margin:0});
    sink.text(item.label||'重點',{x:x+.14,y:y+.58,w:cardW-.28,h:.62,fontFace:style.font,fontSize:16,bold:true,color:hx(style.ink),align:'center',valign:'mid',margin:.03,fit:'shrink'});
    if(item.detail&&cardH>=1.8) sink.text(item.detail,{x:x+.15,y:y+1.26,w:cardW-.3,h:Math.max(.3,cardH-1.45),fontFace:style.font,fontSize:13,color:hx(style.sub),align:'center',valign:'top',margin:.02,fit:'shrink'});
    if(i<n-1) sink.text('→',{x:x+cardW+gap/2,y:y+cardH/2-.19,w:arrowW,h:.38,fontFace:style.font,fontSize:18,bold:true,color:hx(style.accent),align:'center',margin:0});
  });
}

function templateHasNativePageNumber(layout){
  const t=S.pptTemplate;
  return !!(t&&t.canMergeMasters&&(t.layouts||[]).some(l=>
    (l===layout||l.masterPath===layout?.masterPath)&&
    (l.placeholders||[]).some(p=>p.type==='sldNum')));
}
function originalTemplateSlideContent(sink,s,idx,layout,st,pptx){
  const t=S.pptTemplate, W=t.width, H=t.height, th=templateTheme(st,layout), hx=c=>String(c||'#000000').replace('#','').toUpperCase();
  const sourceLabel=slideSourceFooter(s), sourceReserve=sourceLabel ? 0.24 : 0;
  const custom=s.textStyle?slideTextStyle(s):null;
  const titleFont=custom?pptFontFamily(custom,st):th.titleFont, bodyFont=custom?pptFontFamily(custom,st):th.bodyFont;
  /* 母片自己的標題級距優先。舊版用 Math.max(固定下限, 母片值)，會把母片設定的
     24～28pt 標題硬放大成 35pt，等於沒有真的沿用母片。 */
  /* 標題字級全簡報一致：除了封面可以放大，其餘頁型一律同一個級距。
     舊版讓 closing ×1.15、quote ×0.78、chart 另設下限，每頁大小都不一樣。 */
  /* 全簡報共用同一個標題級距，不受這一頁配到哪個版面影響；
     只有使用者在文字面板「真的動過」字級時才以他的設定為準。 */
  const deckTitleSize=deckTitlePt(st);
  const titleSize=(custom&&custom.titleSizeSet)?Math.max(18,custom.titleSize)
    :(s.layout==='cover'?Math.round(deckTitleSize*1.15):deckTitleSize);
  const bodySize=Math.max(16,(custom&&custom.bodySizeSet)?custom.bodySize:th.bodySize);
  const titleInk=hx(custom&&custom.titleColor||th.ink), bodyInk=hx(custom&&custom.bodyColor||th.sub), subInk=hx(th.sub);
  const align=custom&&custom.align||'left', titleBold=custom?!!custom.titleBold:true,
    bodyBold=custom?!!custom.bodyBold:false, bodyItalic=custom?!!custom.bodyItalic:false;
  const titleRhythm=custom?{charSpacing:custom.letterSpacing,lineSpacingMultiple:Math.min(1.3,custom.lineSpacing)}:{},
    bodyRhythm=custom?{charSpacing:custom.letterSpacing,lineSpacingMultiple:custom.lineSpacing}:{};
  if(s.note) sink.notes(s.note);
  if(sourceLabel) sink.text('資料來源：'+sourceLabel,{x:W*.06,y:H-.66,w:W*.88,h:.20,fontSize:8,color:hx(th.sub),fontFace:bodyFont,margin:0,fit:'shrink'});
  /* 母片模式舊版沒有頁碼與頁尾，但編輯器預覽一直顯示 01 / 06，兩邊對不起來 */
  if(s.layout!=='cover'&&!s.previewOnly){
    const total=EXPORT_SLIDE_COUNT||(S.slides||[]).length||1;
    if(!templateHasNativePageNumber(layout))sink.text(String(idx+1).padStart(2,'0')+' / '+String(total).padStart(2,'0'),
      {x:W-W*.06-1.4,y:H-.40,w:1.4,h:.20,fontSize:9,color:hx(th.sub),fontFace:bodyFont,align:'right',margin:0});
    if(s.footer) sink.text(s.footer,{x:W*.06,y:H-.40,w:W*.6,h:.20,fontSize:9,color:hx(th.sub),fontFace:bodyFont,margin:0,fit:'shrink'});
  }

  /* 範例投影片模式：沿用樣板該頁原本的文字框位置，文字才會落在設計留白處 */
  /* 間距不再寫死。GAP 隨投影片尺寸縮放，4:3、16:9、Canva 的超大尺寸都能對齊。 */
  const GAP=Math.min(.28,Math.max(.09,H*.024));
  const design=designSlideFor(s.layout,s), dbox=design?designBoxes(design,W,H):null;
  if(design) DESIGN_ASSIGN[idx]=design.index;
  let title=dbox?Object.assign({},dbox.title)
    :templateRect(layout,['title','ctrTitle'],0,{x:W*.07,y:H*.065,w:W*.86,h:H*.14});
  const bodies=dbox?dbox.bodies.map(r=>({rect:Object.assign({},r)}))
    :(layout&&layout.placeholders||[]).filter(p=>['body','obj','chart','tbl','dgm','pic','media'].includes(p.type)&&p.rect);
  const body=Object.assign({},bodies[0]&&bodies[0].rect||{x:W*.075,y:H*.245,w:W*.85,h:H*.62});
  /* 有些版面（例如 Section Header）的標題框在內容框下方，直接套用會讓標題排到內容後面 */
  /* 只有在標題框與內容框「水平重疊（真的上下堆疊）」且標題明顯在下方時才調整。
     左右並排的版面兩框 y 幾乎相同，舊條件會誤判並把標題搬到右欄去。 */
  /* 標題框和內容框真的「疊在一起」才調整：改用矩形交集判斷，
     舊版只比 y 座標，遇到左右兩欄的版面（標題壓在左欄上）會漏判。 */
  const rects=bodies.map(p2=>p2.rect).filter(Boolean);
  const hitsTitle=r=>{
    const ox=Math.min(title.x+title.w,r.x+r.w)-Math.max(title.x,r.x);
    const oy=Math.min(title.y+title.h,r.y+r.h)-Math.max(title.y,r.y);
    return ox>Math.min(title.w,r.w)*0.30 && oy>0.06;
  };
  const hits=rects.filter(hitsTitle);
  if(hits.length){
    const top=Math.min(...hits.map(r=>r.y)), left=Math.min(...hits.map(r=>r.x));
    const wide=Math.max(...hits.map(r=>r.x+r.w))-left;
    const room=top-H*.05-GAP;
    if(room>=.42){                                   // 上方還有空間 → 標題移到內容之上
      const th2=Math.min(Math.max(title.h,.42),room);
      title={x:left,y:Math.max(H*.05,top-th2-GAP),w:Math.max(title.w,wide),h:th2};
    }else{                                           // 上方沒空間 → 內容整體往下讓
      const th2=Math.max(.42,Math.min(title.h,H*.14));
      title={x:left,y:H*.05,w:Math.max(title.w,wide),h:th2};
      const need=(title.y+title.h+GAP)-top;
      if(need>0) bodies.forEach(p2=>{ p2.rect=Object.assign({},p2.rect,{y:p2.rect.y+need,h:Math.max(.5,p2.rect.h-need)}); });
      if(need>0){ body.y+=need; body.h=Math.max(.45,body.h-need); }
    }
  }
  const bottomReserve=Math.max(.55,H*.10);
  body.h=Math.max(.45,Math.min(body.h,H-body.y-bottomReserve)-sourceReserve);
  if(s.layout==='chart'&&title.y+title.h>body.y-GAP) title.h=Math.max(.38,body.y-title.y-GAP);
  /* 標題與內容之間留白太窄（樣板的框幾乎相連）就把內容往下推一點 */
  if(body.y-(title.y+title.h)<GAP*.5 && body.h>GAP*2.2){
    const push=GAP*.6; body.y+=push; body.h=Math.max(.45,body.h-push);
  }
  const accent=(box,color)=>sink.rect({x:box.x,y:box.y,w:Math.min(.72,box.w*.12),h:.055,
    fill:{color:hx(color||th.accent)},line:{color:hx(color||th.accent),transparency:100}});
  const addTitle=(text,box)=>sink.text(text||'',{edit:'title',placeholder:'輸入這一頁的標題',...(box||title),...titleRhythm,fontFace:titleFont,
    fontSize:fitFontSize(text,box||title,titleSize,{min:16}),bold:titleBold,
    italic:!!(custom&&custom.titleItalic),color:titleInk,align,margin:0,valign:'mid',fit:'shrink'});
  const addKicker=box=>{
    if(!s.kicker) return box;
    const kh=Math.min(.42,Math.max(.24,box.h*.14));
    sink.text(s.kicker,{edit:'kicker',placeholder:'加入核心結論',x:box.x,y:box.y,w:box.w,h:kh,...bodyRhythm,fontFace:bodyFont,
      fontSize:fitFontSize(s.kicker,{w:box.w,h:kh},Math.max(16,bodySize-2),{min:11}),
      bold:true,color:hx(th.accent),margin:0,valign:'top',fit:'shrink'});
    const kg=GAP*.6;
    return {x:box.x,y:box.y+kh+kg,w:box.w,h:Math.max(.3,box.h-kh-kg)};
  };

  if(s.layout==='cover'){
    const coverTitle=dbox?Object.assign({},dbox.title)
      :templateRect(layout,['ctrTitle','title'],0,{x:W*.11,y:H*.34,w:W*.78,h:H*.24});
    accent({x:coverTitle.x,y:Math.max(.18,coverTitle.y-.3),w:coverTitle.w,h:.06});
    sink.text(s.kicker||'',{edit:'kicker',placeholder:'加入核心結論',x:coverTitle.x,y:Math.max(.12,coverTitle.y-.72),w:coverTitle.w,h:.3,...bodyRhythm,
      fontFace:bodyFont,fontSize:Math.max(16,bodySize-1),bold:true,color:hx(th.accent),margin:0});
    addTitle(s.title,coverTitle);
    const sub=(dbox&&dbox.bodies[0])?Object.assign({},dbox.bodies[0])
      :templateRect(layout,['subTitle','body','obj'],0,{x:coverTitle.x,y:coverTitle.y+coverTitle.h+.16,w:coverTitle.w*.82,h:H*.16});
    sink.text(s.subtitle||'',{edit:'subtitle',placeholder:'輸入副標題',...sub,...bodyRhythm,fontFace:bodyFont,
      fontSize:fitFontSize(s.subtitle,sub,bodySize,{min:12}),bold:bodyBold,italic:bodyItalic,
      color:subInk,align,margin:0,valign:'top',fit:'shrink'});
    return;
  }

  if(s.layout==='closing'){
    const closeBox=dbox?{x:title.x,y:title.y,w:Math.max(title.w,body.w),h:Math.max(1.6,(body.y+body.h)-title.y)}
      :{x:body.x,y:Math.max(body.y,H*.3),w:body.w,h:Math.min(body.h,H*.48)};
    if(s.kicker) sink.text(s.kicker,{x:closeBox.x,y:closeBox.y,w:closeBox.w,h:.38,...bodyRhythm,fontFace:bodyFont,fontSize:Math.max(16,bodySize-1),
      bold:true,color:hx(th.accent),margin:0});
    sink.text(s.title||'',{edit:'title',placeholder:'輸入結尾標題',x:closeBox.x,y:closeBox.y+(s.kicker ? .48 : 0),w:closeBox.w,h:Math.min(1.35,closeBox.h*.36),...titleRhythm,
      fontFace:titleFont,fontSize:fitFontSize(s.title,{w:closeBox.w,h:Math.min(1.35,closeBox.h*.36)},titleSize,{min:16}),
      bold:titleBold,color:titleInk,margin:0});
    accent({x:closeBox.x,y:closeBox.y+Math.min(1.55,closeBox.h*.43),w:closeBox.w,h:.06});
    const items=(s.bullets||[]).slice(0,3);
    items.forEach((b,i)=>{ const cBox={x:closeBox.x,y:closeBox.y+1.82+i*.56,w:closeBox.w*.84,h:.4};
      sink.text(b.h||b.d||'',{edit:'b:'+i+':h',...cBox,...bodyRhythm,fontFace:bodyFont,fontSize:fitFontSize(b.h||b.d,cBox,bodySize,{min:11}),
        bold:i===0||bodyBold,italic:bodyItalic,color:i===0?bodyInk:subInk,align,margin:0}); });
    return;
  }

  addTitle(s.title||'');
  accent({x:body.x,y:Math.max(title.y+title.h+GAP*.35,body.y-GAP),w:body.w,h:Math.max(.045,H*.008)});
  const content=addKicker(body);

  if(s.layout==='chart'&&s.chart){
    const sourceH=s.chart.source ? .24 : 0, chartBox={x:content.x,y:content.y,w:content.w,h:Math.max(.8,content.h-sourceH-.16)};
    if(s.chart.type==='content'){
      addContentFlowPptx(sink,s.chart,chartBox,{surface:th.surface,ink:th.ink,sub:th.sub,accent:th.accent,accent2:th.accent2,font:bodyFont});
    }else{
      const type=safeChartType(s.chart), labels=(s.chart.labels||[]).slice(0,10);
      const data=(s.chart.series||[]).slice(0,type==='doughnut'?1:2).map(one=>({name:chartUnitName(one),labels,
        values:(one.values||[]).slice(0,labels.length).map(pptChartValue)}));
      const chartType=type==='line'?pptx.ChartType.line:type==='doughnut'?pptx.ChartType.doughnut:pptx.ChartType.bar;
      sink.chart(chartType,data,{...chartBox,barDir:type==='bar'?'bar':'col',showTitle:false,showLegend:data.length>1,legendPos:'b',
        chartColors:chartPalette({accent:th.accent,accent2:th.accent2,ink:th.ink,bg:th.surface},type==='doughnut'?labels.length:data.length).map(hx),showValue:type==='doughnut',showLabel:type==='doughnut',
        showPercent:type==='doughnut',holeSize:62,showCatName:false,showBorder:false,showGridLines:type!=='doughnut',
        catAxisLabelFontFace:bodyFont,valAxisLabelFontFace:bodyFont,catAxisLabelColor:bodyInk,valAxisLabelColor:bodyInk,
        showCatAxis:type!=='doughnut',showValAxis:type!=='doughnut',lineSize:type==='line'?3:1,dataLabelColor:bodyInk,
        catAxisLabelFontSize:10,valAxisLabelFontSize:10,dataLabelFontFace:bodyFont,dataLabelFontSize:10,
        ...pptChartStyleProps(s.chart,{accent:th.accent,accent2:th.accent2,ink:th.ink,sub:th.sub,rule:th.rule||th.sub,bg:th.surface},type==='doughnut'?labels.length:data.length)});
    }
    if(s.chart.source) sink.text((s.chart.type==='content'?'內容來源：':'資料來源：')+s.chart.source,
      {x:content.x,y:chartBox.y+chartBox.h+.06,w:content.w,h:.18,fontSize:8,color:subInk,fontFace:bodyFont,margin:0,align:'right',fit:'shrink'});
    return;
  }

  if(s.layout==='stat'){
    const value=String((s.stat&&s.stat.value)||'—'), label=(s.stat&&s.stat.label)||'';
    const valBox={x:content.x,y:content.y+.08,w:content.w,h:content.h*.56};
    const wantStat=statPt(custom,Math.max(54,titleSize*2));
    sink.text(value,{edit:'stat:value',placeholder:'輸入重點數據',...valBox,...titleRhythm,fontFace:titleFont,
      fontSize:fitFontSize(value,valBox,wantStat,{min:16}),bold:true,color:hx(th.accent),align,margin:0,valign:'mid'});
    const labBox={x:content.x,y:content.y+content.h*.62,w:content.w*.82,h:content.h*.25};
    sink.text(label,{edit:'stat:label',placeholder:'加入數據說明',...labBox,...bodyRhythm,fontFace:bodyFont,
      fontSize:fitFontSize(label,labBox,Math.max(18,bodySize),{min:11}),bold:bodyBold,italic:bodyItalic,color:bodyInk,align,margin:0,valign:'top'});
    return;
  }

  if(s.layout==='quote'){
    const q=(s.quote&&s.quote.text)||s.kicker||'', by=(s.quote&&s.quote.by)||'';
    sink.text('“',{x:content.x,y:content.y,w:.75,h:.72,fontFace:titleFont,fontSize:62,bold:true,color:hx(th.accent),margin:0});
    const qBox={x:content.x+.7,y:content.y+.28,w:content.w-.7,h:Math.max(.8,content.h-.78)};
    sink.text(q,{edit:'quote:text',placeholder:'輸入引言',...qBox,...titleRhythm,fontFace:titleFont,
      fontSize:fitFontSize(q,qBox,titleSize,{min:14}),italic:true,color:titleInk,margin:0,valign:'mid'});
    sink.text(by||'',{edit:'quote:by',placeholder:'出處',x:content.x+.7,y:content.y+content.h-.38,w:content.w-.7,h:.3,...bodyRhythm,fontFace:bodyFont,
        fontSize:Math.max(16,bodySize-2),bold:bodyBold,italic:bodyItalic,color:subInk,align:'right',margin:0,fit:'shrink'});
    return;
  }

  if(s.layout==='twoCol'){
    const cols=(s.columns&&s.columns.length?s.columns:[{h:'',items:[]},{h:'',items:[]}]).slice(0,2);
    /* 依水平位置分左右兩群，各取面積最大的框。標準 Comparison 版面的佔位框順序是
       〔左小標、左內容、右小標、右內容〕，舊版直接取前兩個會讓兩欄疊在一起。 */
    const mid=content.x+content.w/2;
    const biggest=list=>list.slice().sort((a,b)=>(b.rect.w*b.rect.h)-(a.rect.w*a.rect.h))[0];
    const left=biggest(bodies.filter(p2=>p2.rect.x+p2.rect.w/2<mid)), right=biggest(bodies.filter(p2=>p2.rect.x+p2.rect.w/2>=mid));
    const floor2=H-bottomReserve-sourceReserve;
    let boxes=[];
    /* 只有在樣板本來就是「左右並排、寬度相近、高度相近，而且不會壓到標題」時，
       才沿用樣板自己的兩個框；否則一律改用標題底下的等寬雙欄，才不會出現
       左欄掉到頁尾、或標題蓋住欄位的情形。 */
    if(left&&right){
      const a=left.rect, b2=right.rect;
      const sameRow=Math.abs(a.y-b2.y)<H*0.12, evenW=Math.min(a.w,b2.w)>=Math.max(a.w,b2.w)*0.6;
      const clearTitle=![a,b2].some(r=>hitsTitle(r));
      if(sameRow&&evenW&&clearTitle){
        const top=Math.max(content.y,Math.min(a.y,b2.y));
        const bot=Math.min(floor2,Math.max(a.y+a.h,b2.y+b2.h));
        const hh=Math.max(.9,Math.min(content.h,bot-top));
        boxes=[a,b2].map(r=>({x:r.x,y:top,w:r.w,h:hh}));
      }
    }
    if(boxes.length<2){
      /* 退回「樣板最大的那個內容框」內部平分兩欄：那塊區域是樣板留白處，
         不會壓到底部色塊或裝飾圖，換任何樣板都安全。 */
      let ux=content.x, uw=content.w, top=content.y;
      const ox=Math.min(title.x+title.w,ux+uw)-Math.max(title.x,ux);
      if(ox>0 && title.y+title.h>top) top=Math.max(top,title.y+title.h+GAP);
      const hh=Math.max(.9,Math.min(content.h,floor2-top));
      const gapW=Math.max(.28,uw*.06), colW=(uw-gapW)/2;
      boxes=[{x:ux,y:top,w:colW,h:hh},{x:ux+colW+gapW,y:top,w:colW,h:hh}];
    }
    cols.forEach((c,i)=>{
      const box=boxes[i], color=i?th.accent2:th.accent;
      sink.rect({x:box.x,y:box.y,w:box.w,h:.055,fill:{color:hx(color)},line:{color:hx(color),transparency:100}});
      const hH=Math.max(.38,Math.min(.62,box.h*.14)), hGap=GAP*.7;
      sink.text(c.h||'',{edit:'c:'+i+':h',placeholder:'輸入欄位標題',x:box.x,y:box.y+hGap,w:box.w,h:hH,...bodyRhythm,fontFace:bodyFont,
        fontSize:fitFontSize(c.h,{w:box.w,h:hH},Math.max(19,bodySize+1),{min:11}),bold:true,color:bodyInk,margin:0});
      const itemTop=box.y+hGap+hH+GAP*.5;
      const items=(c.items||[]), rowH=Math.max(.42,(box.h-(itemTop-box.y)-GAP)/Math.max(1,items.length));
      items.forEach((v,j)=>{
        const y=itemTop+j*rowH;
        sink.rect({x:box.x,y:y+.13,w:.075,h:.075,fill:{color:hx(color)},line:{color:hx(color),transparency:100}});
        const iBox={x:box.x+.2,y,w:box.w-.2,h:Math.min(rowH,.62)};
        sink.text(String(v),{edit:'c:'+i+':items:'+j,...iBox,...bodyRhythm,fontFace:bodyFont,fontSize:fitFontSize(v,iBox,bodySize,{min:10}),
          color:j?subInk:bodyInk,bold:bodyBold,italic:bodyItalic,align,margin:0,valign:'top'});
      });
    });
    return;
  }

  const items=(s.bullets||[]);
  if(s.layout==='agenda'){
    const two=items.length>5, cols=two?2:1, rows=Math.ceil(items.length/cols), gap=content.w*.055, colW=(content.w-gap*(cols-1))/cols;
    items.forEach((b,i)=>{
      const col=Math.floor(i/rows), row=i%rows, rowH=content.h/Math.max(1,rows), x=content.x+col*(colW+gap), y=content.y+row*rowH;
      sink.text(String(i+1).padStart(2,'0'),{x,y:y+.05,w:.42,h:.28,fontFace:bodyFont,fontSize:Math.max(12,bodySize-4),bold:true,color:hx(th.accent),margin:0});
      const aDense=rowH<0.85, aHeadH=Math.max(.22,Math.min(.42,rowH*(b.d?.44:.9)));
      sink.text(b.h||'',{edit:'b:'+i+':h',x:x+.5,y,w:colW-.5,h:aHeadH,...bodyRhythm,fontFace:bodyFont,fontSize:aDense?Math.max(13,bodySize-4):Math.max(18,bodySize),bold:true,italic:bodyItalic,align,color:bodyInk,margin:0,fit:'shrink'});
      if(b.d) sink.text(b.d,{edit:'b:'+i+':d',x:x+.5,y:y+aHeadH+.02,w:colW-.5,h:Math.max(.18,rowH-aHeadH-.08),...bodyRhythm,fontFace:bodyFont,fontSize:aDense?Math.max(11,bodySize-6):Math.max(16,bodySize-2),bold:bodyBold,italic:bodyItalic,align,color:subInk,margin:0,fit:'shrink'});
      if(row<rows-1) sink.rect({x,y:y+rowH-.05,w:colW,h:.012,fill:{color:subInk,transparency:72},line:{color:subInk,transparency:100}});
    });
    return;
  }

  if(items.length){
    const two=items.length>4, cols=two?2:1, rows=Math.ceil(items.length/cols), gap=content.w*.06, colW=(content.w-gap*(cols-1))/cols;
    items.forEach((b,i)=>{
      const col=Math.floor(i/rows), row=i%rows, rowH=content.h/Math.max(1,rows), x=content.x+col*(colW+gap), y=content.y+row*rowH;
      /* 補充說明的位置要跟著行高走。舊版固定寫死 +0.42，遇到樣板的小型文字框
         （行高不到 0.9 吋）就會壓到下一條的標題。 */
      const dense=rowH<0.85, headH=Math.max(.22,Math.min(.45,rowH*(b.d?.44:.9)));
      const headSize=dense?Math.max(13,bodySize-4):Math.max(18,bodySize);
      sink.rect({x,y:y+headH*.34,w:.085,h:.085,fill:{color:hx(th.accent)},line:{color:hx(th.accent),transparency:100}});
      const hBox={x:x+.23,y,w:colW-.23,h:headH}, dBox={x:x+.23,y:y+headH+.02,w:colW-.23,h:Math.max(.18,rowH-headH-.08)};
      sink.text(b.h||'',{edit:'b:'+i+':h',placeholder:'輸入條列標題',...hBox,...bodyRhythm,fontFace:bodyFont,fontSize:fitFontSize(b.h,hBox,headSize,{min:10}),
        bold:true,italic:bodyItalic,align,color:bodyInk,margin:0,valign:'top'});
      if(b.d) sink.text(b.d,{edit:'b:'+i+':d',...dBox,...bodyRhythm,fontFace:bodyFont,
        fontSize:fitFontSize(b.d,dBox,dense?Math.max(11,bodySize-6):Math.max(16,bodySize-2),{min:9}),bold:bodyBold,italic:bodyItalic,align,color:subInk,margin:0,valign:'top'});
    });
  }else if(s.subtitle){
    sink.text(s.subtitle,{edit:'subtitle',...content,...bodyRhythm,fontFace:bodyFont,fontSize:bodySize,bold:bodyBold,italic:bodyItalic,align,color:bodyInk,margin:0,valign:'top',fit:'shrink'});
  }
}

function downloadBlob(name,blob){
  const u=URL.createObjectURL(blob), a=document.createElement('a'); a.href=u; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),3000);
}

function pptxFileName(){
  const sc=currentScenario();
  return sc&&sc.outputName?sc.outputName:clipText(S.topic||'簡報',40)+'.pptx';
}

function nextRelId(doc){
  const used=new Set(xmlList(doc,'Relationship').map(r=>r.getAttribute('Id'))), nums=Array.from(used).map(x=>Number(String(x).replace(/^rId/,''))).filter(Number.isFinite);
  let n=Math.max(0,...nums)+1; while(used.has('rId'+n)) n++; return 'rId'+n;
}

async function applyPowerPointTemplate(generated,exportSlides,designAssignments){
  const t=S.pptTemplate, JSZip=(await loadLib('jszip')).lib;
  exportSlides=exportSlides||S.slides;
  designAssignments=designAssignments||{...DESIGN_ASSIGN};
  const out=await JSZip.loadAsync(generated), src=await JSZip.loadAsync(t.buffer);
  const full=!!t.canMergeMasters, fallbackMedia={};
  const infrastructure=/^ppt\/(slideMasters|slideLayouts|theme|media|fonts)\//i;
  if(full){
    Object.keys(out.files).filter(p=>infrastructure.test(p)).forEach(p=>out.remove(p));
    for(const path of Object.keys(src.files).filter(p=>infrastructure.test(p)&&!src.files[p].dir))
      out.file(path,await src.files[path].async('uint8array'));
  }else{
    /* 非標準 PPTX 不能安全替換母片結構；保留產生器自己的合法結構，
       將範例頁圖片改名搬入，避免與產生器的 media1.png 等檔名互撞。 */
    let n=1;
    for(const path of Object.keys(src.files).filter(p=>/^ppt\/media\//i.test(p)&&!src.files[p].dir)){
      const ext=(path.split('.').pop()||'png').replace(/[^a-z0-9]/gi,'')||'png';
      const dest=`ppt/media/template_${n++}.${ext}`; fallbackMedia[path]=dest;
      out.file(dest,await src.files[path].async('uint8array'));
    }
  }

  if(full){
    const gp=xmlDoc(await zipText(out,'ppt/presentation.xml'),'輸出 presentation.xml');
    const gr=xmlDoc(await zipText(out,'ppt/_rels/presentation.xml.rels'),'輸出 presentation.xml.rels');
    const sp=xmlDoc(await zipText(src,'ppt/presentation.xml'),'版型 presentation.xml');
    const sr=xmlDoc(await zipText(src,'ppt/_rels/presentation.xml.rels'),'版型 presentation.xml.rels');
    xmlList(gr,'Relationship').filter(x=>/slideMaster$/.test(x.getAttribute('Type')||'')).forEach(x=>x.remove());
    const idMap={};
    xmlList(sr,'Relationship').filter(x=>/slideMaster$/.test(x.getAttribute('Type')||'')).forEach(x=>{
      const n=gr.createElementNS(PPTX_NS.rel,'Relationship'), id=nextRelId(gr); idMap[x.getAttribute('Id')]=id;
      ['Type','Target','TargetMode'].forEach(k=>{ if(x.hasAttribute(k)) n.setAttribute(k,x.getAttribute(k)); }); n.setAttribute('Id',id);
      gr.documentElement.appendChild(n);
    });
    const oldMasters=xmlList(gp,'sldMasterIdLst')[0], sourceMasters=xmlList(sp,'sldMasterIdLst')[0];
    if(!sourceMasters) throw new Error('版型沒有母片清單');
    const imported=gp.importNode(sourceMasters,true);
    xmlList(imported,'sldMasterId').forEach(x=>{ const old=x.getAttributeNS(PPTX_NS.r,'id')||x.getAttribute('r:id'); if(idMap[old]) x.setAttributeNS(PPTX_NS.r,'r:id',idMap[old]); });
    if(oldMasters) oldMasters.parentNode.replaceChild(imported,oldMasters); else gp.documentElement.insertBefore(imported,xmlList(gp,'sldIdLst')[0]||gp.documentElement.firstChild);
    ['sldSz','notesSz'].forEach(tag=>{
      const a=xmlList(gp,tag)[0], b=xmlList(sp,tag)[0]; if(a&&b) a.parentNode.replaceChild(gp.importNode(b,true),a);
    });
    out.file('ppt/presentation.xml',new XMLSerializer().serializeToString(gp));
    out.file('ppt/_rels/presentation.xml.rels',new XMLSerializer().serializeToString(gr));
  }

  for(let i=0;i<exportSlides.length;i++){
    const rp=`ppt/slides/_rels/slide${i+1}.xml.rels`, f=out.file(rp); if(!f) continue;
    const exportSlide=exportSlides[i];
    const d=xmlDoc(await f.async('text'),rp), layout=templateLayoutFor(exportSlide.layout,exportSlide);
    if(full&&layout){
      let rel=xmlList(d,'Relationship').find(x=>/slideLayout$/.test(x.getAttribute('Type')||''));
      if(!rel){ rel=d.createElementNS(PPTX_NS.rel,'Relationship'); rel.setAttribute('Id',nextRelId(d)); rel.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout'); d.documentElement.appendChild(rel); }
      rel.setAttribute('Target','../slideLayouts/'+layout.path.split('/').pop());
      out.file(rp,new XMLSerializer().serializeToString(d));
    }

    const slidePath=`ppt/slides/slide${i+1}.xml`, slideFile=out.file(slidePath);
    if(slideFile){
      const slideDoc=xmlDoc(await slideFile.async('text'),slidePath);
      /* 讓母片／版面自己的背景、Logo 與頁尾顯示，不讓產生器的空白背景蓋住。 */
      if(full){
        xmlList(slideDoc,'bg').forEach(bg=>bg.remove());
        const root=slideDoc.documentElement;
        if(root&&root.getAttribute('showMasterSp')==='0') root.removeAttribute('showMasterSp');
      }

      /* 範例投影片模式：把樣板那一頁的裝飾圖形插到最前面（也就是文字底下）。
         這種樣板的設計全部畫在投影片上，只搬母片與版面配置的話會是一片空白。 */
      /* 安全頁絕對不複製範例投影片裝飾。前面的幾何規劃已經決定改用乾淨版面，
         這裡若沿用先前暫存的 DESIGN_ASSIGN，真正 PowerPoint 仍會把資訊圖塞回文字下面。 */
      const dIdx=exportSlide&&exportSlide.templateAutoSafeFor===t.name?null:designAssignments[i],
        design=dIdx?(t.designSlides||[]).find(x=>x.index===dIdx):null;
      if(design&&design.deco.length){
        const tree=xmlList(slideDoc,'spTree')[0];
        if(tree){
          const rd=xmlDoc(await out.file(rp).async('text'),rp), used={};
          const anchor=Array.from(tree.children||[]).find(el=>['sp','pic','grpSp','graphicFrame','cxnSp'].includes(el.localName))||null;
          design.deco.forEach(xml=>{
            let el; try{ el=slideDoc.importNode(xmlDoc(xml,'裝飾圖形').documentElement,true); }catch(e){ return; }
            /* 重新指向已複製到輸出檔的 ppt/media 圖片 */
            Array.from(el.getElementsByTagName('*')).concat([el]).forEach(node=>{
              const old=node.getAttribute&&node.getAttribute(R_EMBED_ATTR); if(!old) return;
              const sourcePart=design.media[old], part=full?sourcePart:fallbackMedia[sourcePart];
              if(!part||!out.file(part)){ node.removeAttribute(R_EMBED_ATTR); return; }
              if(!used[part]){
                const nr=rd.createElementNS(PPTX_NS.rel,'Relationship'), id=nextRelId(rd);
                nr.setAttribute('Id',id);
                nr.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
                nr.setAttribute('Target','../'+part.replace(/^ppt\//,''));
                rd.documentElement.appendChild(nr); used[part]=id;
              }
              node.setAttribute(R_EMBED_ATTR,used[part]);
            });
            if(anchor) tree.insertBefore(el,anchor); else tree.appendChild(el);
          });
          out.file(rp,new XMLSerializer().serializeToString(rd));
        }
      }
      out.file(slidePath,new XMLSerializer().serializeToString(slideDoc));
    }
  }

  const gc=xmlDoc(await zipText(out,'[Content_Types].xml'),'輸出 Content_Types'), sc=xmlDoc(await zipText(src,'[Content_Types].xml'),'版型 Content_Types');
  if(full) xmlList(gc,'Override').filter(x=>/^\/ppt\/(slideMasters|slideLayouts|theme|fonts)\//i.test(x.getAttribute('PartName')||'')).forEach(x=>x.remove());
  const haveDef=new Set(xmlList(gc,'Default').map(x=>x.getAttribute('Extension'))), haveOver=new Set(xmlList(gc,'Override').map(x=>x.getAttribute('PartName')));
  xmlList(sc,'Default').forEach(x=>{ const k=x.getAttribute('Extension'); if(!haveDef.has(k)){ gc.documentElement.appendChild(gc.importNode(x,true)); haveDef.add(k); } });
  xmlList(sc,'Override').filter(x=>full&&/^\/ppt\/(slideMasters|slideLayouts|theme|fonts)\//i.test(x.getAttribute('PartName')||'')).forEach(x=>{
    const k=x.getAttribute('PartName'); if(!haveOver.has(k)){ gc.documentElement.appendChild(gc.importNode(x,true)); haveOver.add(k); }
  });
  out.file('[Content_Types].xml',new XMLSerializer().serializeToString(gc));

  /* pptxgenjs 會把同一個 fontFace 同時寫進 <a:latin>、<a:ea>、<a:cs>，
     套母片時等於把中文指定成母片的英文字型（例如 Calibri）。
     這裡只改寫 <a:ea>，讓「中文用中文字型、英文維持母片字型」同時成立。 */
  const cjk=(S.pptTemplate&&templateTheme(curStyle(),null).cjkFont)||'Microsoft JhengHei';
  const cjkAttr='<a:ea typeface="'+cjk.replace(/"/g,'')+'"';
  /* 使用者在文字面板指定了實際字體的那幾頁不改寫，否則中文會被硬換回微軟正黑體 */
  const fixedFont=new Set();
  (exportSlides||[]).forEach((sl,i)=>{ if(sl&&sl.textStyle&&sl.textStyle.fontName) fixedFont.add(i+1); });
  for(const p of Object.keys(out.files).filter(p=>/^ppt\/(slides|notesSlides)\/[^/]+\.xml$/i.test(p))){
    const num=Number((p.match(/(\d+)\.xml$/)||[])[1])||0;
    if(fixedFont.has(num)) continue;
    const xml=await out.files[p].async('text');
    if(xml.indexOf('<a:ea ')<0) continue;
    out.file(p,xml.replace(/<a:ea typeface="[^"]*"/g,cjkAttr));
  }
  return out.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',compression:'DEFLATE'});
}

function prepareTemplateSlides(slides){
  const out=[], clone=x=>JSON.parse(JSON.stringify(x));
  const title=(s,n)=>n?String(s.title||'未命名')+'（續 '+(n+1)+'）':s.title;
  (slides||[]).forEach(src=>{
    const s=clone(src), layout=s.layout||'bullets';
    if(['bullets','agenda','closing'].includes(layout)&&(s.bullets||[]).length){
      const groups=[]; let cur=[], chars=0;
      (s.bullets||[]).forEach(b=>{ const n=String(b.h||'').length+String(b.d||'').length;
        if(cur.length&&(cur.length>=5||chars+n>190)){groups.push(cur);cur=[];chars=0;} cur.push(b);chars+=n; });
      if(cur.length) groups.push(cur);
      groups.forEach((g,i)=>out.push(Object.assign(clone(s),{title:title(s,i),bullets:g,exportContinuation:i>0})));
      return;
    }
    if(layout==='twoCol'&&(s.columns||[]).length){
      const cols=s.columns.slice(0,2), pages=Math.max(1,...cols.map(c=>Math.ceil((c.items||[]).length/4)));
      for(let i=0;i<pages;i++) out.push(Object.assign(clone(s),{title:title(s,i),exportContinuation:i>0,
        columns:cols.map(c=>({h:c.h,items:(c.items||[]).slice(i*4,i*4+4)}))}));
      return;
    }
    if(layout==='chart'&&s.chart){
      if(s.chart.type==='content'&&(s.chart.items||[]).length>4){
        for(let i=0;i<s.chart.items.length;i+=4){ const x=clone(s); x.title=title(s,i/4); x.exportContinuation=i>0; x.chart.items=x.chart.items.slice(i,i+4); out.push(x); }
        return;
      }
      const labels=s.chart.labels||[];
      if(labels.length>7){
        for(let i=0;i<labels.length;i+=7){ const x=clone(s); x.title=title(s,i/7); x.exportContinuation=i>0;
          x.chart.labels=labels.slice(i,i+7); x.chart.series=(x.chart.series||[]).map(one=>Object.assign({},one,{values:(one.values||[]).slice(i,i+7)})); out.push(x); }
        return;
      }
    }
    out.push(s);
  });
  return out;
}

async function exportPPTX(){
  if(!(S.slides||[]).length) return fail('目前沒有可匯出的投影片。');
  const templateCheck=scenarioTemplateStatus();
  if(!templateCheck.ok) return fail(templateCheck.msg);
  attachSourceNotes(S.slides); saveDraft();
  toast('打包 PPTX 中');
  try{
    const Pptx = (await loadLib('pptx')).lib;
    const st=curStyle(), pptx=new Pptx(), tpl=S.pptTemplate;
    const exportSlides=tpl?prepareTemplateSlides(S.slides):S.slides;
    // 以本次實際匯出的續頁頁序檢查；排版風險僅提醒，不再阻擋下載。
    const findings=tpl?exportSlides.flatMap((s,i)=>templateTextIssues(s).map(issue=>({page:i+1,issue}))):[];
    const isLayoutWarning=issue=>/空間不足|重疊|超出投影片邊界|內容區高度不足|需續頁|字級已|圖表可用高度不足/.test(issue);
    const fatal=findings.filter(x=>!isLayoutWarning(x.issue));
    if(fatal.length)return fail('無法安全產生 PPTX：'+fatal.map(x=>`第 ${x.page} 頁：${x.issue}`).join('；'));
    DESIGN_ASSIGN={};
    EXPORT_SLIDE_COUNT=exportSlides.length;
    const deckW=tpl?tpl.width:13.333, deckH=tpl?tpl.height:7.5, layoutName=tpl?'SFTEMPLATE':'SF16x9';
    pptx.defineLayout({name:layoutName,width:deckW,height:deckH}); pptx.layout=layoutName;
    pptx.title = S.topic||'簡報';
    const hx=c=>String(c||'#000000').replace('#','').toUpperCase();
    const M=0.8, W=deckW-M*2;

    exportSlides.forEach((s,idx)=>{
      const sl=pptx.addSlide();
      if(tpl){ addTemplateSlideContent(pptxSink(pptx,sl),s,idx,templateLayoutFor(s.layout,s),st,pptx); return; }
      const tx=slideTextStyle(s), FD=pptFontFamily(tx,st), FB=FD;
      const titleColor=hx(tx.titleColor||st.ink), bodyColor=hx(tx.bodyColor||st.sub);
      const titleOpts={fontSize:tx.titleSize,bold:!!tx.titleBold,italic:!!tx.titleItalic,color:titleColor,fontFace:FD,align:tx.align,
        charSpacing:tx.letterSpacing,lineSpacingMultiple:Math.min(1.3,tx.lineSpacing)};
      const bodyOpts={fontSize:tx.bodySize,bold:!!tx.bodyBold,italic:!!tx.bodyItalic,color:bodyColor,fontFace:FB,align:tx.align,
        charSpacing:tx.letterSpacing,lineSpacingMultiple:tx.lineSpacing};
      sl.background={color:hx(st.bg)};
      if(s.note) sl.addNotes(s.note);
      const sourceLabel=slideSourceFooter(s);
      const ky = s.kicker ? 0.5 : 0;   // 有核心結論就把內容往下推
      const kick=()=>{ if(s.kicker) sl.addText(s.kicker,
        {x:M,y:.72,w:W,h:.45,...bodyOpts,fontSize:Math.max(12,tx.bodySize-3),bold:true,color:hx(st.accent),valign:'top'}); };
      const foot=()=>{
        if(sourceLabel) sl.addText('資料來源：'+sourceLabel,
          {x:M,y:deckH-.68,w:W,h:.22,fontSize:8,color:hx(st.sub),fontFace:FB,margin:0,fit:'shrink'});
        sl.addText(String(idx+1).padStart(2,'0')+' / '+String(exportSlides.length).padStart(2,'0'),
          {x:W-1.2+M,y:deckH-.38,w:1.2,h:.24,align:'right',fontSize:10,color:hx(st.sub),fontFace:'Consolas'});
        if(s.footer) sl.addText(s.footer,{x:M,y:deckH-.38,w:6,h:.24,fontSize:10,color:hx(st.sub),fontFace:'Consolas'});
      };
      if(s.layout==='cover'){
        sl.addShape(pptx.ShapeType.rect,{x:M,y:2.2,w:.96,h:.06,fill:{color:hx(st.accent)}});
        sl.addText(s.title||'',{x:M,y:2.5,w:W,h:1.6,...titleOpts,valign:'top'});
        if(s.subtitle) sl.addText(s.subtitle,{x:M,y:4.2,w:W*.7,h:.8,...bodyOpts});
        if(sourceLabel) foot();
      }else if(s.layout==='stat'){
        kick();
        sl.addText(s.title||'重點數據',{x:M,y:1.9,w:W,h:.5,...titleOpts,fontSize:Math.max(12,tx.titleSize*.45),color:hx(st.accent),charSpacing:2});
        sl.addText(String((s.stat&&s.stat.value)||'—'),{x:M,y:2.3,w:W,h:2,fontSize:statPt(tx,Math.max(72,tx.titleSize*2.5)),bold:true,italic:!!tx.titleItalic,color:hx(st.accent),fontFace:FD,align:tx.align});
        sl.addText((s.stat&&s.stat.label)||'',{x:M,y:4.5,w:W*.75,h:.9,...bodyOpts,color:hx(tx.bodyColor||st.ink)});
        foot();
      }else if(s.layout==='chart' && s.chart){
        kick();
        sl.addText(s.title||'資料圖表',{x:M,y:.75+ky,w:W,h:.68,...titleOpts,fontSize:Math.min(tx.titleSize,38),valign:'top',fit:'shrink'});
        const chartY=1.62+ky, chartH=Math.max(3.45,4.48-ky), sourceY=chartY+chartH+.08;
        if(s.chart.type==='content'){
          addContentFlowPptx(pptxSink(pptx,sl),s.chart,{x:M,y:chartY,w:W,h:chartH},{surface:st.surface,ink:st.ink,sub:st.sub,accent:st.accent,accent2:st.accent2,font:FB});
          sl.addText('內容來源：'+(s.chart.source||'目前簡報頁面'),{x:M,y:sourceY,w:W,h:.18,fontSize:8,color:hx(st.sub),fontFace:FB,margin:0,fit:'shrink'});
        }else{
          const type=safeChartType(s.chart), labels=(s.chart.labels||[]).slice(0,10);
          const data=(s.chart.series||[]).slice(0,type==='doughnut'?1:2).map(one=>({
            name:chartUnitName(one),labels,values:(one.values||[]).slice(0,labels.length).map(pptChartValue)
          }));
          const chartType=type==='line'?pptx.ChartType.line:type==='doughnut'?pptx.ChartType.doughnut:pptx.ChartType.bar;
          sl.addChart(chartType,data,{x:M,y:chartY,w:W,h:chartH,
            barDir:type==='bar'?'bar':'col',showTitle:false,showLegend:data.length>1,legendPos:'b',
            chartColors:chartPalette(st,type==='doughnut'?labels.length:data.length).map(hx),
            showValue:type==='doughnut',showLabel:type==='doughnut',showPercent:type==='doughnut',holeSize:62,
            showCatName:false,showBorder:false,showGridLines:type!=='doughnut',
            catAxisLabelFontFace:FB,valAxisLabelFontFace:FB,catAxisLabelColor:bodyColor,valAxisLabelColor:bodyColor,
            catAxisLineColor:hx(st.rule),valAxisLineColor:hx(st.rule),showCatAxis:type!=='doughnut',showValAxis:type!=='doughnut',
            catAxisLabelFontSize:10,valAxisLabelFontSize:10,lineSize:type==='line'?3:1,dataLabelColor:hx(st.ink),dataLabelFontFace:FB,dataLabelFontSize:10,
            ...pptChartStyleProps(s.chart,st,type==='doughnut'?labels.length:data.length)});
          sl.addText('資料來源：'+(s.chart.source||'使用者上傳資料'),{x:M,y:sourceY,w:W,h:.18,fontSize:8,color:hx(st.sub),fontFace:FB,margin:0,fit:'shrink'});
        }
        foot();
      }else if(s.layout==='quote'){
        kick();
        sl.addText('“',{x:M,y:1.5,w:1,h:1,fontSize:80,color:hx(st.accent),fontFace:FD});
        sl.addText((s.quote&&s.quote.text)||s.title||'',{x:M,y:2.5,w:W*.85,h:2,...titleOpts});
        sl.addText((s.quote&&s.quote.by)||'',{x:M,y:4.7,w:W,h:.45,...bodyOpts,fontSize:Math.max(12,tx.bodySize-3)});
        foot();
      }else if(s.layout==='twoCol'){
        kick();
        sl.addText(s.title||'',{x:M,y:.75+ky,w:W,h:.78,...titleOpts});
        (s.columns||[]).slice(0,2).forEach((c,ci)=>{
          const cx=M+ci*(W/2+.2), cw=W/2-.2, cy=1.75+ky;
          sl.addShape(pptx.ShapeType.rect,{x:cx,y:cy,w:cw,h:4.4-ky,fill:{color:hx(st.surface)},line:{color:hx(st.rule),width:.5}});
          sl.addShape(pptx.ShapeType.rect,{x:cx,y:cy,w:cw,h:.05,fill:{color:hx(ci?st.accent2:st.accent)}});
          sl.addText(c.h||'',{x:cx+.3,y:cy+.25,w:cw-.6,h:.55,...bodyOpts,bold:true,color:hx(tx.bodyColor||st.ink)});
          sl.addText((c.items||[]).map(it=>({text:String(it),options:{breakLine:true}})),
            {x:cx+.3,y:cy+.85,w:cw-.6,h:3.3-ky,...bodyOpts,fontSize:Math.max(16,tx.bodySize-2),lineSpacingMultiple:1.5,valign:'top'});
        });
        foot();
      }else{
        kick();
        sl.addText(s.title||'',{x:M,y:.75+ky,w:W,h:.86,...titleOpts,valign:'top'});
        sl.addShape(pptx.ShapeType.rect,{x:M,y:1.65+ky,w:.67,h:.04,fill:{color:hx(st.accent)}});
        const bs=s.bullets||[], two=bs.length>4, per=Math.ceil(bs.length/2);
        bs.forEach((b,i)=>{
          const col = two && i>=per ? 1:0, row = two ? i%per : i;
          const cw = two ? W/2-.25 : W, bx = M+col*(W/2+.25), by = 2.05+ky+row*(two?1.05:1.1);
          sl.addShape(pptx.ShapeType.rect,{x:bx,y:by+.12,w:.1,h:.1,fill:{color:hx(st.accent)}});
          sl.addText(b.h||'',{x:bx+.28,y:by,w:cw-.28,h:.48,...bodyOpts,bold:true,color:hx(tx.bodyColor||st.ink),valign:'top'});
          if(b.d) sl.addText(b.d,{x:bx+.28,y:by+.46,w:cw-.28,h:.52,...bodyOpts,fontSize:Math.max(12,tx.bodySize-4),valign:'top'});
        });
        foot();
      }
    });
    const fileName=pptxFileName();
    /* toast/render 與非同步打包會重算預覽；固定本次匯出的頁序與裝飾對應。 */
    const exportDesignAssignments={...DESIGN_ASSIGN};
    const raw=await pptx.write({outputType:'arraybuffer'});
    if(tpl){
      toast('合併原始母片與版面配置');
      const blob=await applyPowerPointTemplate(raw,exportSlides,exportDesignAssignments);
      downloadBlob(fileName,blob);
    }else{
      downloadBlob(fileName,new Blob([raw],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}));
    }
    done();
    if(findings.length){
      const pages=[...new Set(findings.map(x=>x.page))].join('、');
      window.alert('PPTX 已產生並開始下載。\n\n部分頁面可能需要人工微調：第 '+pages+' 頁（依匯出檔頁碼）。\n'+
        findings.map(x=>`第 ${x.page} 頁：${x.issue}`).join('\n')+
        '\n\n請使用 PowerPoint 開啟檔案，檢查文字溢出、重疊與版面位置。');
    }
  }catch(e){ fail(e.message||'PPTX 匯出失敗'); }
  finally{ EXPORT_SLIDE_COUNT=0; }
}

function chartValueLabel(n){
  const v=Number(n)||0, a=Math.abs(v);
  const trim=x=>String(Number(x.toFixed(x>=100?0:x>=10?1:2)));
  if(a>=1e8) return trim(v/1e8)+'億';
  if(a>=1e4) return trim(v/1e4)+'萬';
  return Number.isInteger(v)?v.toLocaleString():String(Number(v.toFixed(2)));
}

function defaultTextStyle(s){
  const layout=(s&&s.layout)||'bullets', st=curStyle();
  return {titleSize:Number(st.titleSize)||(layout==='cover'?50:layout==='closing'?40:35),bodySize:Number(st.bodySize)||18,
    titleBold:true,titleItalic:false,bodyBold:false,bodyItalic:false,align:'left',fontFamily:st.fontFamily||'theme',
    fontName:'',statSize:0,statSizeSet:false,
    titleColor:'',bodyColor:'',letterSpacing:Number(st.letterSpacing)||0,lineSpacing:Number(st.lineSpacing)||1.35};
}

function slideTextStyle(s){
  const d=defaultTextStyle(s), t=Object.assign({},d,(s&&s.textStyle)||{});
  /* 只保留可讀下限，不再把使用者刻意調小的標題硬拉回 35／50pt。
     舊版的下限會讓小標題框的母片一定溢出，反而逼出更多續頁。 */
  t.titleSize=Math.max(s&&s.layout==='cover'?28:24,Math.min(64,Number(t.titleSize)||d.titleSize));
  t.bodySize=Math.max(16,Math.min(32,Number(t.bodySize)||d.bodySize));
  t.letterSpacing=Math.max(-1,Math.min(3,Number(t.letterSpacing)||0));
  t.lineSpacing=Math.max(1.15,Math.min(1.7,Number(t.lineSpacing)||1.35));
  if(!['left','center','right'].includes(t.align)) t.align='left';
  if(!['theme','sans','serif','mono'].includes(t.fontFamily)) t.fontFamily='theme';
  t.fontName=String(t.fontName||'');
  t.statSize=Math.max(16,Math.min(200,Number(t.statSize)||0));
  return t;
}

function statPt(t,fallback){ return (t&&t.statSizeSet&&t.statSize)?Number(t.statSize):Math.max(1,Number(fallback)||72); }

function pptFontFamily(t,st){
  if(t&&t.fontName) return t.fontName;          /* 使用者指定的實際字體優先 */
  if(t.fontFamily==='serif') return 'Georgia';
  if(t.fontFamily==='mono') return 'Consolas';
  if(t.fontFamily==='sans') return 'Microsoft JhengHei';
  return st.serif?'Georgia':'Microsoft JhengHei';
}

function textCss(t,kind,st,baseWeight){
  const title=kind==='title', size=(title?t.titleSize:t.bodySize)*1.5;
  const bold=title?t.titleBold:t.bodyBold, italic=title?t.titleItalic:t.bodyItalic;
  const color=(title?t.titleColor:t.bodyColor)||(title?st.ink:st.sub);
  const line=kind==='title'?Math.min(1.3,t.lineSpacing):t.lineSpacing;
  return `font-size:${size}px;font-weight:${bold?700:(baseWeight||400)};font-style:${italic?'italic':'normal'};text-align:${t.align};font-family:${webFontFamily(t,st)};color:${color};letter-spacing:${t.letterSpacing}px;line-height:${line}!important`;
}

function chartPalette(st,count){
  const base=[st.accent,st.accent2,mix(st.accent,st.ink,.42),mix(st.accent2,st.ink,.42)];
  while(base.length<count){
    const i=base.length, seed=i%2?st.accent2:st.accent, toward=i%4<2?st.bg:st.ink;
    base.push(mix(seed,toward,Math.min(.7,.18+Math.floor(i/2)*.1)));
  }
  return base.slice(0,Math.max(1,count));
}

function expandChartColors(colors,count,st){
  const base=(colors||[]).slice();
  if(!base.length) return chartPalette(st,count);
  while(base.length<count){
    const i=base.length, seed=base[i%Math.min(2,base.length)]||base[0];
    base.push(mix(seed,i%2?(st.bg||'#FFFFFF'):(st.ink||'#17212B'),Math.min(.62,.18+Math.floor(i/2)*.14)));
  }
  return base.slice(0,Math.max(1,count));
}

function chartDisplayStyle(chart,st,count){
  const id=(chart&&chart.styleId)||S.chartStyleDefault||'auto', lib=S.chartStyleLibrary;
  const built=BUILTIN_CHART_STYLES.find(x=>x.id===id);
  if(built) return {id,palette:expandChartColors(built.colors,count,st),showGrid:built.showGrid!==false,showValues:!!built.showValues,varyColors:false,
    plotBg:'transparent',axis:id==='accessible-contrast'?st.ink:st.sub,grid:st.rule,holeSize:id==='focus-gold'?66:62,legend:true,
    labelSize:Number(built.labelSize)||11,dataLabelSize:Number(built.dataLabelSize)||11,lineSize:Number(built.lineSize)||3};
  if(!lib||!/^template-/.test(id)) return {id:'auto',palette:chartPalette(st,count),showGrid:true,showValues:false,varyColors:false,
    plotBg:'transparent',axis:st.sub,grid:st.rule,holeSize:62,legend:true,labelSize:11,dataLabelSize:11,lineSize:3};
  const palette=(lib.palette||[]).slice();
  while(palette.length<count) palette.push(mix(palette[palette.length%Math.max(1,palette.length)]||st.accent,lib.canvas||st.bg,.28));
  const dark=id==='template-dark', focus=id==='template-focus';
  return {id,palette:palette.slice(0,Math.max(1,count)),showGrid:!focus,showValues:focus,varyColors:focus,
    plotBg:dark?(lib.dark||'#3F3F3F'):(lib.canvas||'#F2F2F2'),axis:dark?'#FFFFFF':(lib.ink||st.sub),
    grid:dark?'#777777':'#D6D6D6',holeSize:focus?68:62,legend:!focus,labelSize:11,dataLabelSize:11,lineSize:focus?4:3};
}

function pptChartStyleProps(chart,st,count){
  const cfg=chartDisplayStyle(chart,st,count), hx=c=>String(c||'#000000').replace('#','').toUpperCase(), out={
    chartColors:cfg.palette.map(hx),showGridLines:cfg.showGrid,
    showValue:cfg.showValues||safeChartType(chart)==='doughnut'||(((chart&&chart.series)||[]).length===1&&count<=8),
    varyColors:cfg.varyColors,holeSize:cfg.holeSize,showLegend:cfg.legend&&((chart.series||[]).length>1),
    catAxisLabelColor:hx(cfg.axis),valAxisLabelColor:hx(cfg.axis),catAxisLineColor:hx(cfg.grid),valAxisLineColor:hx(cfg.grid),dataLabelColor:hx(cfg.axis),
    catAxisLabelFontSize:cfg.labelSize,valAxisLabelFontSize:cfg.labelSize,dataLabelFontSize:cfg.dataLabelSize,lineSize:cfg.lineSize};
  if(cfg.plotBg&&cfg.plotBg!=='transparent'){
    out.chartArea={fill:{color:hx(cfg.plotBg)},border:{color:hx(cfg.plotBg),pt:0}};
    out.plotArea={fill:{color:hx(cfg.plotBg)},border:{color:hx(cfg.plotBg),pt:0}};
  }
  return out;
}

function chartUnitName(series){
  const unit=String(series&&series.unit||'').trim(), name=String(series&&series.name||'數值').trim();
  return unit&&!name.includes(unit)?name+'（'+unit+'）':name;
}

function safeChartType(chart){
  let requested=chart&&chart.type||'column';
  const labels=(chart&&chart.labels||[]).map(String);
  if(['column','line'].includes(requested)&&(labels.length>7||labels.some(x=>x.length>8))) requested='bar';
  if(requested!=='doughnut') return requested;
  const vals=((((chart||{}).series||[])[0]||{}).values||[]).map(Number);
  return vals.length&&vals.every(v=>Number.isFinite(v)&&v>=0)&&vals.reduce((a,b)=>a+b,0)>0?'doughnut':'column';
}

function pptChartValue(v){ const n=Number(v); return Number.isFinite(n)?n:null; }

function renderChartHTML(chart,st,box){
  chart=chart||{};
  const dataIssue=ChartDataContract.inspect(chart);
  if(dataIssue)return '<div role="alert" style="padding:20px;overflow-wrap:anywhere">'+esc(dataIssue)+'</div>';
  if(chart.type==='content'){
    const items=(chart.items||[]).slice(0,5);
    if(!items.length) return `<div style="display:grid;place-items:center;height:390px;border:1px dashed ${st.rule};color:${st.sub};font-size:22px">目前頁面沒有可整理的圖表內容</div>`;
    const cards=items.map((item,i)=>`<div style="min-width:0;flex:1;height:220px;border:1px solid ${st.rule};border-top:7px solid ${i%2?st.accent2:st.accent};background:${st.surface};padding:24px 18px;display:flex;flex-direction:column;justify-content:center;text-align:center;border-radius:${Math.min(10,st.radius)}px">
      <div style="font-size:13px;color:${st.sub};letter-spacing:1px;margin-bottom:12px">${String(i+1).padStart(2,'0')}</div>
      <div style="font-size:22px;font-weight:700;line-height:1.35;color:${st.ink}">${esc(item.label||'重點')}</div>
      ${item.detail?`<div style="font-size:15px;line-height:1.55;color:${st.sub};margin-top:12px">${esc(item.detail)}</div>`:''}</div>`).join(`<div aria-hidden="true" style="font-size:28px;color:${st.accent};flex:0 0 auto">→</div>`);
    return `<div style="height:390px;position:relative;display:flex;align-items:center;gap:14px;padding:18px 0 34px">${cards}<div style="position:absolute;right:0;bottom:0;font-size:13px;color:${st.sub}">內容來源：${esc(chart.source||'目前簡報頁面')}</div></div>`;
  }
  /* 預覽必須跟匯出用同一套型別規則，否則畫面是直柱圖、匯出的 PPTX 卻變成橫條圖 */
  const drawType=safeChartType(chart);
  const labels=(chart.labels||[]).slice(), series=(chart.series||[]).slice();
  if(labels.length<2||!series.length) return `<div style="display:grid;place-items:center;height:390px;border:1px dashed ${st.rule};color:${st.sub};font-size:22px">目前頁面沒有可整理的圖表內容</div>`;
  const cfg=chartDisplayStyle(chart,st,Math.max(series.length,labels.length)), colors=cfg.palette;
  const showDirectValues=cfg.showValues||(series.length===1&&labels.length<=8);
  const legend=cfg.legend?series.map((s,i)=>`<span style="display:inline-flex;align-items:center;gap:8px;margin-right:22px;font-size:${Math.max(15,cfg.labelSize+4)}px"><i style="width:12px;height:12px;background:${colors[i]};display:inline-block;border-radius:2px"></i>${esc(chartUnitName(s))}</span>`).join(''):'';
  const source=`<div class="chart-source" style="position:absolute;right:0;bottom:-28px;font-size:13px;color:${st.sub}">資料來源：${esc(chart.source||'使用者上傳資料')}</div>`;
  if(drawType==='doughnut'){
    const vals=(series[0].values||[]).slice(0,labels.length).map(v=>Number(v));
    if(vals.some(v=>!Number.isFinite(v)||v<0)) return `<div style="display:grid;place-items:center;height:390px;border:1px dashed ${st.rule};color:${st.sub};font-size:20px;text-align:center;padding:30px">圓餅圖不能包含負數或空值，請改用柱狀圖或先修正資料。</div>`;
    const total=vals.reduce((a,b)=>a+b,0); if(total<=0) return `<div style="display:grid;place-items:center;height:390px;border:1px dashed ${st.rule};color:${st.sub};font-size:20px">圓餅圖合計必須大於 0。</div>`;
    let at=0;
    const stops=vals.map((v,i)=>{ const from=at, to=at+v/total*100; at=to; return `${colors[i%colors.length]} ${from}% ${to}%`; }).join(',');
    const items=labels.map((label,i)=>`<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;font-size:18px;color:${st.ink}"><i style="width:13px;height:13px;background:${colors[i%colors.length]};display:block"></i><span style="flex:1">${esc(label)}</span><b style="font-family:'IBM Plex Mono',monospace">${chartValueLabel(vals[i])}</b><span style="width:52px;text-align:right;color:${st.sub}">${(vals[i]/total*100).toFixed(1)}%</span></div>`).join('');
    const hole=Math.round(330*cfg.holeSize/100);
    return `<div style="height:390px;display:grid;grid-template-columns:420px 1fr;align-items:center;gap:64px;position:relative"><div style="width:330px;height:330px;border-radius:50%;background:conic-gradient(${stops});display:grid;place-items:center;margin:auto"><div style="width:${hole}px;height:${hole}px;border-radius:50%;background:${st.bg};display:grid;place-items:center;text-align:center"><div><b style="display:block;font-size:34px;color:${st.ink}">${chartValueLabel(total)}</b><span style="font-size:14px;color:${st.sub}">合計</span></div></div></div><div>${items}</div>${source}</div>`;
  }
  const all=series.flatMap(s=>(s.values||[]).slice(0,labels.length).map(v=>Number(v)).filter(Number.isFinite));
  if(!all.length) return `<div style="display:grid;place-items:center;height:390px;border:1px dashed ${st.rule};color:${st.sub};font-size:20px">沒有可繪製的有效數值。</div>`;
  const domain=typeof utfChartDomain==='function'?utfChartDomain(all):{min:Math.min(0,...all),max:Math.max(0,...all),span:Math.max(1,Math.max(0,...all)-Math.min(0,...all))}, min=domain.min, max=domain.max, span=domain.span, W=1080,H=box?.w>0&&box?.h>0?Math.max(220,Math.min(1000,1080*box.h/box.w-28)):350, top=18,bottom=62;
  let marks='';
  if(drawType==='bar'){
    const valuePad=Math.max(80,...all.map(v=>chartValueLabel(v).length*10+24)), labelW=Math.max(190,valuePad), plotW=W-labelW-valuePad, rowH=(H-25)/labels.length, zeroX=labelW+(-min/span)*plotW;
    labels.forEach((label,i)=>{
      marks+=`<text x="${labelW-12}" y="${i*rowH+rowH*.58}" text-anchor="end" fill="${cfg.axis}" font-size="${Math.max(15,cfg.labelSize+4)}">${esc(label.slice(0,13))}</text>`;
      series.forEach((s,si)=>{ const v=Number((s.values||[])[i]); if(!Number.isFinite(v)) return;
        const bh=Math.min(16,rowH/(series.length+1)), y=i*rowH+rowH*.2+si*(bh+4), w=Math.abs(v)/span*plotW, x=v>=0?zeroX:zeroX-w;
        const fill=cfg.varyColors?colors[i%colors.length]:colors[si%colors.length];
        marks+=`<rect x="${x}" y="${y}" width="${w}" height="${bh}" rx="${Math.min(4,st.radius)}" fill="${fill}"/>`+(!chart.__freeLayout||showDirectValues?`<text x="${v>=0?x+w+8:x-8}" y="${y+bh-2}" text-anchor="${v>=0?'start':'end'}" fill="${cfg.axis}" font-size="${Math.max(13,cfg.dataLabelSize+2)}">${chartValueLabel(v)}</text>`:''); });
    });
  }else if(drawType==='line'){
    const plotX=35, plotW=W-70, plotH=H-bottom-top;
    if(cfg.showGrid) [0,.25,.5,.75,1].forEach(q=>{ const y=top+plotH*(1-q); marks+=`<line x1="${plotX}" y1="${y}" x2="${plotX+plotW}" y2="${y}" stroke="${cfg.grid}" stroke-width="1"/>`; });
    series.forEach((s,si)=>{ const pts=labels.map((_,i)=>{ const x=plotX+(labels.length===1?0:i/(labels.length-1))*plotW, v=Number((s.values||[])[i]); if(!Number.isFinite(v)) return null; const y=top+(max-v)/span*plotH; return {x,y,v}; }).filter(Boolean);
      if(!pts.length) return;
      marks+=`<polyline points="${pts.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="${colors[si]}" stroke-width="${Math.max(4,cfg.lineSize+1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      pts.forEach((p,pi)=>{ marks+=`<circle cx="${p.x}" cy="${p.y}" r="6" fill="${st.bg}" stroke="${colors[si]}" stroke-width="${Math.max(3,cfg.lineSize)}"/>`+
        (showDirectValues&&(chart.__freeLayout||(series.length===1&&(pi===0||pi===pts.length-1)))?`<text x="${p.x}" y="${Math.max(13,p.y-12)}" text-anchor="${pi===0?'start':'end'}" fill="${cfg.axis}" font-size="${Math.max(13,cfg.dataLabelSize+2)}">${chartValueLabel(p.v)}</text>`:''); }); });
    labels.forEach((label,i)=>{ const x=plotX+(labels.length===1?0:i/(labels.length-1))*plotW; marks+=`<text x="${x}" y="${H-24}" text-anchor="middle" fill="${cfg.axis}" font-size="${Math.max(14,cfg.labelSize+3)}">${esc(label.slice(0,9))}</text>`; });
  }else{
    const plotX=25, plotW=W-50, plotH=H-bottom-top, group=plotW/labels.length, gap=8, barW=Math.max(6,Math.min(42,(group-20)/series.length)), zeroY=top+(max/span)*plotH;
    if(cfg.showGrid) [0,.25,.5,.75,1].forEach(q=>{ const y=top+plotH*(1-q); marks+=`<line x1="${plotX}" y1="${y}" x2="${plotX+plotW}" y2="${y}" stroke="${cfg.grid}" stroke-width="1"/>`; });
    labels.forEach((label,i)=>{ series.forEach((s,si)=>{ const v=Number((s.values||[])[i]); if(!Number.isFinite(v)) return; const h=Math.abs(v)/span*plotH, x=plotX+i*group+(group-series.length*barW-(series.length-1)*gap)/2+si*(barW+gap), y=v>=0?zeroY-h:zeroY;
        const fill=cfg.varyColors?colors[i%colors.length]:colors[si%colors.length];
        marks+=`<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="${Math.min(4,st.radius)}" fill="${fill}"/>`+
          (showDirectValues?`<text x="${x+barW/2}" y="${v>=0?Math.max(13,y-7):Math.min(H-bottom+24,y+h+18)}" text-anchor="middle" fill="${cfg.axis}" font-size="${Math.max(12,cfg.dataLabelSize+1)}">${chartValueLabel(v)}</text>`:''); });
      marks+=`<text x="${plotX+i*group+group/2}" y="${H-24}" text-anchor="middle" fill="${cfg.axis}" font-size="${Math.max(14,cfg.labelSize+3)}">${esc(label.slice(0,8))}</text>`; });
  }
  return `<div class="numeric-chart-preview" style="height:390px;position:relative"><div style="height:28px;font-size:15px;color:${st.sub}">${legend}</div><svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:340px;overflow:visible;font-family:${SANS};background:${cfg.plotBg};border-radius:4px">${marks}</svg>${source}</div>`;
}

function renderTemplateSlide(s, st, idx, total, editable){
  const t=S.pptTemplate; if(!t) return null;
  const W=t.width, H=t.height, sink=htmlSink(W,H,editable);
  let design;
  try{
    if(typeof templatePlan!=='function'||typeof addTemplateSlideContent!=='function')
      throw new Error('模板排版程式未載入，請完整解壓縮套件，確認 layout-safety.js 與 index.html 位於同一資料夾');
    const layout=templateLayoutFor(s.layout,s),plan=templatePlan(s,idx,layout,st,null);
    design=plan.design;
    addTemplateSlideContent(sink,s,idx,layout,st,null,plan);
    S.lastTemplatePreviewError='';
  }catch(e){
    S.lastTemplatePreviewError=e.message||String(e);
    return `<div role="alert" style="position:absolute;inset:0;padding:70px;background:#fff;color:#222;font-size:28px;line-height:1.6"><b>模板預覽尚未完成</b><p>${esc(S.lastTemplatePreviewError)}</p><p>原始內容仍保留，修復後重新開啟預覽。</p></div>`;
  }
  const art=((design&&design.preview)||[]).map(p=>{
    const box=`position:absolute;left:${(p.x/W*100).toFixed(3)}%;top:${(p.y/H*100).toFixed(3)}%;`+
      `width:${(p.w/W*100).toFixed(3)}%;height:${(p.h/H*100).toFixed(3)}%;`+
      (p.rot?`transform:rotate(${p.rot}deg);`:'');
    return p.src?`<img src="${p.src}" alt="" style="${box}object-fit:fill">`
                :`<div style="${box}background:${esc(p.fill||'#eee')}"></div>`;
  }).join('');
  return `<div style="position:absolute;inset:0;background:${(t.colors&&t.colors.lt1)||'#fff'};overflow:hidden">
    ${art}${sink.parts.join('')}
  </div>`;
}

function renderSlide(s, st, idx, total, editable){
  const output=renderSlideBase(s,st,idx,total,editable);
  return output+(typeof Mascot!=='undefined'?Mascot.html(s,idx):'');
}
function renderSlideBase(s, st, idx, total, editable){
  if(!S.pptTemplate&&typeof FreeLayout!=='undefined')return FreeLayout.html(s,st,idx,total,editable);
  /* 只在唯讀預覽（縮圖、放映、匯出 HTML 以外）時套用樣板版面；
     可編輯的畫面仍用原本的網站版型，才能就地改字。 */
  /* 套版預覽模式下也允許就地編輯：文字框加上 data-edit，改完直接寫回這一頁 */
  if(!editable || S.tplPreview){
    const tpl=renderTemplateSlide(s,st,idx,total,!!editable);
    if(tpl) return tpl+(s.previewOnly?`<div style="position:absolute;right:22px;bottom:18px;padding:5px 9px;border-radius:5px;background:rgba(0,0,0,.62);color:#fff;font:12px/1.2 ${SANS};letter-spacing:.5px">風格示意</div>`:'');
  }
  const P=76, ed = editable ? ' contenteditable="true" spellcheck="false"' : '';
  const E=(path,txt,style,placeholder)=>`<div data-edit="${path}"${editable&&placeholder?` data-placeholder="${esc(placeholder)}"`:''}${ed} style="${style}">${esc(txt)}</div>`;
  const tx=slideTextStyle(s), display=webFontFamily(tx,st), titleColor=tx.titleColor||st.ink,
    bodyColor=tx.bodyColor||st.sub, titleCss=textCss(tx,'title',st,700), bodyCss=textCss(tx,'body',st,400);
  const grid = st.grid
    ? `<div style="position:absolute;inset:0;opacity:.28;background-image:linear-gradient(${st.rule} 1px,transparent 1px),linear-gradient(90deg,${st.rule} 1px,transparent 1px);background-size:48px 48px"></div>` : '';

  const bullets=(items,cols)=>{
    cols=cols||1;
    return `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${cols>1?34:22}px">`+
    (items||[]).map((b,i)=>`<div style="display:flex;gap:16px;align-items:flex-start">
      <div style="margin-top:9px;width:10px;height:10px;flex:0 0 auto;background:${st.accent};border-radius:${st.radius>4?5:0}px"></div>
      <div style="min-width:0">
        ${E('b:'+i+':h', b.h||'', `${bodyCss};font-weight:${tx.bodyBold?700:600};line-height:1.35;color:${tx.bodyColor||st.ink}`,'輸入條列標題')}
        ${(b.d||editable)?E('b:'+i+':d', b.d||'', `${bodyCss};font-size:${Math.max(16,(tx.bodySize-4)*1.5)}px;line-height:1.6;margin-top:6px`,'加入補充說明'):''}
      </div></div>`).join('')+`</div>`;
  };
  const sourceLabel=slideSourceFooter(s);
  const sourceFoot = sourceLabel ? `<div style="position:absolute;left:${P}px;right:${P}px;bottom:54px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      font-size:13px;color:${st.sub};line-height:1.35">資料來源：${esc(sourceLabel)}</div>` : '';
  const pageLabel=s.previewOnly?'風格示意':String(idx+1).padStart(2,'0')+' / '+String(total).padStart(2,'0');
  const foot = s.layout==='cover' ? sourceFoot : sourceFoot+
    `<div style="position:absolute;left:${P}px;right:${P}px;bottom:25px;display:flex;justify-content:space-between;
      font-family:'IBM Plex Mono',monospace;font-size:14px;color:${st.sub};letter-spacing:1px">
      <span>${esc(s.footer||'')}</span><span>${pageLabel}</span></div>`;

  const kickerLine = st2 => (s.kicker||editable)
    ? E('kicker', s.kicker||'', `${bodyCss};font-size:${Math.max(16,(tx.bodySize-3)*1.5)}px;font-weight:600;color:${st.accent};margin-bottom:${st2||14}px;line-height:1.4`,'加入核心結論')
    : '';

  let inner='';
  if(s.layout==='cover'){
    inner = `<div style="position:absolute;inset:0;padding:${P}px;display:flex;flex-direction:column;justify-content:center">
      <div style="width:92px;height:6px;background:${st.accent};margin-bottom:34px"></div>
      ${E('title', s.title||'', `${titleCss};line-height:1.14;max-width:960px;letter-spacing:-1px`)}
      ${E('subtitle', s.subtitle||'', `${bodyCss};margin-top:26px;max-width:820px;line-height:1.5`)}
    </div>`;
  }else if(s.layout==='stat'){
    inner = `<div style="position:absolute;inset:0;padding:${P}px;display:flex;flex-direction:column;justify-content:center">
      ${E('title', s.title||'', `${titleCss};font-size:${Math.max(18,tx.titleSize*1.1)}px;letter-spacing:2px;color:${st.accent};margin-bottom:14px`,'輸入數據頁標題')}
      ${kickerLine(18)}
      ${E('stat:value', (s.stat&&s.stat.value)||'', `font-size:${(statPt(tx,Math.max(72,tx.titleSize*2.5))*96/72).toFixed(1)}px;font-weight:700;line-height:1;font-family:${display};color:${st.accent};letter-spacing:-4px`,'輸入重點數據')}
      ${E('stat:label', (s.stat&&s.stat.label)||'', `${bodyCss};margin-top:24px;max-width:860px;line-height:1.5;color:${tx.bodyColor||st.ink}`,'加入數據說明')}
    </div>`;
  }else if(s.layout==='chart'){
    inner = `<div style="position:absolute;inset:0;padding:${P}px;display:flex;flex-direction:column">
      ${kickerLine(10)}
      ${E('title',s.title||'資料圖表',`${titleCss};line-height:1.2;margin-bottom:20px`)}
      ${renderChartHTML(s.chart,st)}
    </div>`;
  }else if(s.layout==='quote'){
    inner = `<div style="position:absolute;inset:0;padding:${P}px;display:flex;flex-direction:column;justify-content:center">
      ${kickerLine(10)}
      <div style="font-size:120px;line-height:.6;color:${st.accent};font-family:${display}">&ldquo;</div>
      ${E('quote:text', (s.quote&&s.quote.text)||'', `${titleCss};font-weight:${tx.titleBold?700:600};line-height:1.45;max-width:1000px;margin-top:20px`,'輸入引言內容')}
      ${E('quote:by', (s.quote&&s.quote.by)||'', `${bodyCss};margin-top:30px`,'輸入出處')}
    </div>`;
  }else if(s.layout==='twoCol'){
    const cols=(s.columns&&s.columns.length?s.columns:[{h:'',items:[]},{h:'',items:[]}]).slice(0,2);
    inner = `<div style="position:absolute;inset:0;padding:${P}px;display:flex;flex-direction:column">
      ${kickerLine(10)}
      ${E('title', s.title||'', `${titleCss};margin-bottom:28px`)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;flex:1">
      ${cols.map((c,ci)=>`<div style="background:${st.surface};border-radius:${st.radius}px;padding:30px;border-top:4px solid ${ci?st.accent2:st.accent}">
        ${E('c:'+ci+':h', c.h||'', `${bodyCss};font-weight:700;margin-bottom:18px;color:${tx.bodyColor||st.ink}`)}
        ${(c.items||[]).map((it,ii)=>E('c:'+ci+':i:'+ii, it, `${bodyCss};font-size:${Math.max(16,(tx.bodySize-2)*1.5)}px;line-height:1.65;margin-bottom:12px`)).join('')}
      </div>`).join('')}</div></div>`;
  }else if(s.layout==='closing'){
    inner = `<div style="position:absolute;inset:0;padding:${P}px;display:flex;flex-direction:column;justify-content:center">
      ${kickerLine(12)}
      ${E('title', s.title||'', `${titleCss};line-height:1.2;max-width:940px`)}
      <div style="width:120px;height:6px;background:${st.accent};margin:24px 0"></div>
      ${bullets((s.bullets||[]).slice(0,3))}</div>`;
  }else{
    const agenda = s.layout==='agenda';
    inner = `<div style="position:absolute;inset:0;padding:${P}px;display:flex;flex-direction:column">
      ${agenda?`<div style="font-family:'IBM Plex Mono',monospace;font-size:15px;letter-spacing:2.4px;color:${st.accent};margin-bottom:18px">AGENDA</div>`:''}
      ${kickerLine(14)}
      ${E('title', s.title||'', `${titleCss};line-height:1.25;margin-bottom:12px`)}
      <div style="width:64px;height:4px;background:${st.accent};margin-bottom:34px"></div>
      <div style="flex:1">${bullets(s.bullets,(s.bullets||[]).length>4?2:1)}</div></div>`;
  }

  return `<div style="position:absolute;inset:0;background:${st.bg};color:${st.ink};font-family:${SANS};overflow:hidden">
    ${grid}<div style="position:absolute;inset:0">${inner}</div>${foot}</div>`;
}

function editValue(s,path){
  const p=path.split(':');
  if(p[0]==='title'||p[0]==='kicker'||p[0]==='subtitle') return s[p[0]]||'';
  if(p[0]==='b') return s.bullets&&s.bullets[+p[1]]?s.bullets[+p[1]][p[2]]||'':'';
  if(p[0]==='c'){
    const c=s.columns&&s.columns[+p[1]]; if(!c) return '';
    return p[2]==='h'?(c.h||''):((c.items||[])[+p[3]]||'');
  }
  if(p[0]==='stat') return s.stat&&s.stat[p[1]]||'';
  if(p[0]==='quote') return s.quote&&s.quote[p[1]]||'';
  return '';
}

function applyEdit(idx, path, value){
  const s = S.slides[idx]; if(!s) return;
  value=String(value||'').trim();
  if(String(editValue(s,path)).trim()===value) return false;
  pushHistory(idx);
  const p = path.split(':');
  if(p[0]==='title') s.title=value;
  else if(p[0]==='kicker') s.kicker=value;
  else if(p[0]==='subtitle') s.subtitle=value;
  else if(p[0]==='b'){ s.bullets=s.bullets||[]; if(s.bullets[+p[1]]) s.bullets[+p[1]][p[2]]=value; }
  else if(p[0]==='c'){ s.columns=s.columns||[];
    if(!s.columns[+p[1]]) return;
    if(p[2]==='h') s.columns[+p[1]].h=value; else s.columns[+p[1]].items[+p[3]]=value; }
  else if(p[0]==='stat'){ s.stat=s.stat||{}; s.stat[p[1]]=value; }
  else if(p[0]==='quote'){ s.quote=s.quote||{}; s.quote[p[1]]=value; }
  s.status='edited'; saveDraft(); return true;
}

function pushHistory(idx){
  const s=S.slides[idx]; if(!s) return;
  S.globalUndo=null;
  const clone = JSON.parse(JSON.stringify(Object.assign({},s,{history:undefined})));
  s.history = (s.history||[]).concat([clone]).slice(-6);
}

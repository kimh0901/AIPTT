/* Advanced evidence uses existing verified chart rows, never guesses new values. */
const ADVANCED_TYPES=['table','scatter','stacked100'];
function advancedFontScale(){
  return Math.max(1,Math.min(2.5,Math.min((Number(S.pptTemplate?.width)||13.333)/13.333,(Number(S.pptTemplate?.height)||7.5)/7.5)));
}
function advancedExactNumber(v){
  const [integer,fraction]=String(v).split('.');
  if(/[eE]/.test(String(v)))return String(v);
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);
}
function advancedRange(values){
  const lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||Math.abs(lo)||1;
  const raw=span/4,power=10**Math.floor(Math.log10(raw)),step=Math.ceil(raw/power)*power;
  return {min:lo>=0?Math.max(0,Math.floor((lo-span*.08)/step)*step):Math.floor((lo-span*.08)/step)*step,max:Math.ceil((hi+span*.08)/step)*step,step};
}
function advancedHeaderInk(color){
  const hex=String(color).replace('#','');
  const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'18212B':'FFFFFF';
}
function advancedEvidence(chart){
  if(!chart||!ADVANCED_TYPES.includes(chart.type))throw new Error('不支援的進階呈現');
  const labels=(chart.labels||[]).map(String),series=chart.series||[];
  if(!labels.length||!series.length)throw new Error('缺少分類或數值');
  if(series.some(s=>!Array.isArray(s.values)||s.values.length!==labels.length||s.values.some(v=>typeof v!=='number'||!Number.isFinite(v))))throw new Error('數值或分類未對齊，請先修正資料');
  if(chart.type!=='table'&&series.length!==2)throw new Error('請先選擇兩個數值欄，並確認同一列代表相同對象與期間');
  if(chart.type==='stacked100'&&(series.some(s=>s.values.some(v=>v<0))||labels.some((_,i)=>series.reduce((n,s)=>n+s.values[i],0)<=0)))throw new Error('100% 堆疊需非負數且每組合計大於零');
  return {type:chart.type,labels,series:series.map(s=>({name:chartUnitName(s),values:s.values.slice()})),
    headers:[chart.category||'項目',...series.map(chartUnitName)],
    rows:labels.map((l,i)=>[l,...series.map(s=>advancedExactNumber(s.values[i]))])};
}
function advancedTableLayout(chart,w){
  const e=advancedEvidence(chart),fontSize=Math.round(14*advancedFontScale()*10)/10,margin=.07*advancedFontScale();
  const weights=e.headers.map((h,j)=>Math.max(6,Math.min(28,Math.max(...[h,...e.rows.map(r=>r[j])].map(v=>Array.from(v).length)))));
  const sum=weights.reduce((a,b)=>a+b,0),colW=weights.map(v=>w*v/sum);
  const lineCount=(text,j)=>Math.max(1,Math.ceil(Array.from(text).length*fontSize/72/Math.max(.1,colW[j]-margin*2)));
  const heights=[e.headers,...e.rows].map(row=>Math.max(...row.map(lineCount))*fontSize/72*1.45+margin*2);
  return {...e,fontSize,margin,colW,heights,height:heights.reduce((a,b)=>a+b,0)};
}
function addAdvancedNative(slide,chart,box){
  const e=advancedEvidence(chart),face=box.catAxisLabelFontFace||box.fontFace||'Microsoft JhengHei',colors=box.chartColors||['247D9A','E1A544'];
  if(e.type==='table'){
    const t=advancedTableLayout(chart,box.w);
    const rows=[t.headers,...t.rows].map((r,i)=>r.map((text,j)=>({text,options:{bold:i===0,fill:i===0?colors[0]:(i%2?'F1F5F9':'FFFFFF'),color:i===0?advancedHeaderInk(colors[0]):'18212B',align:j?'right':'left'}})));
    slide.addTable(rows,{x:box.x,y:box.y,w:box.w,colW:t.colW,rowH:t.heights,fontFace:face,fontSize:t.fontSize,margin:t.margin*72,border:{pt:.5,color:'B7C3CE'},autoPage:false,breakLine:false,verbose:false});return;
  }
  const opts={x:box.x,y:box.y,w:box.w,h:box.h,showTitle:false,showLegend:e.type==='stacked100',legendPos:'b',legendFontFace:face,legendFontSize:11,
    chartColors:colors,catAxisLabelFontFace:face,valAxisLabelFontFace:face,catAxisLabelFontSize:11,valAxisLabelFontSize:11,
    showBorder:false,showValue:false,showCatName:false,showCatAxis:true,showValAxis:true};
  const scale=Math.round(advancedFontScale()*10)/10;
  opts.catAxisLabelFontSize=11*scale;opts.valAxisLabelFontSize=11*scale;opts.legendFontSize=11*scale;
  if(e.type==='scatter'){
    const xr=advancedRange(e.series[0].values),yr=advancedRange(e.series[1].values);
    Object.assign(opts,{catAxisMinVal:xr.min,catAxisMaxVal:xr.max,catAxisMajorUnit:xr.step,valAxisMinVal:yr.min,valAxisMaxVal:yr.max,valAxisMajorUnit:yr.step});
    slide.addChart('scatter',[{name:e.series[0].name,values:e.series[0].values},{name:e.series[1].name,labels:e.labels,values:e.series[1].values}],
      {...opts,lineSize:0,lineDataSymbol:'circle',lineDataSymbolSize:Math.round(7*scale),showLabel:false,showCatAxisTitle:true,catAxisTitle:e.series[0].name,showValAxisTitle:true,valAxisTitle:e.series[1].name,catAxisTitleFontSize:Math.round(12*scale),valAxisTitleFontSize:Math.round(12*scale)});
  }else slide.addChart('bar',e.series.map(s=>({...s,labels:e.labels})),{...opts,barDir:'col',barGrouping:'percentStacked',barOverlapPct:100,catAxisLabelRotate:e.labels.some(l=>l.length>6)?-45:0,valAxisMinVal:0,valAxisMaxVal:1,valAxisMajorUnit:.25,valAxisLabelFormatCode:'0%'});
}
const sinkBeforeAdvanced=pptxSink;
pptxSink=function(pptx,slide){const sink=sinkBeforeAdvanced(pptx,slide);sink.advanced=(chart,box)=>addAdvancedNative(slide,chart,box);return sink;};
const contentBeforeAdvanced=addTemplateSlideContent;
addTemplateSlideContent=function(sink,s,idx,layout,st,pptx,plan){
  if(!ADVANCED_TYPES.includes(s.chart?.type)||sink.html)return contentBeforeAdvanced(sink,s,idx,layout,st,pptx,plan);
  return contentBeforeAdvanced({...sink,chart:(_type,_data,box)=>sink.advanced(s.chart,box)},s,idx,layout,st,pptx,plan);
};
function prepareAdvancedSlides(slides){
  return slides.flatMap(source=>{
    // A retained chart is not visible in cover/text layouts. Only the active
    // chart layout may paginate its table; never duplicate a cover for it.
    if(source.layout!=='chart'||source.chart?.type!=='table')return [source];
    /* 「完全固定原位置」連頁數也固定，表格不自動續頁，放不下時只提醒。 */
    if(source.templateFitMode==='preserve')return [source];
    const result=[],total=source.chart.labels.length;
    /* 版面框連兩列都放不下時，分頁只會產生一堆「每頁一列」的碎頁，
       跟內容多寡無關。這種情況維持整張表一頁，交給原本的空間提醒處理。 */
    if(S.pptTemplate&&total>1){
      const probe=JSON.parse(JSON.stringify(source));
      probe.chart.labels=source.chart.labels.slice(0,2);
      probe.chart.series=source.chart.series.map(s=>({...s,values:s.values.slice(0,2)}));
      const pbox=templatePlan(probe).ops.find(o=>o.kind==='chart')?.args[2];
      if(pbox&&advancedTableLayout(probe.chart,pbox.w).height>pbox.h)return [source];
    }
    let start=0;
    while(start<total){
      let n=Math.min(6,total-start),candidate;
      while(n>=1){
        candidate=JSON.parse(JSON.stringify(source));candidate.chart.labels=source.chart.labels.slice(start,start+n);
        candidate.chart.series=source.chart.series.map(s=>({...s,values:s.values.slice(start,start+n)}));
        if(start){candidate.exportContinuation=true;candidate.tableContinuation=true;candidate.title=String(source.title||'表格')+'（續 '+(result.length+1)+'）';}
        const box=S.pptTemplate?templatePlan(candidate).ops.find(o=>o.kind==='chart')?.args[2]:{w:11.7,h:4.2};
        if(!box||advancedTableLayout(candidate.chart,box.w).height<=box.h||n===1)break;
        n--;
      }
      candidate.exportOrigin=source.exportOrigin||source.id;
      if(start){candidate.id=source.id+'-table-'+start;candidate.exportContinuation=true;}
      result.push(candidate);start+=n;
    }
    return result;
  });
}
const prepareBeforeAdvanced=prepareTemplateSlides;
prepareTemplateSlides=slides=>prepareBeforeAdvanced(prepareAdvancedSlides(slides));
const planBeforeAdvanced=templatePlan;
templatePlan=function(s,...args){
  const plan=planBeforeAdvanced(s,...args);
  if(s.chart?.type==='table'){
    const box=plan.ops.find(o=>o.kind==='chart')?.args[2];
    if(box&&advancedTableLayout(s.chart,box.w).height>box.h)plan.ops.push({kind:'problem',args:['表格文字空間不足，請人工調整欄寬或列高']});
  }
  if(['scatter','stacked100'].includes(s.chart?.type)){
    const box=plan.ops.find(o=>o.kind==='chart')?.args[2];
    if(box&&(box.h<2.2||box.w<5))plan.ops.push({kind:'problem',args:['圖表文字空間不足，標籤可能擁擠，建議選擇較寬版面或於 PowerPoint 微調']});
  }
  return plan;
};
const renderBeforeAdvanced=renderChartHTML;
renderChartHTML=function(chart,st,box){
  if(!ADVANCED_TYPES.includes(chart?.type))return renderBeforeAdvanced(chart,st,box);
  try{
    const e=advancedEvidence(chart),palette=chartDisplayStyle(chart,st,e.series.length).palette;
    if(e.type==='table'){
      const w=box?.w||11.7,t=advancedTableLayout(chart,w),rows=[t.headers,...t.rows],ppi=1280/(S.pptTemplate?.width||13.333);
      return '<div style="width:100%;height:100%;overflow:auto"><table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:'+t.fontSize/72*ppi+'px;line-height:1.45">'+
        '<colgroup>'+t.colW.map(cw=>'<col style="width:'+cw/w*100+'%">').join('')+'</colgroup>'+rows.map((r,i)=>'<tr style="height:'+t.heights[i]*ppi+'px">'+r.map((v,j)=>'<'+(i?'td':'th')+' style="border:1px solid #b7c3ce;padding:'+t.margin*ppi+'px;overflow-wrap:anywhere;text-align:'+(j?'right':'left')+';background:'+(i?(i%2?'#f1f5f9':'#fff'):palette[0])+';color:'+(i?'#18212b':'#'+advancedHeaderInk(palette[0]))+'">'+esc(v)+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</table></div>';
    }
    const W=800,H=440,L=92,R=720,T=36,B=e.type==='stacked100'?270:328;
    let marks='',axis='';
    if(e.type==='scatter'){
      const xr=advancedRange(e.series[0].values),yr=advancedRange(e.series[1].values),xmin=xr.min,xmax=xr.max,ymin=yr.min,ymax=yr.max;
      const x=v=>L+(v-xmin)/(xmax-xmin)*(R-L),y=v=>B-(v-ymin)/(ymax-ymin)*(B-T);
      for(let v=xmin;v<=xmax+xr.step*.001;v+=xr.step)axis+='<text x="'+x(v)+'" y="350" text-anchor="middle">'+esc(Number(v.toPrecision(10)).toLocaleString('en-US',{maximumFractionDigits:6}))+'</text>';
      for(let v=ymin;v<=ymax+yr.step*.001;v+=yr.step)axis+='<text x="80" y="'+(y(v)+5)+'" text-anchor="end">'+esc(Number(v.toPrecision(10)).toLocaleString('en-US',{maximumFractionDigits:6}))+'</text>';
      marks=e.labels.map((label,i)=>'<circle cx="'+x(e.series[0].values[i])+'" cy="'+y(e.series[1].values[i])+'" r="6" fill="'+palette[0]+'"><title>'+esc(label+': '+e.series.map(s=>s.values[i]).join(', '))+'</title></circle>').join('');
      axis+='<text x="406" y="395" text-anchor="middle">'+esc(e.series[0].name)+'</text><text x="18" y="185" transform="rotate(-90 18 185)" text-anchor="middle">'+esc(e.series[1].name)+'</text>';
    }else{
      const group=(R-L)/e.labels.length,bw=Math.min(70,group*.6);
      e.labels.forEach((l,i)=>{let bottom=B;const sum=e.series.reduce((n,s)=>n+s.values[i],0);e.series.forEach((s,j)=>{const h=s.values[i]/sum*(B-T);marks+='<rect x="'+(L+(i+.5)*group-bw/2)+'" y="'+(bottom-h)+'" width="'+bw+'" height="'+h+'" fill="'+palette[j]+'"><title>'+esc(l+' '+s.name+': '+(s.values[i]/sum*100).toFixed(1)+'%')+'</title></rect>';bottom-=h;});const x=L+(i+.5)*group;axis+='<text x="'+x+'" y="292" '+(e.labels.some(v=>v.length>6)?'transform="rotate(-45 '+x+' 292)" text-anchor="end"':'text-anchor="middle"')+' font-size="12">'+esc(l)+'</text>';});
      for(let i=0;i<=4;i++)axis+='<text x="80" y="'+(B-i/4*(B-T)+5)+'" text-anchor="end">'+i*25+'%</text>';
      e.series.forEach((s,j)=>axis+='<text x="'+(L+j*300)+'" y="397" fill="'+palette[j]+'">■ '+esc(s.name)+'</text>');
    }
    return '<svg role="img" aria-label="'+esc(e.type==='scatter'?'散佈圖，呈現關聯而非因果':'100% 堆疊圖')+'" viewBox="0 0 '+W+' '+H+'" style="width:100%;height:100%;min-height:180px;font:15px Microsoft JhengHei,sans-serif;fill:'+st.ink+'"><path d="M'+L+' '+T+'V'+B+'H'+R+'" fill="none" stroke="'+st.sub+'"/>'+axis+marks+'</svg>';
  }catch(e){return '<div role="alert">'+esc(e.message)+'</div>';}
};
const stylesBeforeAdvanced=builtinChartStyleBox;
builtinChartStyleBox=function(cur){
  const html=stylesBeforeAdvanced(cur);if(!cur?.chart||cur.chart.type==='content')return html;
  return '<section style="padding:12px;border:1px solid var(--line);margin-bottom:12px"><b>進階資料呈現'+(ADVANCED_TYPES.includes(cur.chart.type)?'：'+({table:'原生表格',scatter:'散佈圖',stacked100:'100% 堆疊'})[cur.chart.type]:'')+'</b><p class="hint">以目前圖表已確認的資料建立新頁（不是整份 Excel）。散佈圖需兩欄，100% 堆疊需同單位且可相加的組成項目。匯出後可在 PowerPoint 編輯表格或圖表資料；要重新選取 Excel 欄位，請回來源頁生成圖表。</p><div style="display:flex;flex-wrap:wrap;gap:8px">'+[['table','可編輯表格'],['scatter','散佈圖'],['stacked100','100% 堆疊']].map(([t,n])=>'<button class="btn" data-advanced-evidence="'+t+'">'+n+'</button>').join('')+'</div></section>'+html;
};
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-advanced-evidence]');if(!b)return;
  try{
    const original=S.slides[S.cursor],copy=JSON.parse(JSON.stringify(original)),kind=b.dataset.advancedEvidence;
    copy.chart.type=kind;advancedEvidence(copy.chart);
    if(kind==='stacked100'&&!window.confirm('請確認兩個數值欄為同單位、同期間且可相加的組成項目。每個分類將以兩欄合計為 100%，不是原始總量；確認繼續？'))return;
    if(kind==='scatter'&&!window.confirm('請確認兩個欄位每一列都對應相同對象與期間。第一欄為 X、第二欄為 Y；圖形僅呈現關聯，不證明因果。'))return;
    copy.id=uid();copy.kicker=kind==='scatter'?'同列資料對應，關聯不代表因果':kind==='stacked100'?'各分類以所選系列合計為 100%':'原始資料明細';copy.status='generated';
    delete copy.exportOrigin;delete copy.exportContinuation;
    S.slides.splice(S.cursor+1,0,copy);S.cursor++;saveDraft();render();
  }catch(e){fail(e.message);}
});

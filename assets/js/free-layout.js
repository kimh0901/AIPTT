/* Explicit shared free-style plan. No template, analysis or source-data mutation. */
const FreeLayout=(()=>{
  const W=13.333,H=7.5,hx=c=>String(c||'#000000').replace('#','');
  function plan(s,st,index,total){
    const t=slideTextStyle(s),items=[],issues=[],font=pptFontFamily(t,st);
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    function height(text,width,size,line,bold){
      ctx.font=`${bold?'bold ':''}${size*96/72}px "${font}"`;
      let lines=1,used=0;for(const ch of String(text||'')){if(ch==='\n'){lines++;used=0;continue;}const n=ctx.measureText(ch).width+Math.max(0,t.letterSpacing)*96/72;if(used+n>width*96){lines++;used=0;}used+=n;}
      return lines*size/72*line*1.12;
    }
    function text(value,edit,x,y,w,h,size,bold,color){
      let fs=size,lh=t.lineSpacing;
      if(height(value,w,fs,lh,bold)>h)lh=1.15;
      const min=Math.min(size,edit==='title'?24:14);
      while(fs>min&&height(value,w,fs,lh,bold)>h)fs=Math.max(min,fs-.5);
      if(height(value,w,fs,lh,bold)>h)issues.push('文字空間不足：'+(edit||'頁尾')+'，請人工微調');
      items.push({kind:'text',value:String(value??''),o:{edit,x,y,w,h,fontFace:font,fontSize:fs,bold,italic:edit==='title'?t.titleItalic:t.bodyItalic,color:hx(color),align:t.align,charSpacing:t.letterSpacing,lineSpacingMultiple:lh,margin:0,breakLine:false,valign:'top'}});
    }
    function rect(x,y,w,h,color,round=false){items.push({kind:round?'roundRect':'rect',o:{x,y,w,h,fill:{color:hx(color)},line:{color:hx(color),transparency:100}}});}
    if(st.grid){for(let x=0;x<W;x+=.5)rect(x,0,.006,H,st.rule);for(let y=0;y<H;y+=.5)rect(0,y,W,.006,st.rule);}
    const ink=t.titleColor||st.ink,body=t.bodyColor||st.sub;
    let y=.55;if(s.kicker){text(s.kicker,'kicker',.8,y,11.73,.55,t.bodySize-2,true,st.accent);y+=.65;}
    if(s.layout==='cover'){
      rect(.8,1.85,.9,.05,st.accent);text(s.title,'title',.8,2.05,11.73,1.8,t.titleSize,t.titleBold,ink);text(s.subtitle,'subtitle',.8,4.05,10.6,1.25,t.bodySize,t.bodyBold,body);
    }else{
      text(s.title,'title',.8,y,11.73,1.05,t.titleSize,t.titleBold,ink);y+=1.2;
      const bottom=6.55,avail=bottom-y;
      if(s.layout==='chart'&&s.chart){items.push({kind:'chart',chart:s.chart,o:{x:.8,y,w:11.73,h:avail-.25,fontFace:font}});}
      else if(s.layout==='stat'){text(s.stat?.value,'stat:value',.8,y,11.73,2.2,statPt(t,90),true,st.accent);text(s.stat?.label,'stat:label',.8,y+2.4,11.73,Math.max(.5,avail-2.4),t.bodySize,t.bodyBold,body);}
      else if(s.layout==='quote'){text(s.quote?.text,'quote:text',.8,y,11.73,avail-.65,t.titleSize,t.titleBold,ink);text(s.quote?.by,'quote:by',.8,bottom-.5,11.73,.45,t.bodySize,false,body);}
      else if(s.layout==='twoCol'){
        (s.columns||[]).slice(0,2).forEach((c,i)=>{const x=.8+i*6.02;rect(x,y,5.71,avail,st.surface,st.radius>0);text(c.h,'c:'+i+':h',x+.22,y+.2,5.27,.65,t.bodySize,true,ink);const rows=c.items||[],rh=(avail-1.05)/Math.max(1,rows.length);rows.forEach((v,j)=>text(v,'c:'+i+':i:'+j,x+.22,y+1+j*rh,5.27,Math.max(.12,rh-.08),t.bodySize,t.bodyBold,body));});
      }else{
        const bs=s.bullets||[],cols=bs.length>5?2:1,rows=Math.ceil(bs.length/cols),rh=avail/Math.max(1,rows),cw=cols===1?11.73:5.71;
        bs.forEach((b,i)=>{const x=.8+Math.floor(i/rows)*6.02,by=y+(i%rows)*rh,hh=b.d?Math.min(.32,rh*.35):rh-.1;rect(x,by+.12,.08,.08,st.accent);text(b.h,'b:'+i+':h',x+.25,by,cw-.25,hh,t.bodySize,true,ink);if(b.d)text(b.d,'b:'+i+':d',x+.25,by+hh+.04,cw-.25,Math.max(.12,rh-hh-.1),t.bodySize-2,t.bodyBold,body);});
        if(!bs.length&&s.subtitle)text(s.subtitle,'subtitle',.8,y,11.73,avail,t.bodySize,t.bodyBold,body);
      }
    }
    const source=slideSourceFooter(s)||s.chart?.source;
    if(source)text('資料來源：'+source,'',.8,6.78,11.73,.3,9,false,body);
    text(s.footer||'','',.8,7.12,9,.25,9,false,body);
    if(s.layout!=='cover')text(`${index+1} / ${total}`,'',11.5,7.12,1,.25,9,false,body);
    return {items,issues:[...new Set(issues)],background:st.bg};
  }
  function draw(p,sink,st,pptx,sl){
    for(const item of p.items){if(item.kind!=='chart'){sink[item.kind](item.value===undefined?item.o:item.value,item.value===undefined?undefined:item.o);continue;}
      const c={...item.chart,__freeLayout:true},o=item.o;
      if(c.type==='doughnut'){
        const values=c.series[0].values,total=values.reduce((a,b)=>a+Number(b),0),cfg=chartDisplayStyle(c,st,c.labels.length),size=Math.min(o.h,4),x=o.x+.2,y=o.y+(o.h-size)/2;
        if(sink.html){let at=0;const stops=values.map((v,i)=>{const from=at;at+=v/total*100;return `${cfg.palette[i%cfg.palette.length]} ${from}% ${at}%`}).join(',');sink.parts.push(`<div style="position:absolute;left:${x/W*100}%;top:${y/H*100}%;width:${size/W*100}%;height:${size/H*100}%;border-radius:50%;background:conic-gradient(${stops})"><div style="position:absolute;inset:${(100-cfg.holeSize)/2}%;background:${st.bg};border-radius:50%"></div></div>`);}
        else sink.chart(pptx.ChartType.doughnut,[{name:chartUnitName(c.series[0]),labels:c.labels,values:values.slice()}],{x,y,w:size,h:size,holeSize:cfg.holeSize,showLegend:false,showValue:false,showPercent:false,showLabel:false,showTitle:false,showBorder:false,chartColors:cfg.palette.map(hx),chartArea:{fill:{color:hx(st.bg)},border:{color:hx(st.bg)}}});
        const txt=(v,b,fs=14)=>sink.text(v,{...b,fontSize:fs,fontFace:o.fontFace,color:hx(st.ink),margin:0,lineSpacingMultiple:1.15,align:'left',valign:'top'});
        txt(chartValueLabel(total),{x:x+size*.3,y:y+size*.42,w:size*.4,h:.4},22);
        txt('合計',{x:x+size*.4,y:y+size*.55,w:size*.3,h:.25},11);
        const rh=Math.min(.55,o.h/Math.max(1,c.labels.length));c.labels.forEach((label,i)=>{const yy=o.y+i*rh;sink.rect({x:o.x+4.6,y:yy+.1,w:.12,h:.12,fill:{color:hx(cfg.palette[i%cfg.palette.length])},line:{transparency:100}});txt(label,{x:o.x+4.85,y:yy,w:3.4,h:rh-.03});txt(chartValueLabel(values[i])+'  '+(values[i]/total*100).toFixed(1)+'%',{x:o.x+8.4,y:yy,w:3.2,h:rh-.03});});continue;
      }
      if(sink.html){const fragment=document.createElement('div');fragment.innerHTML=renderChartHTML(c,st,o);fragment.querySelectorAll('.chart-source').forEach(el=>el.remove());sink.parts.push(`<div style="position:absolute;left:${o.x/W*100}%;top:${o.y/H*100}%;width:${o.w/W*100}%;height:${o.h/H*100}%;overflow:hidden">${fragment.innerHTML}</div>`);continue;}
      if(ADVANCED_TYPES.includes(c.type)){
        // Scope dark-style axis contrast to free export only; leave template renderer untouched.
        const target={addTable:(rows,opts)=>sl.addTable(rows,opts),addChart:(type,data,opts)=>sl.addChart(type,data,{...opts,catAxisLabelColor:hx(st.ink),valAxisLabelColor:hx(st.ink),catAxisTitleColor:hx(st.ink),valAxisTitleColor:hx(st.ink),legendColor:hx(st.ink)})};
        addAdvancedNative(target,c,{...o,chartColors:chartDisplayStyle(c,st,c.series.length).palette.map(hx)});continue;
      }
      if(c.type==='content'){addContentFlowPptx(sink,c,o,{surface:st.surface,ink:st.ink,sub:st.sub,accent:st.accent,accent2:st.accent2,font:o.fontFace});continue;}
      const type=safeChartType(c),data=c.series.map(v=>({name:chartUnitName(v),labels:c.labels.slice(),values:v.values.map(pptChartValue)}));
      const props=pptChartStyleProps(c,st,c.series.length),cfg=chartDisplayStyle(c,st,Math.max(c.labels.length,c.series.length));
      props.showValue=cfg.showValues||(c.series.length===1&&c.labels.length<=8);
      if(type==='bar')props.catAxisOrientation='maxMin';
      sink.chart(type==='line'?pptx.ChartType.line:pptx.ChartType.bar,data,{...o,barDir:type==='bar'?'bar':'col',showTitle:false,showBorder:false,showCatName:false,catAxisLabelFontFace:o.fontFace,valAxisLabelFontFace:o.fontFace,dataLabelFontFace:o.fontFace,legendFontFace:o.fontFace,legendColor:hx(st.ink),legendPos:'b',...props});
    }
  }
  return {plan,draw,html(s,st,i,n,editable){const p=plan(s,st,i,n),sink=htmlSink(W,H,editable);draw(p,sink,st);return `<div style="position:absolute;inset:0;background:${st.bg};overflow:hidden">${sink.parts.join('')}</div>`;}};
})();

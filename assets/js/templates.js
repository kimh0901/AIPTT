function xmlDoc(text,label){
  const d=new DOMParser().parseFromString(text,'application/xml');
  if(d.getElementsByTagName('parsererror').length) throw new Error((label||'XML')+' 格式無法解析');
  return d;
}

function partPath(base,target){
  if(!target) return '';
  if(target[0]==='/') return target.slice(1);
  const out=base.split('/').slice(0,-1);
  target.split('/').forEach(p=>{ if(!p||p==='.') return; if(p==='..') out.pop(); else out.push(p); });
  return out.join('/');
}

function relsPath(part){
  const a=part.split('/'), name=a.pop();
  return a.join('/')+'/_rels/'+name+'.rels';
}

async function zipText(zip,path){
  const f=zip.file(path); if(!f) throw new Error('PPTX 缺少 '+path); return f.async('text');
}

function shapeRect(shape){
  const spPr=xmlList(shape,'spPr')[0], xfrm=spPr&&xmlList(spPr,'xfrm')[0];
  const off=xfrm&&xmlList(xfrm,'off')[0], ext=xfrm&&xmlList(xfrm,'ext')[0];
  if(!off||!ext) return null;
  const n=v=>Number(v||0)/914400;
  return {x:n(off.getAttribute('x')),y:n(off.getAttribute('y')),
    w:n(ext.getAttribute('cx')),h:n(ext.getAttribute('cy'))};
}

function phKey(type,idx){ return (type||'body')+'|'+(idx==null?'':idx); }

function placeholdersFrom(doc,masterMap){
  return xmlList(doc,'sp').map(sp=>{
    const ph=xmlList(sp,'ph')[0]; if(!ph) return null;
    const nv=xmlList(sp,'cNvPr')[0], type=ph.getAttribute('type')||'body', idx=ph.getAttribute('idx')||'';
    return {type,idx,name:(nv&&nv.getAttribute('name'))||type,
      rect:shapeRect(sp)||(masterMap&&masterMap[phKey(type,idx)])||null};
  }).filter(Boolean);
}

function layoutRole(placeholders,name){
  const types=placeholders.map(p=>p.type), bodies=placeholders.filter(p=>['body','obj','subTitle','chart','tbl','dgm','pic','media'].includes(p.type));
  const n=String(name||'').toLowerCase().replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim();
  /* 英文標準版面名稱裡的 content（Title and Content、Two Content、Content with Caption）
     是「內容版面」，不是目錄版面；舊版用 /contents?/ 會把它們全判成 agenda，
     導致所有內文頁退到 Section Header，標題被排到內容下方。 */
  const contentNamed=/(^|\s)(title and content|two content|content with caption|content placeholder|content)(\s|$)/.test(n);
  const agendaNamed=/agenda|table of contents|目錄|議程|大綱/.test(n);
  if(/chart|圖表|圖形/.test(n)||types.includes('chart')) return 'chart';
  if(agendaNamed&&!contentNamed) return 'agenda';
  if(/quote|引言|語錄/.test(n)) return 'quote';
  if(/closing|thank|結尾|謝謝|致謝/.test(n)) return 'closing';
  if(/stat|number|數據|數字|kpi/.test(n)) return 'stat';
  if(types.includes('ctrTitle')||(/title slide|封面|標題投影片/.test(n)&&types.includes('subTitle'))) return 'cover';
  /* 章節分隔版面的標題框通常在內容框下方，另立一類，不要當成一般內文版面優先使用 */
  if(/section header|section divider|section|章節|段落|分隔/.test(n)&&!contentNamed) return 'section';
  /* 結構優先於名稱：兩個以上內容框就是雙欄，一個就是內文頁 */
  if(bodies.length>=2) return 'twoCol';
  if(types.includes('title')&&bodies.length) return 'content';
  if(types.includes('title')||types.includes('ctrTitle')) return 'titleOnly';
  return 'blank';
}

function autoTemplateMap(layouts){
  const by=role=>layouts.find(l=>l.role===role), any=layouts[0];
  const named=(re,roles)=>layouts.find(l=>re.test(String(l.name||'').toLowerCase())&&(!roles||roles.includes(l.role)));
  const cover=by('cover')||named(/title slide|封面|標題投影片/,['titleOnly','content','section'])||by('titleOnly')||by('content')||any;
  const content=by('content')||by('section')||by('twoCol')||by('titleOnly')||cover;
  const two=by('twoCol')||named(/two|comparison|比較|雙欄|兩欄/)||content;
  const agenda=by('agenda')||named(/agenda|table of contents|目錄|議程|大綱/)||content;
  const stat=by('stat')||named(/stat|number|數據|數字|kpi/)||content;
  const quote=by('quote')||named(/quote|引言|語錄/)||content;
  const chart=by('chart')||named(/chart|圖表|圖形/)||content;
  const ending=by('closing')||named(/closing|thank|結尾|謝謝|致謝/)||by('titleOnly')||cover;
  return {cover:cover&&cover.path,agenda:agenda&&agenda.path,bullets:content&&content.path,
    twoCol:two&&two.path,stat:stat&&stat.path,quote:quote&&quote.path,
    chart:chart&&chart.path,closing:ending&&ending.path};
}

function themeColor(node){
  const c=node&&Array.from(node.children||[])[0];
  return c ? '#'+(c.getAttribute('lastClr')||c.getAttribute('val')||'000000').replace(/^#/,'') : null;
}

function maxFontSize(el){
  let m=0;
  ['rPr','defRPr','endParaRPr'].forEach(tag=>xmlList(el,tag).forEach(p=>{
    const v=Number(p.getAttribute('sz')||0)/100; if(v>m) m=v;
  }));
  return m;
}

function blankText(el){ xmlList(el,'t').forEach(t=>{ t.textContent=''; }); return el; }

async function parseDesignSlides(zip,slideW,slideH){
  let paths=[];
  try{ paths=(await orderedPptxSlidePaths(zip)).slice(0,60); }catch(e){ return []; }
  const out=[]; let skippedPromotional=0;
  for(let i=0;i<paths.length;i++){
    const path=paths[i];
    let doc; try{ doc=xmlDoc(await zipText(zip,path),path); }catch(e){ continue; }
    const tree=xmlList(doc,'spTree')[0]; if(!tree) continue;
    const rp=relsPath(path), rf=zip.file(rp), media={};
    if(rf){
      try{
        const rd=xmlDoc(await rf.async('text'),rp);
        xmlList(rd,'Relationship').forEach(r=>{
          const target=r.getAttribute('Target')||'';
          if(/media\//.test(target)) media[r.getAttribute('Id')]=partPath(path,target);
        });
      }catch(e){}
    }
    const deco=[], texts=[], preview=[], ser=new XMLSerializer(); let fullSlidePicture=false;
    /* 預覽用：把裝飾形狀的圖片抽成 data URL，畫面才看得到真正的樣板長相 */
    /* 群組內的座標是群組自己的座標系，要換算回投影片座標 */
    const groupMap=g=>{
      const x=xmlList(g,'xfrm')[0]; if(!x) return null;
      const off=xmlList(x,'off')[0], ext=xmlList(x,'ext')[0], co=xmlList(x,'chOff')[0], ce=xmlList(x,'chExt')[0];
      if(!off||!ext||!co||!ce) return null;
      const n=v=>Number(v||0)/914400;
      const gx=n(off.getAttribute('x')), gy=n(off.getAttribute('y')),
            gw=n(ext.getAttribute('cx')), gh=n(ext.getAttribute('cy')),
            cx=n(co.getAttribute('x')), cy=n(co.getAttribute('y')),
            cw=n(ce.getAttribute('cx'))||1, ch=n(ce.getAttribute('cy'))||1;
      return r=>({x:gx+(r.x-cx)*(gw/cw),y:gy+(r.y-cy)*(gh/ch),w:r.w*(gw/cw),h:r.h*(gh/ch)});
    };
    const previewOf=async (el,map)=>{
      if(el.localName==='grpSp'){
        const local=groupMap(el), combined=r=>map?map(local?local(r):r):(local?local(r):r);
        for(const kid of Array.from(el.children||[]))if(['sp','pic','grpSp','cxnSp'].includes(kid.localName))await previewOf(kid,combined);
        return;
      }
      let rect=shapeRect(el); if(!rect||(rect.w<=0&&rect.h<=0)) return;
      if(map) rect=map(rect);
      const blip=xmlList(el,'blip')[0], rid=blip&&blip.getAttribute(R_EMBED_ATTR);
      const part=rid&&media[rid], f=part&&zip.file(part);
      const xfrm=xmlList(el,'xfrm')[0], rot=Number(xfrm&&xfrm.getAttribute('rot')||0)/60000;
      if(f){
        const ext=(part.split('.').pop()||'png').toLowerCase();
        const mime=ext==='svg'?'image/svg+xml':(ext==='jpg'||ext==='jpeg')?'image/jpeg':'image/'+ext;
        try{ const b64=await f.async('base64');
          if(b64.length<4e6) preview.push({...rect,rot,src:'data:'+mime+';base64,'+b64}); }catch(e){}
        return;
      }
      const spPr=Array.from(el.children||[]).find(n=>n.localName==='spPr'), fill=spPr&&Array.from(spPr.children||[]).find(n=>n.localName==='solidFill');
      const srgb=fill&&xmlList(fill,'srgbClr')[0];
      const preset=spPr&&xmlList(spPr,'prstGeom')[0];
      const geometry=spPr&&(xmlList(spPr,'custGeom').length||(preset&&!['rect','line'].includes(preset.getAttribute('prst'))));
      const lineObject=el.localName==='cxnSp'||(preset&&preset.getAttribute('prst')==='line');
      if(lineObject){ rect={...rect,w:Math.max(rect.w,.035),h:Math.max(rect.h,.035)}; }
      if(srgb||geometry||lineObject)preview.push({...rect,rot,fill:srgb?'#'+srgb.getAttribute('val'):null,obstacle:true,lineObject});
    };
    for(const el of Array.from(tree.children||[])){
      const tag=el.localName;
      if(!['sp','pic','grpSp','graphicFrame','cxnSp'].includes(tag)) continue;
      const txt=xmlList(el,'t').map(x=>String(x.textContent||'')).join('').trim();
      if(tag==='pic'){
        const pr=shapeRect(el); if(pr&&pr.w>=slideW*.82&&pr.h>=slideH*.82) fullSlidePicture=true;
      }
      /* 單純的文字框只記位置，不抄內容（否則樣板上的示範文字會被帶進成品）；
         群組與圖片一律當裝飾，只把裡面的文字清空。 */
      if(tag==='sp' && txt){
        const rect=shapeRect(el);
        if(rect&&rect.w>0&&rect.h>0) texts.push({rect,size:maxFontSize(el),len:txt.length});
        continue;
      }
      /* 原生圖表的 graphicFrame 依賴 chart rels 與內嵌 Excel。素材合集裡的範例數字
         不應被當成背景搬進新簡報；真正的圖表由 Slide Forge 用目前資料重建。 */
      if(tag!=='graphicFrame') deco.push(ser.serializeToString(blankText(el.cloneNode(true))));
      if(tag==='grpSp'){
        await previewOf(el,null);
      } else await previewOf(el);
    }
    /* 只留很短的關鍵字提示用來判斷這張樣板頁「本來是拿來做什麼的」，
       不會把樣板上的示範文字帶進成品。 */
    const hint=xmlList(tree,'t').map(x=>String(x.textContent||'')).join(' ').slice(0,500).toLowerCase();
    const nChart=Array.from(tree.children||[]).filter(el=>el.localName==='graphicFrame').length;
    /* 常見下載素材會把 QR Code、店家宣傳或素材網站廣告放在最後一頁。
       這些頁面不能被挑成封面／結尾，也不能出現在匯出成品。 */
    const emptyText=!hint.replace(/\s/g,'');
    const probableEndAd=i===paths.length-1&&paths.length>3&&fullSlidePicture&&emptyText;
    if(probableEndAd||/二维码|二維碼|公众号|公眾號|pptnew|免费赠送|免費贈送|素材网|素材網|扫码|掃碼|关注|關注/.test(hint)){
      skippedPromotional++; continue;
    }
    if(deco.length||texts.length) out.push({index:out.length+1,path,deco,media,texts,preview,hint,nChart,
      fullSlidePicture,complexity:preview.length+texts.length+nChart*4});
  }
  out.skippedPromotional=skippedPromotional;
  return out;
}

function designBoxes(design,W,H){
  W=Number(W)||13.333; H=Number(H)||7.5;
  const boxes=(design&&design.texts||[]).filter(t=>t.rect&&t.rect.w>0.7&&t.rect.h>0.15);
  if(!boxes.length) return null;
  const ranked=boxes.slice().sort((a,b)=>(b.size||0)-(a.size||0)||(b.rect.w*b.rect.h)-(a.rect.w*a.rect.h));
  const title=ranked[0];
  /* 圖示、齒輪、流程節點常有很多極窄文字框，只適合放一兩個字。
     不能把整段條列硬塞進去；只有具備基本寬高的區域才視為內容框。 */
  const bodies=boxes.filter(b=>b!==title&&b.rect.w>=W*.22&&b.rect.h>=H*.10)
    .sort((a,b)=>(b.rect.w*b.rect.h)-(a.rect.w*a.rect.h)).map(b=>b.rect);
  return {title:title.rect,bodies};
}

async function parseChartStyleLibrary(zip,sourceName,themeColors){
  const paths=Object.keys(zip.files).filter(p=>/^ppt\/charts\/chart\d+\.xml$/i.test(p))
    .sort((a,b)=>(Number(a.match(/\d+/g).pop())||0)-(Number(b.match(/\d+/g).pop())||0));
  if(!paths.length) return null;
  const counts={}, all=[], seenAll=new Set(); let best=[];
  const vivid=hex=>{
    const rgb=hexToRgb('#'+hex), hi=Math.max(...rgb),lo=Math.min(...rgb);
    return hi-lo>=34 && hi>65 && lo<235;
  };
  for(const path of paths){
    let doc; try{ doc=xmlDoc(await zipText(zip,path),path); }catch(e){ continue; }
    const types=[['column','barChart'],['line','lineChart'],['doughnut','doughnutChart'],['pie','pieChart'],['scatter','scatterChart'],['area','areaChart']];
    const type=(types.find(x=>xmlList(doc,x[1]).length)||['other'])[0]; counts[type]=(counts[type]||0)+1;
    const local=[];
    xmlList(doc,'srgbClr').forEach(n=>{
      const h=String(n.getAttribute('val')||'').replace(/^#/,'').toUpperCase();
      if(!/^[0-9A-F]{6}$/.test(h)||!vivid(h)) return;
      if(!local.includes('#'+h)) local.push('#'+h);
      if(!seenAll.has(h)){seenAll.add(h);all.push('#'+h);}
    });
    if(local.length>best.length) best=local;
  }
  let palette=(best.length>=3?best:all).slice(0,8);
  if(palette.length<3) palette=[themeColors&&themeColors.accent1,themeColors&&themeColors.accent2,'#D24858','#F87C3E','#FBBA66'].filter(Boolean);
  palette=Array.from(new Set(palette)).slice(0,8);
  return {source:sourceName,chartCount:paths.length,types:counts,palette,
    canvas:'#F2F2F2',ink:'#646464',dark:'#3F3F3F',
    variants:[
      {id:'template-classic',name:'復古暖色',desc:'紫紅至橘黃，保留清楚格線'},
      {id:'template-focus',name:'重點比較',desc:'分類各自著色並顯示數值'},
      {id:'template-dark',name:'深色趨勢',desc:'深灰繪圖區搭配暖色線條'}]};
}

async function parsePptTemplate(file){
  if(!/\.pptx$/i.test(file.name)) throw new Error('請上傳 .pptx 格式的 PowerPoint 版型');
  const JSZip=(await loadLib('jszip')).lib, buffer=await file.arrayBuffer(), zip=await JSZip.loadAsync(buffer);
  const pres=xmlDoc(await zipText(zip,'ppt/presentation.xml'),'presentation.xml');
  const sz=xmlList(pres,'sldSz')[0], width=Number(sz&&sz.getAttribute('cx')||12192000)/914400,
    height=Number(sz&&sz.getAttribute('cy')||6858000)/914400;
  const layoutPaths=Object.keys(zip.files).filter(p=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(p))
    .sort((a,b)=>(Number(a.match(/\d+/g).pop())||0)-(Number(b.match(/\d+/g).pop())||0));
  const masterCache={};
  async function masterInfo(layoutPath){
    const rp=relsPath(layoutPath), rf=zip.file(rp); if(!rf) return {map:{},path:''};
    const rd=xmlDoc(await rf.async('text'),rp), rel=xmlList(rd,'Relationship').find(x=>/slideMaster$/.test(x.getAttribute('Type')||''));
    const mp=rel?partPath(layoutPath,rel.getAttribute('Target')):'';
    if(!mp) return {map:{},path:''};
    if(masterCache[mp]) return masterCache[mp];
    const md=xmlDoc(await zipText(zip,mp),mp), map={};
    placeholdersFrom(md).forEach(p=>{ if(p.rect) map[phKey(p.type,p.idx)]=p.rect; });
    const styleOf=tag=>{
      const box=xmlList(md,tag)[0], d=box&&xmlList(box,'defRPr')[0], srgb=d&&xmlList(d,'srgbClr')[0], scheme=d&&xmlList(d,'schemeClr')[0];
      return {size:Number(d&&d.getAttribute('sz')||0)/100||null,
        colorRef:srgb?('#'+srgb.getAttribute('val')):(scheme&&scheme.getAttribute('val')||'')};
    };
    const cm=xmlList(md,'clrMap')[0], clrMap={};
    if(cm) Array.from(cm.attributes||[]).forEach(a=>clrMap[a.name]=a.value);
    const ts=styleOf('titleStyle'), bs=styleOf('bodyStyle');
    return (masterCache[mp]={map,path:mp,titleSize:ts.size,bodySize:bs.size,
      titleColorRef:ts.colorRef,bodyColorRef:bs.colorRef,clrMap});
  }
  const layouts=[];
  for(const path of layoutPaths){
    const d=xmlDoc(await zipText(zip,path),path), m=await masterInfo(path), c=xmlList(d,'cSld')[0];
    const layoutName=(c&&c.getAttribute('name'))||path.split('/').pop().replace('.xml','');
    const placeholders=placeholdersFrom(d,m.map);
    const tree=xmlList(d,'spTree')[0], decoCount=Array.from((tree&&tree.children)||[]).filter(el=>
      ['sp','pic','grpSp','graphicFrame','cxnSp'].includes(el.localName)&&!xmlList(el,'ph').length).length;
    layouts.push({path,name:layoutName,
      role:layoutRole(placeholders,layoutName),placeholders,masterPath:m.path,titleSize:m.titleSize,bodySize:m.bodySize,
      titleColorRef:m.titleColorRef,bodyColorRef:m.bodyColorRef,clrMap:m.clrMap,decoCount});
  }
  /* 少數第三方工具輸出的 PPTX 沒有標準 layout 關聯。不要整份拒絕，
     先建立安全的自動版面，後續仍可沿用主題色或範例投影片設計。 */
  if(!layouts.length) layouts.push({path:'__auto__',name:'自動安全版面',role:'content',placeholders:[],
    masterPath:'',titleSize:null,bodySize:null,titleColorRef:'',bodyColorRef:'',clrMap:{}});
  const themePath=Object.keys(zip.files).find(p=>/^ppt\/theme\/theme\d+\.xml$/i.test(p));
  let colors={},fonts={};
  if(themePath){
    const td=xmlDoc(await zipText(zip,themePath),themePath), scheme=xmlList(td,'clrScheme')[0];
    Array.from((scheme&&scheme.children)||[]).forEach(n=>{ colors[n.localName]=themeColor(n); });
    const fs=xmlList(td,'fontScheme')[0], major=fs&&xmlList(fs,'majorFont')[0], minor=fs&&xmlList(fs,'minorFont')[0];
    const face=(node,tag)=>{ const el=node&&xmlList(node,tag)[0]; return (el&&el.getAttribute('typeface'))||''; };
    /* 也要讀 <a:ea>（東亞字型）。只讀 <a:latin> 會讓中文被指定成母片的英文字型。 */
    fonts={major:face(major,'latin'),minor:face(minor,'latin'),
      majorEa:face(major,'ea'),minorEa:face(minor,'ea')};
  }
  /* 佔位框是否與投影片尺寸相符。Google Slides／Canva 匯出的 PPTX 常常投影片放大成
     20 英吋，版面配置卻還留著 10 英吋的舊座標；照單全收會讓所有內容擠在左上角。 */
  const reach=layouts.reduce((m,l)=>{
    l.placeholders.forEach(p=>{ if(p.rect){ m.x=Math.max(m.x,p.rect.x+p.rect.w); m.y=Math.max(m.y,p.rect.y+p.rect.h); } });
    return m;
  },{x:0,y:0});
  const placeholderFit = reach.x>0 && reach.x>=width*0.80 && reach.y>=height*0.60;
  if(!placeholderFit) layouts.forEach(l=>l.placeholders.forEach(p=>{ p.rect=null; }));

  /* 母片與版面配置裡有沒有真正的設計（非預留位置的圖形）？沒有的話，
     設計八成畫在投影片上，要改用範例投影片當版型。 */
  let masterDeco=0;
  const countDeco=doc=>xmlList(doc,'spTree').slice(0,1).forEach(tree=>{
    Array.from(tree.children||[]).forEach(el=>{
      if(!['sp','pic','grpSp','graphicFrame'].includes(el.localName)) return;
      if(xmlList(el,'ph').length) return;      // 預留位置不算設計
      masterDeco++;
    });
  });
  for(const path of [layouts[0]&&layouts[0].masterPath,...layoutPaths.slice(0,4)].filter(Boolean)){
    try{ countDeco(xmlDoc(await zipText(zip,path),path)); }catch(e){}
  }
  const designSlides=await parseDesignSlides(zip,width,height);
  const masterList=xmlList(pres,'sldMasterIdLst')[0];
  const canMergeMasters=!!masterList&&layouts.some(l=>l.path!=='__auto__'&&l.masterPath&&zip.file(l.masterPath));
  const designMode = (!canMergeMasters||masterDeco===0) && designSlides.some(d=>d.deco.length);
  const structureMode=canMergeMasters?(designMode?'design':'master'):(designMode?'designFallback':'theme');
  const nativeCharts=Object.keys(zip.files).filter(p=>/^ppt\/charts\/chart\d+\.xml$/i.test(p)).length;
  const embeddedBooks=Object.keys(zip.files).filter(p=>/^ppt\/embeddings\/.*\.(xlsx|xlsm|xlsb)$/i.test(p)).length;
  const chartStyleLibrary=await parseChartStyleLibrary(zip,file.name,colors);
  const chartDensity=nativeCharts/Math.max(1,designSlides.length||1);
  const chartStyleCompatibility=!nativeCharts?'none'
    :(nativeCharts>=4&&chartDensity>=0.35?'recommended'
      :(nativeCharts>=2||(chartStyleLibrary&&chartStyleLibrary.palette&&chartStyleLibrary.palette.length>=3)?'available':'limited'));
  if(chartStyleLibrary) Object.assign(chartStyleLibrary,{compatibility:chartStyleCompatibility,
    slideCount:designSlides.length,chartDensity});

  return {name:file.name,size:file.size,buffer,width,height,layouts,mapping:autoTemplateMap(layouts),
    colors,fonts,placeholderFit,designSlides,designMode,masterDeco,canMergeMasters,structureMode,
    nativeCharts,embeddedBooks,chartStyleLibrary,chartStyleCompatibility,chartDensity,
    skippedPromotional:Number(designSlides.skippedPromotional)||0,
    designMap:designMode?autoDesignMap(designSlides,height):null};
}

function designFeatures(d,n,H){
  H=Number(H)||7.5;
  const boxes=(d.texts||[]).filter(t=>t.rect&&t.rect.w>0.7&&t.rect.h>0.15);
  const maxSize=boxes.reduce((m,b)=>Math.max(m,b.size||0),0);
  const shortBig=boxes.some(b=>(b.size||0)>=40&&(b.len||0)<=12);
  /* 左右兩欄：兩個框上緣接近、左右不重疊，而且各自落在畫面兩側 */
  let twoCol=false;
  for(let i=0;i<boxes.length&&!twoCol;i++) for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i].rect, b=boxes[j].rect;
    const sameRow=Math.abs(a.y-b.y)<Math.max(a.h,b.h)*0.5;
    const apart=(a.x+a.w<=b.x+0.05)||(b.x+b.w<=a.x+0.05);
    const wide=Math.min(a.w,b.w)>0.9;
    if(sameRow&&apart&&wide){ twoCol=true; break; }
  }
  const rows=boxes.filter(b=>b.rect.h<H*0.19).length;
  return {boxes:boxes.length,maxSize,shortBig,twoCol,rows,
    hint:String(d.hint||''),chart:Number(d.nChart||0),first:d.index===1,last:d.index===n};
}

function autoDesignMap(designSlides,height){
  const n=designSlides.length; if(!n) return null;
  const F=designSlides.map(d=>designFeatures(d,n,height));
  const kw=(f,re)=>re.test(f.hint)?1:0;
  const SCORE={
    cover:f=>(f.first?5:0)+(f.boxes<=2?2:0)+(f.maxSize>=32?2:0)+kw(f,/簡報|報告|proposal|presentation/)*1,
    closing:f=>(f.last?5:0)+kw(f,/謝謝|感謝|thank|q&a|結語|結論|the end/)*4+(f.boxes<=2?1:0),
    agenda:f=>kw(f,/目錄|大綱|議程|綱要|agenda|outline|contents|table of/)*6+(f.rows>=3?2:0)+(f.boxes>=3?1:0),
    twoCol:f=>(f.twoCol?5:0)+kw(f,/比較|對照|vs|versus|compare|優缺/)*4,
    stat:f=>(f.shortBig?4:0)+(f.maxSize>=54?3:0)+kw(f,/%|數據|指標|kpi|統計/)*3+(f.boxes<=3?1:0),
    chart:f=>(f.chart>0?6:0)+kw(f,/圖表|趨勢|chart|graph|分析/)*3,
    quote:f=>kw(f,/「|」|“|”|引用|quote|名言/)*5+(f.boxes<=2&&f.maxSize>=28?2:0),
    bullets:f=>(f.rows>=2?3:0)+(f.boxes>=2?2:0)+(f.twoCol?0:1)
  };
  /* bullets 是預設回收桶，最後才決定，讓其他頁型先拿走最像的那幾張 */
  const order=['cover','closing','agenda','chart','twoCol','stat','quote','bullets'];
  const used=new Set(), map={};
  const generic=()=>{
    let best=-99,bi=designSlides[Math.min(1,n-1)].index;
    F.forEach((f,i)=>{ let v=SCORE.bullets(f)-(f.first||f.last?3:0);
      if(used.has(designSlides[i].index)) v-=9;
      if(v>best){ best=v; bi=designSlides[i].index; } });
    return bi;
  };
  order.forEach(type=>{
    let best=-1, pick=null;
    F.forEach((f,i)=>{
      let v=SCORE[type](f);
      if(used.has(designSlides[i].index)) v-=9;          // 盡量不重複，但頁數不夠時仍可共用
      if(type!=='cover'&&f.first) v-=2;                   // 首頁通常是封面
      if(type!=='closing'&&f.last&&n>2) v-=2;             // 末頁通常是結尾
      if(v>best){ best=v; pick=designSlides[i].index; }
    });
    map[type]= best>0?pick:generic();
    if(best>0) used.add(pick);
  });
  return map;
}

function slideContentProfile(slide){
  slide=slide||{};
  const bullets=slide.bullets||[], cols=slide.columns||[], chart=slide.chart||{};
  const texts=[slide.title,slide.subtitle,slide.kicker,
    ...bullets.flatMap(b=>[b.h,b.d]),...cols.flatMap(c=>[c.h,...(c.items||[])]),
    slide.stat&&slide.stat.value,slide.stat&&slide.stat.label,
    slide.quote&&slide.quote.text,...(chart.items||[]).flatMap(x=>[x.label,x.detail]),...(chart.labels||[])].filter(Boolean).map(String);
  return {chars:texts.reduce((n,x)=>n+x.length,0),items:bullets.length+cols.reduce((n,c)=>n+(c.items||[]).length,0)+(chart.items||[]).length,
    longTitle:String(slide.title||'').length>24,twoCol:slide.layout==='twoCol',chart:slide.layout==='chart',stat:slide.layout==='stat'};
}

function designSlideFor(type,slide){
  const t=S.pptTemplate; if(!t) return null;
  if(slide&&slide.templateMode==='master') return null;
  const explicit=(t.designSlides||[]).find(d=>d.index===Number(slide&&slide.designIndex));
  if(explicit) return explicit;
  if(!t.designMode||!t.designMap) return null;
  /* 這一頁若指定過樣板頁，就以指定的為準 */
  const pick=Number(slide&&slide.designIndex)||0;
  if(!pick&&slide){
    const p=slideContentProfile(slide), base=t.designMap[type]||t.designMap.bullets;
    let best=null,bestScore=-1e9;
    (t.designSlides||[]).forEach(d=>{
      const f=designFeatures(d,t.designSlides.length,t.height), boxes=designBoxes(d,t.width,t.height),
        bodyRects=(boxes&&boxes.bodies)||[], bodyArea=bodyRects.reduce((n,r)=>n+r.w*r.h,0),
        maxBodyW=bodyRects.reduce((n,r)=>Math.max(n,r.w),0);
      let score=(d.index===base?18:0)+Math.min(12,bodyArea*1.2)+(p.twoCol&&f.twoCol?18:0)+(p.chart&&f.chart?20:0);
      if(p.items>=5) score+=Math.min(12,f.boxes*2); if(p.longTitle&&f.maxSize>=30) score+=4;
      if((p.items>=2||p.chars>90)&&(bodyArea<t.width*t.height*.075||maxBodyW<t.width*.28)) score-=80;
      if(type!=='cover'&&f.first) score-=8; if(type!=='closing'&&f.last&&t.designSlides.length>2) score-=6;
      if(score>bestScore){bestScore=score;best=d;}
    });
    if(best){
      const safe=designBoxes(best,t.width,t.height), rects=(safe&&safe.bodies)||[];
      const area=rects.reduce((n,r)=>n+r.w*r.h,0), wide=rects.reduce((n,r)=>Math.max(n,r.w),0);
      /* 找不到足以承載目前文字量的留白區，就只沿用主題與安全版面，不硬搬裝飾。 */
      if((p.items>=2||p.chars>90)&&(area<t.width*t.height*.075||wide<t.width*.28)) return null;
      return best;
    }
  }
  const idx=pick||t.designMap[type]||t.designMap.bullets;
  return (t.designSlides||[]).find(d=>d.index===idx)||(t.designSlides||[])[0]||null;
}

function templateLayoutFor(type,slide){
  const t=S.pptTemplate; if(!t) return null;
  const path=(slide&&slide.templateLayoutPath)||t.mapping[type]||t.mapping.bullets;
  const base=t.layouts.find(l=>l.path===path)||t.layouts[0]||null;
  if(slide&&slide.templateLayoutPath) return base;
  if(slide&&(slide.templatePlainLayoutFor===t.name||slide.templateAutoSafeFor===t.name)){
    const sameMaster=(t.layouts||[]).filter(l=>!base||!base.masterPath||l.masterPath===base.masterPath);
    const pool=sameMaster.length?sameMaster:(t.layouts||[]);
    const ranked=pool.slice().sort((a,b)=>{
      const rolePenalty=l=>['blank','content','titleOnly'].includes(l.role)?0:l.role===type?1:4;
      return (Number(a.decoCount)||0)*20+rolePenalty(a)-(Number(b.decoCount)||0)*20-rolePenalty(b);
    });
    if(ranked[0]) return ranked[0];
  }
  if(!slide||!t.placeholderFit) return base;
  const p=slideContentProfile(slide);
  let best=base,bestScore=-1e9;
  t.layouts.forEach(l=>{
    const bodies=(l.placeholders||[]).filter(x=>['body','obj','chart','tbl','dgm','pic','media','subTitle'].includes(x.type)&&x.rect);
    const area=bodies.reduce((n,x)=>n+x.rect.w*x.rect.h,0), titleBox=(l.placeholders||[]).find(x=>['title','ctrTitle'].includes(x.type)&&x.rect);
    let score=(l===base?20:0)+(l.role===type?18:0)+Math.min(18,area*1.5);
    if(p.twoCol) score+=(bodies.length>=2?24:-18); else if(bodies.length===1) score+=6;
    if(p.chart) score+=(l.role==='chart'?20:0)+Math.min(10,area);
    if(p.items>=5||p.chars>180) score+=Math.min(15,area*1.8);
    if(p.longTitle&&titleBox) score+=Math.min(8,titleBox.rect.w*titleBox.rect.h*3);
    if(['section','blank'].includes(l.role)&&!['cover','closing'].includes(type)) score-=16;
    if(score>bestScore){bestScore=score;best=l;}
  });
  return best||base;
}

function idbTemplate(op,val){
  return new Promise(ok=>{
    if(!window.indexedDB) return ok(null);
    let rq; try{ rq=indexedDB.open('sf-tpl',1); }catch(e){ return ok(null); }
    rq.onupgradeneeded=()=>{ const db=rq.result; if(!db.objectStoreNames.contains('files')) db.createObjectStore('files'); };
    rq.onerror=()=>ok(null);
    rq.onsuccess=()=>{
      const db=rq.result; let tx,st;
      try{ tx=db.transaction('files',op==='get'?'readonly':'readwrite'); st=tx.objectStore('files'); }
      catch(e){ db.close(); return ok(null); }
      let out=null;
      if(op==='get'){ const r=st.get('template'); r.onsuccess=()=>{ out=r.result||null; }; }
      else if(op==='put') st.put(val,'template');
      else if(op==='del') st.delete('template');
      tx.oncomplete=()=>{ db.close(); ok(out); };
      tx.onerror=()=>{ db.close(); ok(null); };
    };
  });
}

async function restoreTemplate(){
  try{
    const rec=await idbTemplate('get');
    if(!rec||!rec.buffer||S.pptTemplate) return;
    const file=new File([rec.buffer],rec.name||'template.pptx',
      {type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
    S.pptTemplate=await parsePptTemplate(file);
    if(S.templatePrefs&&S.templatePrefs.name===S.pptTemplate.name)
      S.pptTemplate.mapping=Object.assign({},S.pptTemplate.mapping,S.templatePrefs.mapping||{});
    S.tplPreview=true;
    render();
  }catch(e){ /* 還原失敗就當作沒有母片，使用者可重新上傳 */ }
}

async function uploadPptTemplate(file){
  toast('讀取 PowerPoint 母片');
  try{
    S.pptTemplate=await parsePptTemplate(file); S.templatePrefs={name:S.pptTemplate.name,mapping:S.pptTemplate.mapping}; S.tplPreview=true;
    if(S.view==='editor') S.tab='style';
    saveDraft();
    try{ await idbTemplate('put',{name:file.name,buffer:await file.arrayBuffer()}); }catch(e){}
    const mode=S.pptTemplate.structureMode;
    toast(mode==='theme'
      ? 'PPTX 已讀取；缺少標準母片結構，已切換成主題配色安全模式'
      : mode==='designFallback'
        ? 'PPTX 已讀取；已從範例投影片重建版面並自動開啟預覽'
        : S.pptTemplate.placeholderFit===false
          ? '母片已讀取；座標不一致，已改用安全版面並自動開啟預覽'
          : '母片已讀取，已自動開啟套版預覽，可逐頁微調。圖表風格不會自動變更');
    setTimeout(()=>done(),2600); render();
  }
  catch(e){ fail(e.message||'PPTX 母片讀取失敗'); }
}

function applyChartStyleToSlides(styleId,rerender=true){
  S.chartStyleDefault=styleId||'auto';
  (S.slides||[]).forEach(s=>{ if(s&&s.layout==='chart'&&s.chart&&s.chart.type!=='content') s.chart.styleId=S.chartStyleDefault; });
  saveDraft(); if(rerender) render();
}

function activateTemplateChartStyle(){
  const lib=S.pptTemplate&&S.pptTemplate.chartStyleLibrary;
  if(!lib||!lib.chartCount) return fail('這份母片沒有可辨識的原生圖表風格');
  S.chartStyleLibrary=lib;
  applyChartStyleToSlides('template-classic',false);
  S.tab='chart'; saveDraft(); render();
  toast(`已另外啟用 ${lib.chartCount} 個圖表樣本的風格；母片套版設定保持不變`); setTimeout(()=>done(),2200);
}

async function uploadChartStylePpt(file){
  toast('分析 PowerPoint 圖表風格');
  try{
    const parsed=await parsePptTemplate(file), lib=parsed.chartStyleLibrary;
    if(!lib||!lib.chartCount) throw new Error('這份 PPTX 沒有可辨識的原生圖表；請改上傳含可編輯圖表的 .pptx。');
    S.chartStyleLibrary=lib; applyChartStyleToSlides('template-classic',false); saveDraft(); render();
    const note=lib.compatibility==='recommended'?'適合當圖表風格庫'
      :(lib.compatibility==='available'?'可套用，圖表樣本較少':'可套用，但只能擷取有限的色彩特徵');
    toast(`已擷取 ${lib.chartCount} 個圖表的風格（${note}），現有與新生成圖表會自動套用`); setTimeout(()=>done(),2600);
  }catch(e){ fail(e.message||'圖表風格讀取失敗'); }
}

function pickFile(accept,cb){
  const i=document.createElement('input'); i.type='file'; i.accept=accept;
  i.style.position='fixed'; i.style.left='-9999px'; i.setAttribute('aria-hidden','true');
  document.body.appendChild(i);
  i.onchange=()=>{ const f=i.files&&i.files[0]; if(f) cb(f); i.remove(); };
  i.addEventListener('cancel',()=>i.remove(),{once:true});
  i.click();
}

function pickFiles(accept,cb){
  const i=document.createElement('input'); i.type='file'; i.accept=accept; i.multiple=true;
  i.style.position='fixed'; i.style.left='-9999px'; i.setAttribute('aria-hidden','true');
  document.body.appendChild(i);
  i.onchange=()=>{ const files=Array.from(i.files||[]); if(files.length) cb(files); i.remove(); };
  i.addEventListener('cancel',()=>i.remove(),{once:true});
  i.click();
}

function pickFolderFiles(accept,cb){
  const allowed=new Set(String(accept||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean));
  const i=document.createElement('input'); i.type='file'; i.multiple=true;
  i.setAttribute('webkitdirectory',''); i.setAttribute('directory','');
  i.style.position='fixed'; i.style.left='-9999px'; i.setAttribute('aria-hidden','true');
  document.body.appendChild(i);
  i.onchange=()=>{
    const files=Array.from(i.files||[]).filter(f=>{
      const m=String(f.name||'').toLowerCase().match(/\.[^.]+$/);return m&&allowed.has(m[0]);
    });
    if(files.length) cb(files); else if((i.files||[]).length) fail('資料夾裡沒有網站可讀取的 Word、PDF、PPTX、Excel、CSV 或文字檔。');
    i.remove();
  };
  i.addEventListener('cancel',()=>i.remove(),{once:true});
  i.click();
}

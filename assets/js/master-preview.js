/* Browser-only inherited artwork. Original PPTX export and geometry are unchanged. */
async function inheritedTemplateArtwork(t){
  const Zip=(await loadLib('jszip')).lib,zip=await Zip.loadAsync(t.buffer),cache={};
  const child=(n,k)=>Array.from(n?.children||[]).find(x=>x.localName===k);
  const color=(n,map)=>{const c=n&&Array.from(n.children||[]).find(x=>['srgbClr','schemeClr','sysClr'].includes(x.localName));if(!c)return '';
    const v=c.getAttribute('val');return c.localName==='schemeClr'?(t.colors[map[v]||v]||''):'#'+(c.getAttribute('lastClr')||v);};
  async function part(path,map){
    if(cache[path])return cache[path];
    const doc=xmlDoc(await zipText(zip,path),path),rels={};
    if(zip.file(relsPath(path)))xmlList(xmlDoc(await zipText(zip,relsPath(path)),path),'Relationship').forEach(r=>{if(r.getAttribute('TargetMode')!=='External')rels[r.getAttribute('Id')]=partPath(path,r.getAttribute('Target'));});
    const tree=xmlList(doc,'spTree')[0],parts=[],warnings=[];
    const rectCss=r=>`position:absolute;left:${r.x/t.width*100}%;top:${r.y/t.height*100}%;width:${r.w/t.width*100}%;height:${r.h/t.height*100}%;`;
    async function draw(el,transform=r=>r){
      if(el.localName==='grpSp'){
        const x=child(child(el,'grpSpPr'),'xfrm'),off=child(x,'off'),ext=child(x,'ext'),co=child(x,'chOff'),ce=child(x,'chExt');
        const n=(e,k)=>Number(e?.getAttribute(k)||0)/914400;
        const sx=n(ext,'cx')/(n(ce,'cx')||1),sy=n(ext,'cy')/(n(ce,'cy')||1);
        for(const e of Array.from(el.children||[]))await draw(e,r=>transform({x:n(off,'x')+(r.x-n(co,'x'))*sx,y:n(off,'y')+(r.y-n(co,'y'))*sy,w:r.w*sx,h:r.h*sy}));return;
      }
      if(!['sp','pic','cxnSp'].includes(el.localName)||xmlList(el,'ph').length)return;
      const raw=shapeRect(el);if(!raw)return;const r=transform(raw),sp=child(el,'spPr'),x=child(sp,'xfrm');
      const rot=Number(x?.getAttribute('rot')||0)/60000;
      const css=rectCss(r)+`transform:rotate(${rot}deg) scale(${x?.getAttribute('flipH')==='1'?-1:1},${x?.getAttribute('flipV')==='1'?-1:1});`;
      const blip=xmlList(el,'blip')[0];
      if(blip){
        const target=rels[blip.getAttributeNS(PPTX_NS.r,'embed')||blip.getAttribute('r:embed')],f=target&&zip.file(target);
        if(!f)return;const ext=target.split('.').pop().toLowerCase();
        let src;
        if(ext==='wmf'){
          const bytes=await f.async('uint8array'),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
          /* 原檔 WMF 的相容 PNG，按內容雜湊核對，絕不依檔名套用到別的標誌。 */
          if(hash==='629593d39f20b5b88d26a6c8913b425e56ea92cdc7344676decab0f27dee7ef4')src='assets/template-preview/'+hash+'.png';
        }else if(['png','jpg','jpeg','gif','svg','webp'].includes(ext))src='data:image/'+(ext==='jpg'?'jpeg':ext==='svg'?'svg+xml':ext)+';base64,'+await f.async('base64');
        if(!src){warnings.push('圖片格式 '+ext+' 無法由瀏覽器顯示');return;}
        const crop=xmlList(el,'srcRect')[0],v=k=>Number(crop?.getAttribute(k)||0)/100000;
        const cw=Math.max(.01,1-v('l')-v('r')),ch=Math.max(.01,1-v('t')-v('b'));
        parts.push(`<div style="${css}overflow:hidden"><img alt="" src="${src}" style="position:absolute;max-width:none;left:${-v('l')/cw*100}%;top:${-v('t')/ch*100}%;width:${100/cw}%;height:${100/ch}%"></div>`);return;
      }
      const fill=color(child(sp,'solidFill'),map),geom=child(sp,'prstGeom')?.getAttribute('prst');
      if(fill&&(!geom||['rect','roundRect','ellipse'].includes(geom)))parts.push(`<div style="${css}background:${esc(fill)};${geom==='ellipse'?'border-radius:50%':geom==='roundRect'?'border-radius:12px':''}"></div>`);
      else if(child(sp,'custGeom'))warnings.push('自訂向量形狀尚未完整預覽');
      const body=child(el,'txBody');
      if(body&&xmlList(body,'t').some(n=>n.textContent.trim())){
        const bp=child(body,'bodyPr'),text=xmlList(body,'p').map(p=>{
          const def=child(child(p,'pPr'),'defRPr');
          return Array.from(p.children||[]).filter(n=>['r','fld','br'].includes(n.localName)).map(run=>{
            if(run.localName==='br')return '<br>';
            const pr=child(run,'rPr')||def,sz=Number(pr?.getAttribute('sz')||1000)/100;
            const ink=color(child(pr,'solidFill'),map)||t.colors.dk1||'#222';
            return `<span style="font-size:${sz*1280/(t.width*72)}px;color:${esc(ink)};font-weight:${pr?.getAttribute('b')==='1'?700:400}">${esc(xmlList(run,'t').map(n=>n.textContent).join(''))}</span>`;
          }).join('');
        }).join('<br>');
        const inset=(k,f)=>Number(bp?.getAttribute(k)??f)/914400*1280/t.width;
        parts.push(`<div style="${css}box-sizing:border-box;padding:${inset('tIns',45720)}px ${inset('rIns',91440)}px ${inset('bIns',45720)}px ${inset('lIns',91440)}px;line-height:1.15;font-family:Arial,'Microsoft JhengHei',sans-serif;white-space:pre-wrap;overflow:hidden">${text}</div>`);
      }
    }
    for(const el of Array.from(tree?.children||[]))await draw(el);
    return cache[path]={html:parts.join(''),warnings,showMaster:doc.documentElement.getAttribute('showMasterSp')!=='0'};
  }
  const results={};
  for(const layout of t.layouts){
    if(!zip.file(layout.path))continue;
    const map={bg1:'lt1',tx1:'dk1',bg2:'lt2',tx2:'dk2',...layout.clrMap};
    const own=await part(layout.path,map),master=layout.masterPath?await part(layout.masterPath,map):{html:'',warnings:[]};
    results[layout.path]={html:(own.showMaster?master.html:'')+own.html,warnings:[...(own.showMaster?master.warnings:[]),...own.warnings]};
  }
  return results;
}
const parseBeforeMasterPreview=parsePptTemplate;
parsePptTemplate=async function(file){
  const t=await parseBeforeMasterPreview(file);
  try{t.inheritedArtwork=await inheritedTemplateArtwork(t);}catch(e){t.inheritedArtworkError=e.message;}
  return t;
};
const renderBeforeMasterPreview=renderTemplateSlide;
renderTemplateSlide=function(s,st,idx,total,editable){
  const html=renderBeforeMasterPreview(s,st,idx,total,editable);
  if(!html||!S.pptTemplate?.canMergeMasters)return html;
  if(S.pptTemplate?.inheritedArtworkError)return html+`<div role="status" style="position:absolute;bottom:0;background:#fff3cd;color:#422;padding:4px 8px;font-size:14px">母片背景預覽尚未完成，請重新上傳模板。</div>`;
  if(!S.pptTemplate?.inheritedArtwork)return html;
  const layout=templateLayoutFor(s.layout,s),art=S.pptTemplate.inheritedArtwork[layout?.path];
  if(!art)return html;
  const end=html.indexOf('>')+1;
  const warning=art.warnings.length?`<div role="status" style="position:absolute;bottom:0;background:#fff3cd;color:#422;padding:4px 8px;font-size:14px">部分母片元素無法預覽：${esc([...new Set(art.warnings)].join('；'))}。請核對匯出檔。</div>`:'';
  return html.slice(0,end)+`<div data-inherited-master="1" aria-hidden="true" style="position:absolute;inset:0;pointer-events:none">${art.html}</div>`+html.slice(end)+warning;
};

function pptxNodeText(node){
  return xmlList(node,'t').map(x=>String(x.textContent||'').trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
}

function pptxNotesText(doc){
  const copy=doc.cloneNode(true);
  xmlList(copy,'sp').forEach(sp=>{
    const ph=xmlList(sp,'ph')[0], type=ph&&ph.getAttribute('type');
    if(['sldNum','dt','hdr','ftr'].includes(type)) sp.remove();
  });
  return pptxNodeText(copy);
}

async function orderedPptxSlidePaths(zip){
  try{
    const presPath='ppt/presentation.xml', relPath='ppt/_rels/presentation.xml.rels';
    if(!zip.file(presPath)||!zip.file(relPath)) throw new Error('no presentation order');
    const pres=xmlDoc(await zipText(zip,presPath),presPath), rels=xmlDoc(await zipText(zip,relPath),relPath), map={};
    xmlList(rels,'Relationship').filter(x=>/\/slide$/.test(x.getAttribute('Type')||''))
      .forEach(x=>map[x.getAttribute('Id')]=partPath(presPath,x.getAttribute('Target')));
    const paths=xmlList(pres,'sldId').map(x=>map[x.getAttributeNS(PPTX_NS.r,'id')||x.getAttribute('r:id')]).filter(p=>p&&zip.file(p));
    if(paths.length) return paths;
  }catch(e){}
  return Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a,b)=>(Number(a.match(/slide(\d+)/i)[1])||0)-(Number(b.match(/slide(\d+)/i)[1])||0));
}

async function parsePptxMaterial(file){
  const JSZip=(await loadLib('jszip')).lib, zip=await JSZip.loadAsync(await file.arrayBuffer());
  const allSlidePaths=await orderedPptxSlidePaths(zip), slidePaths=allSlidePaths.slice(0,80);
  if(!slidePaths.length) throw new Error('這份 PPTX 沒有可讀取的投影片內容。若它是空白版型，請改用「完整母片」上傳。');
  const segments=[], tables=[];
  for(let i=0;i<slidePaths.length;i++){
    const path=slidePaths[i], page=i+1;
    const doc=xmlDoc(await zipText(zip,path),path), visible=pptxNodeText(doc);
    let notes='';
    const relFile=zip.file(relsPath(path));
    if(relFile){
      const relDoc=xmlDoc(await relFile.async('text'),relsPath(path));
      const rel=xmlList(relDoc,'Relationship').find(x=>/\/notesSlide$/.test(x.getAttribute('Type')||''));
      const notesPath=rel&&partPath(path,rel.getAttribute('Target'));
      if(notesPath&&zip.file(notesPath)) notes=pptxNotesText(xmlDoc(await zipText(zip,notesPath),notesPath));
    }
    xmlList(doc,'tbl').forEach((tbl,ti)=>{
      const rows=xmlList(tbl,'tr').map(tr=>xmlList(tr,'tc').map(tc=>pptxNodeText(tc)));
      const table=tableRecord(`${file.name} / 投影片 ${page} / 表格 ${ti+1}`,rows);
      if(table.headers.length&&table.rows.length) tables.push(table);
    });
    if(visible||notes){
      const text=[visible,notes&&notes!==visible?`講稿：${notes}`:''].filter(Boolean).join('\n');
      segments.push({page,text:text.slice(0,5000)});
    }
  }
  if(!segments.length) throw new Error('這份 PPTX 只有圖片或空白版型，沒有可解析的文字。可改存成有文字層的 PPTX／PDF，或把它當完整母片使用。');
  const text=segments.map(s=>`【來源：${file.name}｜投影片 ${s.page}】\n${s.text}`).join('\n\n').slice(0,80000);
  return {text,tables,segments,meta:{kind:'pptx',pages:allSlidePaths.length,truncated:allSlidePaths.length>slidePaths.length}};
}

function friendlyFileError(err){
  const msg=String(err&&err.message||err||'讀取失敗');
  if(/end of central directory|not a zip|encrypted|password/i.test(msg)) return '檔案可能已損壞、不是正確的 Office 格式，或設有開啟密碼。';
  if(/invalid pdf|pdf.*password|password.*pdf/i.test(msg)) return 'PDF 可能已損壞或設有開啟密碼。';
  if(/out of memory|allocation failed/i.test(msg)) return '檔案過大，瀏覽器記憶體不足。請先縮小檔案後再上傳。';
  return msg;
}

async function decodeTextFile(file){
  const buf=await file.arrayBuffer();
  try{ return {text:new TextDecoder('utf-8',{fatal:true}).decode(buf).replace(/^\uFEFF/,''),encoding:'UTF-8'}; }
  catch(e){
    try{ return {text:new TextDecoder('big5',{fatal:true}).decode(buf).replace(/^\uFEFF/,''),encoding:'Big5'}; }
    catch(e2){ throw new Error('文字檔不是有效的 UTF-8 或 Big5 編碼，請另存為 UTF-8 後再試。'); }
  }
}

async function parseUpload(file){
  const name=file.name, ext=(name.split('.').pop()||'').toLowerCase();
  if(Number(file.size)>MAX_FILE_BYTES) throw new Error(`單一檔案上限為 ${Math.round(MAX_FILE_BYTES/1024/1024)} MB，請先縮小或拆分檔案。`);

  if(['txt','md','markdown','csv','tsv'].includes(ext)){
    const decoded=await decodeTextFile(file), raw=decoded.text;
    if(ext==='csv'||ext==='tsv'){
      const table=tableRecord(name,csvRows(raw,ext==='tsv'?'\t':','));
      return {text:tableDigest(table.title,[table.headers].concat(table.rows),table),tables:[table],meta:{encoding:decoded.encoding}};
    }
    return {text:raw,tables:[],meta:{encoding:decoded.encoding}};
  }

  if(ext==='docx'){
    const mammoth=(await loadLib('mammoth')).lib;
    const r=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()}), doc=new DOMParser().parseFromString(r.value,'text/html');
    const tables=Array.from(doc.querySelectorAll('table')).map((tbl,i)=>{
      const rows=Array.from(tbl.querySelectorAll('tr')).map(tr=>Array.from(tr.querySelectorAll('th,td')).map(c=>c.textContent.trim()));
      return tableRecord(`${name} / 表格 ${i+1}`,rows);
    }).filter(t=>t.headers.length&&t.rows.length);
    const blocks=Array.from(doc.body.querySelectorAll('h1,h2,h3,h4,p,li')).map(n=>n.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
    const text=[blocks.join('\n'),...tables.map(t=>tableDigest(t.title,[t.headers].concat(t.rows),t))].filter(Boolean).join('\n\n');
    return {text:text.trim(),tables};
  }

  if(ext==='doc') throw new Error('舊版 .doc 無法在瀏覽器可靠解析，請先用 Word 另存為 .docx 或 PDF。');

  if(ext==='pptx') return parsePptxMaterial(file);

  if(ext==='ppt') throw new Error('舊版 .ppt 無法在瀏覽器可靠解析，請先用 PowerPoint 另存為 .pptx；若它是版型，也需要轉成 .pptx。');

  if(ext==='pdf'){
    const pdfjs=await loadPdfjs();
    const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    const pages=Math.min(doc.numPages,40); const out=[];
    for(let i=1;i<=pages;i++){
      const c=await (await doc.getPage(i)).getTextContent();
      out.push(c.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim());
    }
    const text=out.filter(Boolean).join('\n\n');
    if(!text.trim()) throw new Error('這份 PDF 讀不到文字，可能是掃描檔或圖片檔。請改用可選取文字的 PDF，或直接把內容貼進框裡。');
    return {text:text + (doc.numPages>pages?`\n\n（原檔共 ${doc.numPages} 頁，只讀取前 ${pages} 頁）`:''),tables:[]};
  }

  if(ext==='xlsx'||ext==='xls'){
    const XLSX=(await loadLib('xlsx')).lib;
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true}), selected=wb.SheetNames.slice(0,10);
    const tables=selected.map(sn=>{
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,blankrows:false,raw:false,defval:''});
      return tableRecord(`${name} / 工作表：${sn}`,rows);
    }).filter(t=>t.headers.length);
    const omitted=wb.SheetNames.length-selected.length;
    return {text:tables.map(t=>tableDigest(t.title,[t.headers].concat(t.rows),t)).join('\n\n')+
      (omitted>0?`\n\n（原檔另有 ${omitted} 個工作表未載入；一次最多讀取前 10 個。）`:''),tables,
      meta:{sheets:wb.SheetNames.length,omittedSheets:omitted}};
  }

  throw new Error(`還不支援 .${ext} 這種檔案。可以先另存成 PDF、Word、Excel 或純文字，或直接把內容貼進框裡。`);
}

function csvRows(raw, sep){
  const rows=[], row=[]; let cell='', quoted=false;
  raw=String(raw||'');
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(quoted){
      if(ch==='"'&&raw[i+1]==='"'){ cell+='"'; i++; }
      else if(ch==='"') quoted=false;
      else cell+=ch;
    }else if(ch==='"'&&cell==='') quoted=true;
    else if(ch===sep){ row.push(cell.trim()); cell=''; }
    else if(ch==='\n'||ch==='\r'){
      if(ch==='\r'&&raw[i+1]==='\n') i++;
      row.push(cell.trim()); cell='';
      if(row.some(v=>v!=='')) rows.push(row.splice(0)); else row.length=0;
    }else cell+=ch;
  }
  row.push(cell.trim()); if(row.some(v=>v!=='')) rows.push(row);
  return rows;
}

function tableRecord(title,rows){
  rows=(rows||[]).filter(r=>r && r.some(c=>String(c).trim()!==''));
  if(!rows.length) return {id:uid(),title,headers:[],rows:[],totalRows:0,truncated:false};
  const headers=rows[0].map((c,i)=>String(c).trim()||('欄位 '+(i+1)));
  const totalRows=Math.max(0,rows.length-1), truncated=totalRows>MAX_TABLE_ROWS;
  const body=rows.slice(1,MAX_TABLE_ROWS+1).map(r=>headers.map((_,i)=>String(r[i]==null?'':r[i]).trim()));
  return {id:uid(),title,headers,rows:body,totalRows,truncated};
}

function ensureBriefTables(){
  if((S.tables||[]).some(t=>numericColumns(t).length)) return;
  const lines=manualBrief().replace(/\r/g,'').split('\n'), groups=[]; let cur=[];
  const flush=()=>{ if(cur.length>=3) groups.push(cur); cur=[]; };
  lines.forEach(line=>{ if((line.match(/\|/g)||[]).length>=2) cur.push(line); else flush(); }); flush();
  groups.forEach((group,gi)=>{
    const rows=group.map(line=>line.split('|').map(x=>x.trim()).filter((_,i,a)=>!(i===0&&a[i]==='')&&!(i===a.length-1&&a[i]==='')))
      .filter((row,i)=>!(i===1&&row.every(cell=>/^:?-{2,}:?$/.test(cell))));
    const table=tableRecord('貼上素材 / 資料表 '+(gi+1),rows); table.origin='brief';
    if(numericColumns(table).length) S.tables.push(table);
  });
  if(groups.length) saveDraft();
}

function tableDigest(title, rows, meta){
  rows=(rows||[]).filter(r=>r && r.some(c=>String(c).trim()!==''));
  if(!rows.length) return `【${title}】（空白表格）`;
  const head=rows[0].map(c=>String(c).trim());
  const body=rows.slice(1).map(r=>head.map((_,i)=>String(r[i]==null?'':r[i]).trim())),
    summaryRe=/(總計|合計|小計|total|subtotal)/i, dataRows=body.filter(r=>!summaryRe.test(String(r[0]||''))),
    totalRows=Number(meta&&meta.totalRows)||body.length, truncated=!!(meta&&meta.truncated);
  const stats=[];
  head.forEach((h,ci)=>{
    if(ci===0) return;
    const parsed=dataRows.map(r=>({k:r[0],p:chartValue(r[ci])})).filter(x=>x.p!==null), vals=parsed.map(x=>x.p.value);
    if(vals.length < Math.max(3, dataRows.length*0.6)) return;
    const sum=vals.reduce((a,b)=>a+b,0), pairs=parsed.map(x=>({k:x.k,v:x.p.value})).sort((a,b)=>b.v-a.v);
    const fmt=n=>Number.isInteger(n)?n.toLocaleString():n.toFixed(2), percent=/%|％|率|百分比/.test(h)||parsed.some(x=>x.p.unit==='%');
    stats.push(`- ${h}：${(!percent&&!truncated)?`合計 ${fmt(sum)}｜`:''}平均 ${fmt(sum/vals.length)}${percent?'%':''}｜`+
      `最高 ${pairs[0].k} ${fmt(pairs[0].v)}${percent?'%':''}｜最低 ${pairs[pairs.length-1].k} ${fmt(pairs[pairs.length-1].v)}${percent?'%':''}\n`+
      `  前三名：${pairs.slice(0,3).map(p=>`${p.k} ${fmt(p.v)}${percent?'%':''}`).join('、')}`);
  });

  const table=[head.join(' | ')].concat(body.slice(0,60).map(r=>r.join(' | '))).join('\n');
  return `【${title}】${truncated?`原檔共 ${totalRows} 列，僅載入前 ${body.length} 列；不計算合計`:`共 ${body.length} 列資料`}\n\n${table}`
    + (body.length>60?`\n（僅列出前 60 列）`:'')
    + (stats.length?`\n\n※ 以下統計已由系統依可用資料計算：\n${stats.join('\n')}`:'');
}

async function handleUpload(file, done2){
  return handleUploads(file?[file]:[],done2);
}

async function handleUploads(files,done2){
  const list=Array.from(files||[]); if(!list.length) return;
  const errors=[]; let added=0, totalBytes=(S.uploads||[]).reduce((n,u)=>n+(Number(u.size)||0),0);
  for(let i=0;i<list.length;i++){
    const file=list[i]; toast(`讀取 ${i+1}/${list.length}：${file.name}`);
    try{
      if(Number(file.size||0)<=0) throw new Error('檔案是空白的，未加入素材。');
      if(totalBytes+Number(file.size||0)>MAX_TOTAL_UPLOAD_BYTES) throw new Error('本次來源檔案總量超過 80 MB，請分批處理或移除不需要的檔案。');
      const parsed=await parseUpload(file), text=String(parsed.text||'').trim(), id=uid();
      if(!text&&!(parsed.tables||[]).some(t=>(t.headers||[]).length&&(t.rows||[]).length)) throw new Error('檔案中沒有可使用的文字或表格，未加入素材。');
      const year=sourceYear(file.name), pages=parsed.meta&&parsed.meta.pages;
      const blockHeader=`【來源檔案：${file.name}${year?`｜年份 ${year}`:''}${pages?`｜${pages} 頁`:''}】`;
      S.tables=(S.tables||[]).concat(parsed.tables||[]);
      S.uploads=(S.uploads||[]).concat([{id,name:file.name,len:text.length,text,blockHeader,enabled:true,year,size:Number(file.size)||0,
        encoding:parsed.meta&&parsed.meta.encoding||'',truncated:!!(parsed.meta&&parsed.meta.truncated)||!!((parsed.tables||[]).some(t=>t.truncated)),
        kind:(parsed.meta&&parsed.meta.kind)||((file.name.split('.').pop()||'').toLowerCase()),pages:pages||null,
        segments:parsed.segments||[],tableIds:(parsed.tables||[]).map(t=>t.id)}]);
      totalBytes+=Number(file.size)||0; added++;
    }catch(e){ errors.push(`${file.name}：${friendlyFileError(e)}`); }
  }
  saveDraft();
  /* 失敗原因要留下來，否則提示訊息一關掉，畫面上就只剩「沒有素材」，看不出是解析失敗 */
  S.lastUploadError = errors.length ? errors.join('；') : null;
  if(added&&done2) done2();
  if(errors.length) fail((added?`已讀取 ${added} 份；`:'')+errors.join('；'));
  else done();
}

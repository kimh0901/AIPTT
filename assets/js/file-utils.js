function download(name,content,type){
  const b=new Blob([content],{type:type||'text/plain;charset=utf-8'}), u=URL.createObjectURL(b);
  const a=document.createElement('a'); a.href=u; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(u),2000);
}

function loadOne(src, globalName){
  return new Promise((ok,no)=>{
    const el=document.createElement('script');
    el.src=src; el.async=true;
    const timer=setTimeout(()=>{ el.remove(); no(new Error('逾時')); }, 15000);
    el.onload=()=>{ clearTimeout(timer);
      window[globalName]?ok(src):no(new Error('載入後找不到 '+globalName)); };
    el.onerror=()=>{ clearTimeout(timer); el.remove(); no(new Error('連不到')); };
    document.head.appendChild(el);
  });
}

async function loadLib(key){
  const def=LIBS[key];
  if(libCache[key]) return libCache[key];
  if(window[def.global]) return (libCache[key]={lib:window[def.global], url:def.urls[0]});
  const tried=[];
  for(const u of def.urls){
    try{
      const url=await loadOne(u, def.global);
      return (libCache[key]={lib:window[def.global], url});
    }catch(e){ tried.push(/^\.\//.test(u)?'本機 lib 資料夾':u.replace(/^https:\/\//,'').split('/')[0]); }
  }
  const err=new Error(`載入 ${def.file} 失敗，已試過：${tried.join('、')}。`+
    `如果貴單位網路擋外連，請把 ${def.file} 下載後放到與本頁面同一層的 lib 資料夾（./lib/${def.file}），重新整理即可離線使用。`);
  err.lib=key; throw err;
}

async function loadScript(src, globalName){
  const key=Object.keys(LIBS).find(k=>LIBS[k].global===globalName);
  if(key) return (await loadLib(key)).lib;
  return loadOne(src,globalName).then(()=>window[globalName]);
}

async function loadPdfjs(){
  const {lib,url}=await loadLib('pdfjs');
  lib.GlobalWorkerOptions.workerSrc = url.replace(/pdf(\.min)?\.js$/, 'pdf.worker$1.js');
  return lib;
}

function fileB64(f){
  return new Promise((ok,no)=>{
    const r=new FileReader();
    r.onload=()=>ok(String(r.result).split(',')[1]);
    r.onerror=()=>no(new Error('檔案讀取失敗'));
    r.readAsDataURL(f);
  });
}

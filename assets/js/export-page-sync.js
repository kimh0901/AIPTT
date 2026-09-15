/* 編輯器頁數與匯出頁數的對照。
   編輯器一頁就是一個可編輯的單位，匯出時可能因為條列放不下、表格太長而變成
   續頁。以前這件事只有按下「將匯出續頁套入編輯器」（會直接改寫內容）才看得到，
   或是等匯出完打開檔案才發現頁數對不上。這一支只負責「算出來並回報」，
   不改動任何一頁的內容，也不觸發重新排版。

   自己的命名空間，不覆寫其他模組的函式；使用端以 ExportPages.xxx() 呼叫。 */
const ExportPages=(function(){
  const cache=new Map();
  function templateSignature(){
    const t=S.pptTemplate;
    if(!t)return 'none|'+(S.styleId||'');
    return [t.name,t.width,t.height,(t.designSlides||[]).length,t.structureMode||'',t.designMode?1:0,S.styleId||''].join('|');
  }
  function keyFor(slide){
    try{return templateSignature()+''+JSON.stringify(slide);}catch(e){return null;}
  }
  /* 這一頁匯出時會變成幾頁。分頁是逐頁獨立計算的，所以單頁送進去等於整份的結果。 */
  function pagesFor(slide){
    if(!slide)return 1;
    const key=keyFor(slide);
    if(key&&cache.has(key))return cache.get(key);
    let n=1;
    try{
      const copy=JSON.parse(JSON.stringify(slide));
      const deck=S.pptTemplate?prepareTemplateSlides([copy])
        :(typeof prepareAdvancedSlides==='function'?prepareAdvancedSlides([copy]):[copy]);
      n=Math.max(1,deck.length);
    }catch(e){n=1;}
    if(key){if(cache.size>400)cache.clear();cache.set(key,n);}
    return n;
  }
  function counts(){return (S.slides||[]).map(pagesFor);}
  function total(){return counts().reduce((a,b)=>a+b,0);}
  /* 哪幾頁會變成續頁，給說明文字用：[{index,pages}] */
  function expanded(){
    const out=[];
    (S.slides||[]).forEach((s,i)=>{const n=pagesFor(s);if(n>1)out.push({index:i,pages:n,title:s.title||'未命名'});});
    return out;
  }
  /* 一句話的說明；頁數相同時回傳空字串，不佔版面。 */
  function note(){
    const editor=(S.slides||[]).length,out=total();
    if(!editor||out===editor)return '';
    const list=expanded();
    const detail=list.slice(0,4).map(x=>'第 '+(x.index+1)+' 頁→'+x.pages+' 頁').join('、');
    return '匯出時會變成 '+out+' 頁（'+detail+(list.length>4?' 等':'')+'）。編輯器保留原始頁面，內容不會被改寫。';
  }
  function clear(){cache.clear();}
  return {pagesFor,counts,total,expanded,note,clear};
})();

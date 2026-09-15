/* The editor keeps the original table; preview and export use measured continuations. */
const advancedFitStyleBefore=builtinChartStyleBox;
builtinChartStyleBox=function(slide){
  const html=advancedFitStyleBefore(slide);
  if(slide?.chart?.type!=='table')return html;
  try{
    /* 與縮圖、匯出面板共用同一份計算（ExportPages 有快取，不會重算一次）。 */
    const pages=typeof ExportPages!=='undefined'?ExportPages.pagesFor(slide)
      :(S.pptTemplate?prepareTemplateSlides([JSON.parse(JSON.stringify(slide))]):prepareAdvancedSlides([JSON.parse(JSON.stringify(slide))])).length;
    if(pages<2)return '<p role="status" class="hint">此表格匯出時為 1 頁。</p>'+html;
    return '<p role="status" class="hint">此表格匯出時會分成 '+pages+' 頁，續頁會重複表頭。編輯器保留原始完整資料。</p>'+html;
  }catch(e){return '<p role="status" class="hint">表格分頁尚未確認，請檢查版面。</p>'+html;}
};

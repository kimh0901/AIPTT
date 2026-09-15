/* Scoped template/export safeguards. Never change source chart values or labels. */
function fittedNativeChartOptions(type,data,options){
  const out={...options},w=Number(out.w),h=Number(out.h);
  if(![out.x,out.y,w,h].every(Number.isFinite)||w<=0||h<=0)throw new Error('圖表區域無效，請調整圖表位置與大小。');
  const labels=(data[0]&&data[0].labels)||[],count=Math.max(1,labels.length);
  const face=out.catAxisLabelFontFace||out.dataLabelFontFace||'Microsoft JhengHei';
  // Legend otherwise falls back to the library's default font, not the template font.
  out.legendFontFace=out.legendFontFace||face;
  out.dataLabelFontFace=out.dataLabelFontFace||face;
  out.legendFontSize=out.legendFontSize||Math.min(12,Number(out.catAxisLabelFontSize)||11);
  const horizontal=String(type)==='bar'&&out.barDir==='bar';
  const axisPt=Number(out.catAxisLabelFontSize)||11;
  if(horizontal){
    const slot=Math.max(1,(h-.65)*72/count);
    if(slot<axisPt*1.5)out.catAxisLabelFontSize=Math.max(9,Math.min(axisPt,Math.floor(slot/1.5)));
  }else if(['bar','line'].includes(String(type))){
    const widthPt=Math.max(1,(w-.8)*72/count);
    const units=s=>Array.from(String(s)).reduce((n,c)=>n+(/[\u2e80-\u9fff\uff00-\uffef]/.test(c)?1:.58),0);
    const longest=Math.max(0,...labels.map(s=>units(s)*axisPt));
    if(longest>widthPt*.9&&!Number(out.catAxisLabelRotate))out.catAxisLabelRotate=-45;
  }
  return out;
}
const nativeSinkBeforeGuard=pptxSink;
pptxSink=function(pptx,slide){
  const sink=nativeSinkBeforeGuard(pptx,slide),chart=sink.chart;
  sink.chart=(type,data,options)=>chart(type,data,fittedNativeChartOptions(type,data,options));
  return sink;
};

const parseBeforeExportGuard=parsePptTemplate;
parsePptTemplate=async function(file){
  const template=await parseBeforeExportGuard(file);
  try{
    const Zip=(await loadLib('jszip')).lib,zip=await Zip.loadAsync(template.buffer);
    const paths=Object.keys(zip.files).filter(p=>/^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(p));
    let tables=0;
    for(const path of paths)tables+=xmlList(xmlDoc(await zipText(zip,path),path),'tbl').length;
    const invalid=(template.layouts||[]).flatMap(l=>l.placeholders||[]).filter(p=>p.rect&&
      (![p.rect.x,p.rect.y,p.rect.w,p.rect.h].every(Number.isFinite)||p.rect.w<=0||p.rect.h<=0)).length;
    template.exportAnalysis={tables,invalid};
  }catch(e){template.exportAnalysis={error:'未完成額外的表格與區域分析，請核對原始模板。'};}
  return template;
};
const choiceBeforeExportGuard=templateChoicePanel;
templateChoicePanel=function(s){
  const html=choiceBeforeExportGuard(s),a=S.pptTemplate&&S.pptTemplate.exportAnalysis;
  if(!a)return html;
  const notes=[];
  if(a.tables)notes.push('模板含 '+a.tables+' 個原生表格物件。目前不會把範例表格及數字自動套入新內容，也未提供資料轉成可編輯 PPT 表格的流程；如需原生表格，請於 PowerPoint 補入並檢查欄寬、列高。');
  if(a.invalid)notes.push('發現 '+a.invalid+' 個無效預留位置，請選擇其他版面並核對匯出結果。');
  if(a.error)notes.push(a.error);
  return html+(notes.length?'<div role="status" style="margin-top:12px;padding:12px;border-left:3px solid #e7a83e;line-height:1.6;color:var(--paper)">'+notes.map(esc).join('<br>')+'</div>':'');
};

/* Add presentation choices without changing evidence, aggregation or generation. */
function chartPresentationCandidates(slide){
  const setup=chartDraftSetup(slide||{});
  if(!setup.table)return [];
  const suggested=quickChartSpec(),time=/日期|年月|年度|年份|月份|年|月|日|季|date|year|month/i.test(setup.table.headers[setup.categoryIndex]||'');
  const candidates=time?[
    {type:'line',name:'時間趨勢',reason:'以線條比較連續期間的變動；仍按原資料時間順序。'},
    {type:'column',name:'各期比較',reason:'以柱高比較每期數值，不更動期間或數值。'}
  ]:[
    {type:'column',name:'項目比較',reason:'適合少量分類的數值比較。'},
    {type:'bar',name:'橫向比較／排名',reason:'長名稱更容易閱讀；排序沿用目前設定。'}
  ];
  if(suggested.type==='doughnut'&&suggested.tableId===setup.table.id)candidates.unshift({type:'doughnut',name:'組成占比',reason:'僅在非負值、同期間及可比較分類通過現有檢查時提供。'});
  return candidates;
}
const chartViewBeforeCandidates=viewChartAI;
viewChartAI=function(){
  const html=chartViewBeforeCandidates(),options=chartPresentationCandidates(S.slides[S.cursor]);
  if(!options.length)return html;
  const box='<section aria-label="圖表呈現候選" style="border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:14px">'+
    '<div class="lbl">先選擇想表達的重點（選用）</div><div class="hint">只改呈現方式，不新增或推算資料。選擇後仍可調整下方欄位。</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:8px;margin-top:10px">'+options.map(o=>
      '<button type="button" class="chip" data-chart-presentation="'+o.type+'" style="min-width:0;white-space:normal;text-align:left;padding:12px"><b style="display:block">'+esc(o.name)+'</b><span style="display:block;line-height:1.5;margin-top:6px;font-size:14px">'+esc(o.reason)+'</span></button>').join('')+'</div></section>';
  return html.replace('<div id="chartResolvedDetail"',box+'<div id="chartResolvedDetail"');
};
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-chart-presentation]');if(!button)return;
  const picker=document.getElementById('chartTypePick');if(!picker)return;
  const type=button.dataset.chartPresentation;
  if(!Array.from(picker.options).some(o=>o.value===type))return;
  picker.value=type;
  picker.dispatchEvent(new Event('change',{bubbles:true}));
  document.querySelectorAll('[data-chart-presentation]').forEach(b=>{
    const selected=b.dataset.chartPresentation===type;b.classList.toggle('on',selected);b.setAttribute('aria-pressed',String(selected));
  });
});

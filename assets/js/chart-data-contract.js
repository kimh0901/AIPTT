/* Read-only boundary validation shared by preview and export. No aggregation,
 * sorting, unit conversion or AI calls are allowed in this module. */
const ChartDataContract={
  inspect(chart){
    if(!chart||chart.type==='content')return '';
    const labels=chart.labels,series=chart.series;
    if(!Array.isArray(labels)||!labels.length||!Array.isArray(series)||!series.length)return '圖表缺少分類或數值，請重新選取資料。';
    if(labels.some(v=>v===null||v===undefined||String(v).trim()===''))return '圖表有空白分類，請核對資料來源。';
    for(const s of series){
      if(!s||!Array.isArray(s.values)||s.values.length!==labels.length)return '圖表分類與數值筆數不同，請修正資料對應。';
      if(s.values.some(v=>!['number','string'].includes(typeof v)||String(v).trim()===''||!Number.isFinite(Number(v))))return '圖表含缺值或無效數值，不能當成 0，請先核對資料。';
    }
    if(chart.type==='doughnut'&&series.length!==1)return '圓環圖需選定一個數列，不能默默省略其他數列。';
    if(chart.type==='doughnut'&&(series[0].values.some(v=>Number(v)<0)||series[0].values.reduce((sum,v)=>sum+Number(v),0)<=0))return '圓環圖需非負數且合計大於零；含負值請改用長條圖。';
    if(['scatter','stacked100'].includes(chart.type)&&series.length!==2)return '散佈圖與目前的 100% 堆疊圖需兩個完整對應數列。';
    if(['table','scatter','stacked100'].includes(chart.type)&&series.some(s=>s.values.some(v=>typeof v!=='number')))return '進階圖表數值尚未完成數字解析，請重新選取資料，避免預覽與匯出不同。';
    if(chart.type==='stacked100'&&(series.some(s=>s.values.some(v=>v<0))||labels.some((_,i)=>series.reduce((sum,s)=>sum+s.values[i],0)<=0)))return '100% 堆疊需非負數，且每一組合計大於零。';
    return '';
  },
  assertDeck(slides){
    (slides||[]).forEach((s,i)=>{const error=this.inspect(s.chart);if(error)throw Error('第 '+(i+1)+' 頁：'+error);});
  }
};

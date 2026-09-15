/* Deterministic evidence checks. Never ask the language model to fill missing data. */
const MonthlyAnalysis={
  counties:['臺北市','新北市','桃園市','臺中市','臺南市','高雄市','基隆市','新竹市','嘉義市','新竹縣','苗栗縣','彰化縣','南投縣','雲林縣','嘉義縣','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣'],
  compute(tables){
    const years=[2024,2025],months=[6,7,8,9],six=new Set(this.counties.slice(0,6));
    const county=v=>String(v||'').trim().replace(/^台(?=[北中南東])/,'臺');
    const select=re=>tables.filter(t=>/縣市/.test((t.headers||[]).join(' '))&&re.test((t.headers||[]).join(' ')));
    const salesTables=select(/住宅/).filter(t=>/售電/.test((t.headers||[]).join(' '))),coolingTables=select(/冷氣時/);
    const read=(list,re)=>{
      const cells=new Map(),issues=[],sums=new Map();let rows=0;
      if(list.length!==1)return {cells,sums,rows,issues:[list.length?'找到多份候選資料表，請停用重複來源或確認要分析哪一份。':'缺少資料表。'],complete:false};
      const table=list[0],h=table.headers||[],find=re=>h.findIndex(v=>re.test(String(v).replace(/\s/g,''))),ci=find(/縣市/),vi=find(re),di=find(/日期|年月/),yi=find(/^年$|年度|年份/),mi=find(/^月$|月份/);
      if(vi<0)return {cells,sums,rows,issues:['找不到所需的數值欄。'],complete:false};
      for(const r of table.rows||[]){
        const d=String(r[di]||''),y=Number((d.match(/20\d{2}/)||[])[0]||(String(r[yi]||'').match(/20\d{2}/)||[])[0]);
        const m=Number((d.match(/(?:年|[-/])(\d{1,2})(?:月|[-/]|$)/)||[])[1]||(String(r[mi]||'').match(/\d{1,2}/)||[])[0]),c=county(r[ci]);
        if(!years.includes(y)||!months.includes(m)||!this.counties.includes(c))continue;
        const v=chartNum(r[vi]),key=y+'|'+c+'|'+m;
        // Duplicates may be repeated totals or different segments: do not guess which.
        if(cells.has(key)){cells.set(key,null);issues.push('重複縣市月份：'+key);continue;}
        cells.set(key,v);if(v!==null)rows++;
      }
      for(const y of years)for(const c of this.counties){
        const vals=months.map(m=>cells.get(y+'|'+c+'|'+m));
        if(vals.every(v=>typeof v==='number'&&Number.isFinite(v)))sums.set(y+'|'+c,vals.reduce((a,v)=>a+v,0));
      }
      const complete=years.every(y=>this.counties.every(c=>sums.has(y+'|'+c)));
      if(!complete)issues.push('缺少或重複部分縣市的 6–9 月資料，不能推論全台總量與完整排名。');
      if(table.totalRows&&(table.rows||[]).length<Number(table.totalRows)){issues.push('解析列數少於來源列數。');return {cells,sums,rows,issues,complete:false};}
      return {cells,sums,rows,issues,complete};
    };
    const sales=read(salesTables,/住宅.*售電|住宅部門/),cool=read(coolingTables,/冷氣時/);
    const totals={},sixTotals={};
    for(const y of years){
      const ready=this.counties.every(c=>sales.sums.has(y+'|'+c));
      totals[y]=ready?this.counties.reduce((n,c)=>n+sales.sums.get(y+'|'+c),0):NaN;
      sixTotals[y]=ready?this.counties.filter(c=>six.has(c)).reduce((n,c)=>n+sales.sums.get(y+'|'+c),0):NaN;
    }
    const share=y=>totals[y]>0?sixTotals[y]/totals[y]*100:NaN;
    const overall=sales.complete&&totals[2024]>0?(totals[2025]/totals[2024]-1)*100:NaN;
    const ranked=sales.complete?this.counties.map(c=>{const a=sales.sums.get('2024|'+c),b=sales.sums.get('2025|'+c);return {c,a,b,g:a>0?(b/a-1)*100:NaN,c24:cool.sums.get('2024|'+c),c25:cool.sums.get('2025|'+c)};}).filter(x=>Number.isFinite(x.g)).sort((a,b)=>b.g-a.g).slice(0,10):[];
    const fmt=n=>Number.isFinite(n)?n.toLocaleString('zh-TW',{maximumFractionDigits:2}):'資料待補';
    const details={salesRows:sales.rows,coolingRows:cool.rows,totals,sixTotals,s24:share(2024),s25:share(2025),overall,ranked,coverageComplete:sales.complete};
    const lines=['【系統檢核｜2024、2025 年，全台 22 縣市，6–9 月】',...sales.issues.map(x=>'售電：'+x),...cool.issues.map(x=>'冷氣時：'+x)];
    for(const y of years)lines.push(y+' 年全台夏季住宅售電量：'+fmt(totals[y])+' 度；六都占比：'+fmt(share(y))+'%。');
    lines.push('同期變化率：'+fmt(overall)+'%。');
    if(sales.complete)lines.push(monthlyComputedMarkdown({sales:true,cooling:cool.sums.size>0,details}));
    else lines.push('缺漏不是 0。禁止用抽樣資料推算全台總量、年度變化或前十名；補齊來源後重新分析。');
    return {text:lines.join('\n'),sales:sales.complete,cooling:cool.sums.size>0,details};
  }
};

const AIRevisionGuard={
  tokens(value){
    const text=typeof value==='string'?value:JSON.stringify(value);
    return (String(text||'').normalize('NFKC').replace(/(?<=\d),(?=\d)/g,'').match(/[-+]?\d+(?:\.\d+)?(?:\s*(?:%|億|萬|千|度|小時|元|年|月|個百分點))?/g)||[]).map(v=>v.replace(/\s/g,'')).sort();
  },
  verify(original,reply){
    for(const key of ['title','subtitle','bullets','columns','stat','quote','note']){
      if(reply[key]===undefined)continue;
      if(JSON.stringify(this.tokens(original[key]))!==JSON.stringify(this.tokens(reply[key])))throw Error('AI 改寫涉及「'+key+'」數字增刪或變更，已保留原頁。請先核對來源，再於編輯器修改數字。');
      if(key==='stat'&&this.tokens(original[key]).length){
        const units=x=>(JSON.stringify(x||{}).match(/kWh|MWh|GWh|小時|億元|萬元|人次|百分點|度|元|%|％/g)||[]).sort().join('|');
        if(units(original[key])!==units(reply[key]))throw Error('AI 改寫涉及數值單位變更，已保留原頁，請先核對來源。');
      }
    }
  },
  instruction:'只改寫文字，不新增、刪除或變更目前頁面的數字、年份、百分比及單位；缺少來源寫資料待補，不以常識補造統計。數值修正須由使用者核對後手動編輯。'
};

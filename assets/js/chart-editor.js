/* Transactional chart-only editing. Source tables, outline and template stay untouched. */
const ChartEditor=(()=>{
  const supported=['column','bar','line','doughnut','scatter','stacked100','table'];
  function button(s){return s?.layout==='chart'&&supported.includes(s.chart?.type)?'<button class="btn pri full" data-chart-edit-open style="margin-bottom:14px">編輯本頁圖表資料</button>':'';}
  function parseNumber(raw){
    const text=String(raw).trim();
    if(!/^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text))throw Error('請輸入完整數字；空白不會自動當成 0。百分比請填數字，單位保持原設定。');
    const n=Number(text.replace(/,/g,''));if(!Number.isFinite(n))throw Error('數字超出可用範圍。');return n;
  }
  function build(original,names,rows){
    const next=JSON.parse(JSON.stringify(original));
    if(names.some(n=>!n.trim()))throw Error('每個數列都需要名稱。');
    if(rows.some(r=>r.length!==names.length+1))throw Error('每一列的欄位數必須一致。');
    next.labels=rows.map(r=>r[0].trim());
    next.series=next.series.map((s,j)=>({...s,name:names[j].trim(),values:rows.map(r=>parseNumber(r[j+1]))}));
    const error=ChartDataContract.inspect(next);if(error)throw Error(error);
    return next;
  }
  function open(){
    const slide=S.slides[S.cursor];if(!slide||!supported.includes(slide.chart?.type))return;
    const before=JSON.stringify(slide.chart),original=JSON.parse(before);
    const dialog=document.createElement('dialog');
    dialog.style.cssText='width:min(920px,94vw);max-height:90vh;overflow:auto;background:var(--panel,#171d27);color:var(--paper,#fff);border:1px solid #657084;border-radius:12px;padding:20px';
    dialog.setAttribute('aria-label','編輯本頁圖表資料');
    const cell=(v,label)=>`<input aria-label="${esc(label)}" value="${esc(String(v))}" style="min-width:130px;width:100%;box-sizing:border-box;font-size:16px;padding:8px">`;
    const row=(values,i)=>'<tr>'+values.map((v,j)=>'<td>'+cell(v,`第 ${i+1} 列 ${j===0?'分類':'數值 '+j}`)+'</td>').join('')+'<td><button type="button" data-delete-row aria-label="刪除此列">刪除</button></td></tr>';
    dialog.innerHTML=`<h2 style="margin-top:0">編輯本頁圖表資料</h2><p>只修改本頁圖表，不會回寫 Excel 或重做大綱。數值請沿用原單位；套用後更新預覽及可編輯 PPTX。</p><div style="overflow:auto;max-height:55vh"><table style="border-spacing:6px"><thead><tr><th>分類／項目</th>${original.series.map((s,j)=>'<th>'+cell(s.name||'數列 '+(j+1),'數列 '+(j+1)+' 名稱')+'</th>').join('')}<th>操作</th></tr></thead><tbody>${original.labels.map((label,i)=>row([label,...original.series.map(s=>s.values[i])],i)).join('')}</tbody></table></div><p role="alert" data-error style="color:#ffbd91"></p><div style="display:flex;flex-wrap:wrap;gap:12px"><button type="button" class="btn" data-add-row>新增一列</button><button type="button" class="btn" data-cancel>取消</button><button type="button" class="btn pri" data-apply>套用並更新圖表</button></div>`;
    const message=dialog.querySelector('[data-error]');
    dialog.addEventListener('click',e=>{
      if(e.target.closest('[data-delete-row]'))e.target.closest('tr').remove();
      if(e.target.closest('[data-add-row]')){const body=dialog.querySelector('tbody');body.insertAdjacentHTML('beforeend',row(['',...original.series.map(()=> '')],body.rows.length));body.lastElementChild.querySelector('input').focus();}
      if(e.target.closest('[data-cancel]'))dialog.close();
      if(e.target.closest('[data-apply]'))try{
        if(S.slides[S.cursor]!==slide||JSON.stringify(slide.chart)!==before)throw Error('本頁資料已變更，請關閉並重新開啟編輯，避免覆蓋新資料。');
        const next=build(original,Array.from(dialog.querySelectorAll('thead input'),n=>n.value),Array.from(dialog.querySelectorAll('tbody tr'),r=>Array.from(r.querySelectorAll('input'),n=>n.value)));
        pushHistory(S.cursor);slide.chart=next;slide.status='edited';saveDraft();dialog.close();render();
      }catch(error){message.textContent=error.message;}
    });
    dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-chart-edit-open]'))open();});
  return {button,build,parseNumber};
})();

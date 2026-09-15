/* Opt-in closing text offsets only. Both renderers consume these same plans. */
const ClosingPosition=(()=>{
  function move(o,slide,width,height){
    if(slide.layout!=='closing'||!['title','subtitle'].includes(o.edit))return;
    o.x+=Number(slide.closingOffset?.x||0)*width/100;
    o.y+=Number(slide.closingOffset?.y||0)*height/100;
  }
  function center(boxes,s,W,H){
    const texts=boxes.filter(o=>['title','subtitle'].includes(o.edit));if(!texts.length)return;
    const top=Math.min(...texts.map(o=>o.y)),bottom=Math.max(...texts.map(o=>o.y+o.h));
    const dy=(H-(bottom-top))/2-top;
    for(const o of texts){o.x=(W-o.w)/2;o.y+=dy;o.align='center';move(o,s,W,H);}
  }
  const templateBefore=templatePlan;
  templatePlan=function(s,...args){const original=templateBefore(s,...args);if(s.layout!=='closing'||!S.pptTemplate)return original;const plan={...original,ops:original.ops.map(op=>op.kind==='text'?{...op,args:[op.args[0],{...op.args[1]},...op.args.slice(2)]}:op)};center(plan.ops.filter(op=>op.kind==='text').map(op=>op.args[1]),s,S.pptTemplate.width,S.pptTemplate.height);return plan;};
  const freeBefore=FreeLayout.plan;
  FreeLayout.plan=function(s,...args){const original=freeBefore(s,...args);if(s.layout!=='closing')return original;const plan={...original,items:original.items.map(item=>item.kind==='text'?{...item,o:{...item.o}}:item)};center(plan.items.filter(item=>item.kind==='text').map(item=>item.o),s,13.333,7.5);return plan;};
  const panelBefore=textPanel;
  textPanel=function(s,...args){return panelBefore(s,...args)+(s.layout==='closing'?`<fieldset class="closing-position"><legend>感謝詞位置</legend><p>預設置中，以下位移以中央為基準，不移動 Logo 或頁尾。</p>${['x','y'].map((key,i)=>`<label style="display:block;margin:10px 0">${i?'上下':'左右'}位移（投影片 %）<input type="number" min="-80" max="80" step="1" data-closing-offset="${key}" value="${Number(s.closingOffset?.[key]||0)}" style="display:block;width:100%;box-sizing:border-box"></label>`).join('')}<button type="button" data-closing-reset>恢復置中</button><p>負值向左／上，正值向右／下；請核對是否遮擋母片圖案。</p></fieldset>`:'');};
  function refresh(s){
    const main=document.getElementById('mainStage');if(main)main.innerHTML=renderSlide(s,previewStyle(),S.cursor,S.slides.length,true);
    const thumb=document.querySelector('.rail-item.is-active .stage');if(thumb)thumb.innerHTML=renderSlide(s,previewStyle(),S.cursor,S.slides.length,false);
    // Do not replace the inspector or its input: preserve focus and scrolling.
  }
  function update(e){const key=e.target.dataset?.closingOffset;if(!['x','y'].includes(key)||e.target.value==='')return;const s=S.slides[S.cursor],value=Number(e.target.value);if(!s||s.layout!=='closing'||!Number.isFinite(value))return;const next=Math.max(-80,Math.min(80,value));if(Number(s.closingOffset?.[key]||0)===next)return;pushHistory(S.cursor);s.closingOffset={...s.closingOffset,[key]:next};saveDraft();refresh(s);}
  document.addEventListener('input',update);document.addEventListener('change',update);
  document.addEventListener('click',e=>{if(!e.target.closest('[data-closing-reset]'))return;const s=S.slides[S.cursor];if(!s||s.layout!=='closing')return;pushHistory(S.cursor);delete s.closingOffset;document.querySelectorAll('[data-closing-offset]').forEach(el=>el.value='0');saveDraft();refresh(s);});
  return {move};
})();

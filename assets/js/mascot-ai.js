/* Opt-in vision suggestions. AI selects only locally validated candidates.
   Does not edit slide text, template geometry, charts or the shared AI client. */
const MascotAI=(()=>{
  let active=null;
  async function contactSheet(assets){
    const c=document.createElement('canvas');c.width=900;c.height=Math.ceil(assets.length/3)*260;
    const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
    for(let i=0;i<assets.length;i++){
      const img=new Image();img.src=assets[i].data;await img.decode();
      const scale=Math.min(260/img.width,210/img.height),x=(i%3)*300,y=Math.floor(i/3)*260;
      ctx.drawImage(img,x+(300-img.width*scale)/2,y+10,img.width*scale,img.height*scale);
      ctx.fillStyle='#111';ctx.font='18px sans-serif';ctx.fillText('Image '+i,x+12,y+246);
    }
    return {media:'image/png',b64:c.toDataURL('image/png').split(',')[1]};
  }
  function open(){
    if(active)return;
    const context=Mascot.context(),idx=context.idx,s=context.s;if(!s)return;
    const snap=Mascot.aiSnapshot(s,idx),dialog=document.createElement('dialog');
    dialog.className='mascot-ui';dialog.style='width:min(960px,94vw);max-height:90vh;overflow:auto;background:#171d26;color:#fff;border:1px solid #637085;border-radius:16px;padding:24px;box-sizing:border-box';
    active=dialog;
    dialog.innerHTML='<h2>本頁 AI 吉祥物建議</h2><p>只傳送本頁文字、已上傳的吉祥物縮圖與安全候選位置至目前設定的 AI 服務（'+esc(S.cfg.provider||'')+'／'+esc(S.cfg.model||'')+'）。不傳送 Excel、整份簡報或原始 PPTX。可能產生 API 費用，模型須支援圖片。</p><p>AI 看吉祥物姿態並依本頁內容選擇；不是以 AI 辨識整張母片。母片安全位置由本機解析估算，仍需檢視預覽。</p><p data-ai-status role="status"></p><div data-ai-preview></div><div class="mascot-ui__actions"><button type="button" data-ai-send>同意傳送並取得建議</button><button type="button" data-ai-apply disabled>確認套用本頁</button><button type="button" data-ai-close>取消</button></div>';
    document.body.appendChild(dialog);dialog.showModal();
    const status=dialog.querySelector('[data-ai-status]'),send=dialog.querySelector('[data-ai-send]'),apply=dialog.querySelector('[data-ai-apply]');let chosen=null;
    const fresh=()=>{const c=Mascot.context();return c.wizard===context.wizard&&c.s===s&&c.idx===idx&&S.pptTemplate===snap.template&&Mascot.aiSnapshot(s,idx).stamp===snap.stamp;};
    if(!snap.candidates.length){status.textContent=s.layout==='cover'?'封面預設不新增人物；如有需要，請先允許品牌封面並指定圖片用途。':'本機未找到足夠安全留白，不會傳送 AI。可改用手動位置或先調整本頁內容。';send.disabled=true;}
    const policy=MascotInteraction.policy(s,snap.assets);
    if(policy.qa&&policy.matched.length<2){status.textContent='感謝／Q&A 頁需要同時上傳「阿光_結尾」與「DEN_結尾」原圖；目前未齊備，不會傳送 AI。仍可手動選擇單張圖片套用。';send.disabled=true;}
    if(!snap.assets.length){status.textContent='尚未載入吉祥物圖片。請先關閉此視窗，在吉祥物工具上傳 PNG／JPG，再重新取得建議。';send.disabled=true;}
    else if(!aiReady()){status.textContent='AI 尚未就緒。請先關閉視窗，到右上角設定 AI 服務與金鑰；不使用 AI 也可手動套用。';send.disabled=true;}
    dialog.addEventListener('close',()=>{if(active===dialog)active=null;dialog.remove();});
    dialog.querySelector('[data-ai-close]').onclick=()=>dialog.close();
    send.onclick=async()=>{
      chosen=null;apply.disabled=true;dialog.querySelector('[data-ai-preview]').replaceChildren();
      send.disabled=true;status.textContent='正在分析圖片與本頁內容，完成後請先預覽；尚未改動投影片。';
      try{
        if(!fresh())throw Error('本頁或模板已變更，請關閉後重新取得建議。');
        const image=await contactSheet(snap.assets);
        const text=JSON.stringify({slide:{title:s.title,subtitle:s.subtitle,kicker:s.kicker,bullets:s.bullets,columns:s.columns,stat:s.stat,layout:s.layout},policy:MascotInteraction.policy(s,snap.assets),images:snap.assets.map((a,i)=>({image:i,name:a.name,role:a.role,usedOnOtherPage:context.slides.some((other,j)=>j!==idx&&(other.mascotPlacement?.assetIndex===i||(other.mascotPlacement?.companions||[]).some(m=>m.assetIndex===i)))})),candidates:snap.candidates.map((c,i)=>({id:i,image:c.assetIndex,box:c.box,targets:c.targets,position:c.placement}))});
        // Keep rate-limit waiting local to this dialog; never turn success copy into S.busy.
        while(Date.now()<lastCall+(Number(S.cfg.gapMs)||0)){
          if(!dialog.open)return;
          status.textContent='等待服務間隔 '+Math.ceil((lastCall+(Number(S.cfg.gapMs)||0)-Date.now())/1000)+' 秒；不會自動重複送出。';
          await new Promise(resolve=>setTimeout(resolve,250));
        }
        if(!dialog.open)return;
        if(!fresh())throw Error('頁面已變更，請重新分析。');
        lastCall=Date.now();status.textContent='AI 正在分析本頁角色互動，完成後請確認預覽。';
        const raw=await askOnce('你是商務簡報設計師。圖片是編號吉祥物聯絡表。'+MascotInteraction.instructions+' 不得自行創建座標，不改文字、不要求新增圖片。只回傳 {"selections":[{"candidate":整數,"target":目標id,"actionDirection":"left或right","flip":false}],"reason":"說明角色與哪項資訊互動"}。不適合時 selections 為空陣列。',text,image,{temperature:0.2});
        bumpUsage();
        if(!dialog.open)return;
        if(!fresh())throw Error('等待期間本頁、圖片或模板已變更，請關閉後重新分析。');
        const result=parseJSON(raw);
        chosen=MascotInteraction.validate(result,snap,s);
        if(!chosen){status.textContent='AI 建議本頁不放吉祥物：'+String(result.reason||'沒有符合方向與安全留白的配置。');return;}
        const preview=JSON.parse(JSON.stringify(s));delete preview.mascotHidden;preview.mascotPlacement=chosen.placement;
        const host=dialog.querySelector('[data-ai-preview]');host.style='position:relative;width:100%;aspect-ratio:'+chosen.W+'/'+chosen.H+';overflow:hidden;background:white';
        host.innerHTML=renderSlide(preview,curStyle(),idx,context.slides.length,false);
        status.textContent='建議：'+String(result.reason||'依內容與留白選擇。')+' 請檢查圖片是否遮擋文字或 Logo，再確認套用。';apply.disabled=false;
      }catch(e){if(dialog.open)status.textContent='未套用：'+(e.message||'AI 分析失敗，請改用手動配置。');}
      finally{if(dialog.open)send.disabled=false;}
    };
    apply.onclick=()=>{
      if(!chosen||!fresh()){apply.disabled=true;status.textContent='內容已改變，請關閉後重新分析。';return;}
      s.mascotPlacement={...chosen.placement};delete s.mascotHidden;saveDraft();dialog.close();Mascot.notify('已套用 AI 建議至第 '+(idx+1)+' 頁；完成流程後沿用本頁配置，仍可手動微調。');
    };
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-mascot-ai]'))open();});
  return {open};
})();

/* Optional session-only image decoration. Never edits slides or source data. */
const Mascot=(()=>{
  let assets=[],enabled=false,scope='closing',allowCover=false,request=0,autoExpanded=false,editMember=0;
  let notice='';
  function refreshInspector(){
    const scrolls=[...document.querySelectorAll('.scroll')].map(el=>({top:el.scrollTop,left:el.scrollLeft}));
    const active=document.activeElement,selector=active?.hasAttribute('data-mascot-member')?'[data-mascot-member]':active?.hasAttribute('data-mascot-second')?'[data-mascot-second]':null;
    render();
    document.querySelectorAll('.scroll').forEach((el,i)=>{if(scrolls[i]){el.scrollTop=scrolls[i].top;el.scrollLeft=scrolls[i].left;}});
    if(selector)document.querySelector(selector)?.focus({preventScroll:true});
  }
  function context(){
    const wizard=!!S.wizard&&S.step===5,slides=wizard?wizardPreviewDeck():(S.slides||[]);
    const idx=Math.max(0,Math.min(slides.length-1,wizard?(S.wizardPreviewIndex||0):(S.cursor||0)));
    return {wizard,slides,idx,s:slides[idx]};
  }
  function notify(message){
    notice=message;
    if(/圖片已載入|已套用到第|已套用 AI 建議/.test(String(S.busy||'')))S.busy=null;
    render();
  }
  const roles={general:'一般點綴',problem:'痛點／警告',solution:'方案／指引',closing:'結尾／感謝',brand:'品牌封面（需明確允許）'};
  function purpose(s){
    if(s.layout==='cover')return 'brand';if(s.layout==='closing')return 'closing';
    const text=[s.title,s.kicker,s.subtitle,...(s.bullets||[]).map(b=>b.h)].join(' ');
    const problem=/痛點|危機|警告|問題|挑戰|風險/.test(text),solution=/方案|策略|指引|建議|改善|解決/.test(text);
    return problem!==solution?(problem?'problem':'solution'):'general';
  }
  function selectAsset(s,idx){const role=purpose(s),matches=assets.filter(a=>a.role===role),pool=matches.length?matches:(role==='brand'?[]:assets.filter(a=>a.role==='general'));return pool.length?pool[idx%pool.length]:null;}
  /* 安全間距跟著投影片尺寸走：固定 0.12 吋在 20 吋的版面上幾乎等於貼著文字。 */
  // 30 px on a 1280 px reference slide; scales with the actual PPTX canvas.
  const gapFor=(W,H)=>Math.max(W*30/1280,H*.025);
  const overlap=(a,b,g=.12)=>a.x<b.x+b.w+g&&a.x+a.w+g>b.x&&a.y<b.y+b.h+g&&a.y+a.h+g>b.y;
  function computePlacement(s,idx=0,proposalAsset=null,collect=false){
    if(s.mascotHidden)return {reason:'本頁已隱藏吉祥物'};
    if(s.mascotPlacement&&assets.length){
      const m=s.mascotPlacement,asset=assets[m.assetIndex||0];
      if(!asset)return {reason:'請重新選擇圖片'};
      const W=S.pptTemplate?.width||13.333,H=S.pptTemplate?.height||7.5;
      const w=W*Math.min(30,Math.max(3,Number(m.width)||10))/100,h=Math.min(H*.5,w*asset.height/asset.width),actualW=h*asset.width/asset.height;
      const box={x:Math.max(0,Math.min(W-actualW,W*(Number(m.x)||0)/100)),y:Math.max(0,Math.min(H-h,H*(Number(m.y)||0)/100)),w:actualW,h};
      return {box,W,H,asset,warning:'手動位置：請核對文字及 Logo'};
    }
    if((!enabled&&!proposalAsset)||!assets.length)return {reason:'尚未啟用'};
    if(s.layout==='cover'&&!allowCover)return {reason:'封面預設不新增人物，保留專業封面'};
    if(!proposalAsset&&scope==='closing'&&!['cover','closing'].includes(s.layout))return {reason:'目前只套用結尾頁'};
    const asset=proposalAsset||selectAsset(s,idx);if(!asset)return {reason:'沒有對應用途圖片；未使用不相關姿態'};
    const tpl=S.pptTemplate,W=tpl?.width||13.333,H=tpl?.height||7.5;let obstacles=[],contentTargets=[];
    if(tpl){
      /* 母片圖層解析失敗不應讓吉祥物完全失效；改以內容框與安全邊界估算位置。 */
      const copy=JSON.parse(JSON.stringify(s)),p=templatePlan(copy,idx),layout=templateLayoutFor(copy.layout,copy),art=tpl.inheritedArtwork?.[layout?.path];
      /* 舊版只要讀不到這個版面的母片圖層就整頁略過，但「沒有版面配置」或
         「母片本來就沒有任何圖形」的 PPTX 也會落在這裡，結果吉祥物永遠放不上去。
         只有在母片確實有裝飾、卻無法解析時才保守略過。 */
      /* art warnings 只代表裝飾未知，不代表整張投影片沒有可放置位置。 */
      if(!art&&Number(tpl.masterDeco)>0)return {reason:'無法確認母片留白，保守略過'};
      obstacles=p.ops.filter(op=>!['notes','problem'].includes(op.kind)).map(op=>op.args.find(a=>a&&typeof a==='object'&&Number.isFinite(a.x)&&Number.isFinite(a.y)&&Number.isFinite(a.w)&&Number.isFinite(a.h))).filter(Boolean);
      contentTargets=p.ops.filter(op=>['text','chart'].includes(op.kind)).map(op=>{const r=op.args.find(a=>a&&typeof a==='object'&&Number.isFinite(a.x)&&Number.isFinite(a.w));return r?{...r,text:typeof op.args[0]==='string'?op.args[0]:'本頁圖表'}:null;}).filter(Boolean);
      const decor=p.design?.preview||[];
      // 整頁圖片可能任何位置都有標誌，不能假設哪裡是空白；整頁純色塊只是背景，不必略過。
      /* 整頁圖片視為背景，不把它當成整頁不可用；吉祥物仍會縮小並靠邊放置。 */
      obstacles.push(...decor.filter(r=>Number.isFinite(r.x)&&Number.isFinite(r.y)&&Number.isFinite(r.w)&&Number.isFinite(r.h)).map(r=>typeof rotatedBounds==='function'?rotatedBounds(r):r));
      const host=document.createElement('div');host.style='position:fixed;left:-20000px;top:0;width:1280px;height:'+1280*H/W+'px;visibility:hidden';host.innerHTML=art?art.html:'';document.body.appendChild(host);
      try{const base=host.getBoundingClientRect();for(const el of host.querySelectorAll('img,svg,div[style]')){const b=el.getBoundingClientRect();if(!b.width||!b.height)continue;if(b.width>=base.width*.9&&b.height>=base.height*.9)continue;obstacles.push({x:(b.left-base.left)/base.width*W,y:(b.top-base.top)/base.height*H,w:b.width/base.width*W,h:b.height/base.height*H});}}finally{host.remove();}
    }else{
      const p=FreeLayout.plan(s,curStyle(),idx,context().slides.length);
      obstacles=p.items.filter(i=>i.kind==='chart'||(i.kind==='text'&&i.value.trim())||i.kind==='roundRect').map(i=>i.o);
      contentTargets=p.items.filter(i=>i.kind==='chart'||(i.kind==='text'&&i.value.trim())).map(i=>({...i.o,text:i.kind==='chart'?'本頁圖表':i.value}));
    }
    const usable=obstacles.filter(o=>o&&o.w>0&&o.h>0);
    const ratio=asset.width/asset.height,gap=gapFor(W,H),found=[];
    const targets=contentTargets.filter(o=>o.w>0&&o.h>0&&o.y<H*.8&&!/^資料來源|^\d+\s*\/\s*\d+$/.test(o.text||'')).map((o,i)=>({id:i,x:o.x,y:o.y,w:o.w,h:o.h,text:String(o.text||'').slice(0,240)}));
    const important=/AI|診斷|警告|行動|成果|方案/i.test([s.title,s.kicker].join(' '));
    const ending=s.layout==='closing'||/Q\s*[&＆]\s*A|THANK\s*YOU|感謝|謝謝/i.test(s.title||'');
    const widths=ending?[.17,.15,.13]:important?[.23,.21,.18]:[.17,.15,.12];
    for(const fraction of widths){
      const w=W*fraction,h=w/ratio;if(h>H*.50)continue;
      const xs=[W-w-W*.04,W*.04],ys=[H-h-H*.14,H*.25];
      for(const o of usable){xs.push(o.x-w-gap,o.x+o.w+gap);ys.push(o.y-h-gap,o.y+o.h+gap);}
      for(let y=H-h-H*.14;y>=H*.22;y-=H*.06)ys.push(y);
      for(const y of ys)for(const x of xs){
        const box={x,y,w,h};
        if(x<W*.025||y<H*.20||x+w>W*.975||y+h>H*.88)continue;
        if(!usable.some(o=>overlap(box,o,gap))){
          const value={box,W,H,asset,targets};
          if(!collect)return value;
          if(w/W*100>=3&&!found.some(v=>Math.abs(v.box.x-x)<W*.02&&Math.abs(v.box.y-y)<H*.02))found.push(value);
          if(found.length>=120)return found;
        }
      }
    }
    if(collect)return found;
    return {reason:'沒有足夠留白；請使用本頁手動位置調整'};
  }
  /* placement() 會為每一頁跑一次完整的版面規劃，panel() 又會走訪所有頁面。
     20 頁的簡報等於每次重繪都算 20 次，畫面會明顯卡住。這裡以「模板 + 設定 +
     這一頁的內容」為索引做快取；任何一項改變，索引就不同，不會拿到舊結果。 */
  const memo=new Map();
  const templateIds=new WeakMap();let templateSerial=0;
  function placement(s,idx=0){
    const tpl=S.pptTemplate;
    if(tpl&&!templateIds.has(tpl))templateIds.set(tpl,++templateSerial);
    let key;
    try{
      key=[tpl?tpl.name+':'+tpl.size:'-',enabled?1:0,scope,allowCover?1:0,
        assets.map(a=>a.name+':'+a.role).join(','),(S.slides||[]).length,idx,JSON.stringify(s)].join('|');
    }catch(e){ return computePlacement(s,idx); }
    key+='|'+request+'|'+(tpl?templateIds.get(tpl):0)+'|'+JSON.stringify(curStyle());
    if(memo.has(key))return memo.get(key);
    const value=computePlacement(s,idx);
    if(memo.size>400)memo.clear();
    memo.set(key,value);
    return value;
  }

  function panel(){
    const c=context(),results=assets.length?c.slides.map((s,i)=>({title:s.title,...placement(s,i)})):[],count=results.filter(r=>r.box).length;
    const current=(c.wizard||S.view==='editor')&&c.s;
    const nav=c.wizard?'<label class="mascot-ui__field">先選擇預覽頁面<select data-mascot-page>'+c.slides.map((s,i)=>'<option value="'+i+'" '+(i===c.idx?'selected':'')+'>'+(i+1)+' '+esc(s.title)+'</option>').join('')+'</select></label>':'';
    return (notice?'<p class="hint" role="status">'+esc(notice)+'</p>':'')+MascotUI.panel({assets,enabled,scope,allowCover,roles,results,count,autoExpanded,editor:current?nav+editorPanel(current):''});
  }
  function editorPanel(s){
    const members=s.mascotPlacement?[s.mascotPlacement,...(s.mascotPlacement.companions||[])]:[];
    editMember=Math.max(0,Math.min(editMember,members.length-1));
    const m=members[editMember]||{x:82,y:65,width:10,assetIndex:0};
    const result=placement(s,context().idx);
    return '<section class="mascot-ui"><h3>本頁吉祥物位置</h3><p role="status" data-mascot-live-status>第 '+(context().idx+1)+' 頁：'+(result.box?'已顯示圖片'+(s.mascotPlacement?'（手動位置）':'（自動配置）'):esc(result.reason))+'</p><p>先選頁 → AI 建議並預覽 → 確認套用。也可直接「套用到本頁」手動調整；封面人物預設關閉，明確手動套用代表允許本頁使用。</p>'+
      '<div class="mascot-ui__actions"><button type="button" data-mascot-second '+(!assets.length?'disabled':'')+'>新增一隻吉祥物</button>'+(members.length?'<button type="button" data-mascot-remove-second>移除選取角色</button>':'')+'</div>'+
      (members.length?'<label class="mascot-ui__field">調整哪個角色<select data-mascot-member>'+members.map((one,i)=>'<option value="'+i+'" '+(editMember===i?'selected':'')+'>角色 '+(i+1)+'：'+esc(assets[one.assetIndex||0]?.name||'請選圖片')+'</option>').join('')+'</select></label>':'')+
      (assets.length?'<label class="mascot-ui__field">圖片<select data-mascot-manual="assetIndex">'+assets.map((a,i)=>'<option value="'+i+'" '+(Number(m.assetIndex)===i?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select></label>':'<p>請先在風格分頁上傳吉祥物圖片。</p>')+
      ['x','y','width'].map((k,i)=>'<label class="mascot-ui__field">'+['水平位置（%）','垂直位置（%）','圖片寬度（%）'][i]+'<input type="number" min="'+(k==='width'?3:0)+'" max="'+(k==='width'?30:100)+'" step="1" data-mascot-manual="'+k+'" value="'+m[k]+'"></label>').join('')+
      '<div class="mascot-ui__actions"><button type="button" class="mascot-ui__primary" data-mascot-apply '+(assets.length?'':'disabled')+'>套用到本頁</button><button type="button" class="mascot-ui__remove" data-mascot-hide>本頁不放圖片</button><button type="button" class="mascot-ui__remove" data-mascot-auto>依全篇設定</button><button type="button" data-mascot-ai>AI 建議圖片與位置</button></div><p>'+(assets.length?'已載入 '+assets.length+' 張圖片。':'尚未載入圖片，請先使用上方的圖片上傳功能；手動套用需至少一張圖片。')+' AI 建議需另行確認傳送，不會自動改動本頁。</p></section>';
  }
  function updateManual(e){
    const el=e.target;if(!el.matches('[data-mascot-manual]'))return;
    const c=context(),s=c.s;if(!s||!assets.length||el.value==='')return;
    const key=el.dataset.mascotManual,value=Number(el.value);
    if(!Number.isFinite(value)||!['x','y','width','assetIndex'].includes(key))return;
    const min=key==='width'?3:0,max=key==='width'?30:key==='assetIndex'?assets.length-1:100;
    if(value<min||value>max)return;
    delete s.mascotHidden;
    if(editMember>0&&s.mascotPlacement?.companions?.[editMember-1])s.mascotPlacement.companions[editMember-1]={...s.mascotPlacement.companions[editMember-1],[key]:value};
    else s.mascotPlacement=Object.assign({x:82,y:65,width:10,assetIndex:0},s.mascotPlacement,{[key]:value});
    memo.clear();saveDraft();
    // Keep inspector nodes, focus and scroll intact while updating slide images.
    const images=[...document.querySelectorAll('[data-mascot-slide="'+c.idx+'"]')],parents=new Set(images.map(img=>img.parentElement));
    images.forEach(img=>img.remove());parents.forEach(parent=>parent.insertAdjacentHTML('beforeend',html(s,c.idx)));
    const stage=c.wizard?document.querySelector('.style-workspace-preview .stage'):document.getElementById('mainStage');
    if(stage&&!stage.querySelector('[data-mascot-overlay]'))stage.insertAdjacentHTML('beforeend',html(s,c.idx));
    document.querySelectorAll('[data-mascot-live-status]').forEach(p=>{p.textContent='第 '+(c.idx+1)+' 頁：已顯示圖片（手動位置）';});
  }
  document.addEventListener('input',updateManual);
  document.addEventListener('click',e=>{
    const add=e.target.closest('[data-mascot-second]'),remove=e.target.closest('[data-mascot-remove-second]');if(!add&&!remove)return;
    const s=context().s;if(!s)return;
    if(add){
      if(!assets.length)return;
      if(!s.mascotPlacement){s.mascotPlacement={x:62,y:62,width:15,assetIndex:0};editMember=0;}
      else{const first=s.mascotPlacement,list=first.companions||[],n=list.length+1;list.push({x:Math.max(0,Math.min(80,Number(first.x)-20*(n%4))),y:Math.max(0,Math.min(80,Number(first.y)-18*Math.floor(n/4))),width:15,assetIndex:n%assets.length});first.companions=list;editMember=n;}
      delete s.mascotHidden;
    }else{
      const members=s.mascotPlacement?[s.mascotPlacement,...(s.mascotPlacement.companions||[])]:[];
      members.splice(Math.min(editMember,members.length-1),1);
      if(members.length){const [first,...others]=members;s.mascotPlacement={...first,companions:others};}else{delete s.mascotPlacement;s.mascotHidden=true;}
      editMember=Math.max(0,Math.min(editMember,members.length-1));
    }
    memo.clear();saveDraft();notice=add?'已新增角色，可分別選圖與調整；請核對文字、Logo 與角色間距。':'已移除選取角色，其餘角色位置保持不變。';refreshInspector();
  });
  document.addEventListener('change',e=>{if(e.target.matches('[data-mascot-page]')){S.wizardPreviewIndex=Number(e.target.value)||0;render();}});
  document.addEventListener('change',e=>{if(e.target.matches('[data-mascot-member]')){editMember=Math.max(0,Math.trunc(Number(e.target.value)||0));refreshInspector();}});
  document.addEventListener('change',updateManual);
  document.addEventListener('click',e=>{
    const apply=e.target.closest('[data-mascot-apply]'),auto=e.target.closest('[data-mascot-auto]'),hide=e.target.closest('[data-mascot-hide]');
    if(!apply&&!auto&&!hide)return;const c=context(),s=c.s;if(!s)return;
    if(apply||auto)delete s.mascotHidden;
    if(hide)s.mascotHidden=true;
    if(apply&&assets.length)s.mascotPlacement=s.mascotPlacement||{x:78,y:50,width:15,assetIndex:0};
    if(auto)delete s.mascotPlacement;memo.clear();saveDraft();render();
    if(apply)notify('已套用到第 '+(c.idx+1)+' 頁。這是手動位置，請核對是否遮擋；AI 建議會另外檢查安全位置。');
  });
  function placedImages(s,i){
    const result=[placement(s,i)];
    if(!s.mascotHidden)for(const companion of (s.mascotPlacement?.companions||[]))result.push(placement({...s,mascotPlacement:companion},i));
    return result.filter(p=>p.box);
  }
  function html(s,i){return placedImages(s,i).map(p=>{const b=p.box;return `<img data-mascot-overlay data-mascot-slide="${i}" alt="吉祥物" src="${p.asset.data}" style="position:absolute;pointer-events:none;object-fit:contain;left:${b.x/p.W*100}%;top:${b.y/p.H*100}%;width:${b.w/p.W*100}%;height:${b.h/p.H*100}%">`;}).join('');}
  function add(sl,s,i){placedImages(s,i).forEach(p=>sl.addImage({data:p.asset.data,...p.box,altText:'吉祥物圖片'}));}
  document.addEventListener('change',async e=>{
    if(e.target.matches('[data-mascot-enable],[data-mascot-scope],[data-mascot-cover],[data-mascot-role]'))autoExpanded=true;
    const el=e.target;if(el.matches('[data-mascot-enable]')){enabled=el.checked&&!!assets.length;render();return;}if(el.matches('[data-mascot-scope]')){scope=el.value==='all'?'all':'closing';render();return;}if(el.matches('[data-mascot-cover]')){allowCover=el.checked;render();return;}if(el.matches('[data-mascot-role]')){const a=assets[Number(el.dataset.mascotRole)];if(a&&Object.hasOwn(roles,el.value))a.role=el.value;render();return;}if(!el.matches('[data-mascot-upload]'))return;
    const files=Array.from(el.files||[]);if(!files.length)return;const token=++request;
    try{
      const next=[];for(const file of files){if(!['image/png','image/jpeg'].includes(file.type)||file.size>3*1024*1024)throw Error('請選擇單張 3 MB 以下的 PNG 或 JPG。');
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const img=new Image();img.src=data;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw Error('無法讀取圖片尺寸');if(token!==request)return;
      next.push({data,name:file.name,width:img.naturalWidth,height:img.naturalHeight,role:'general'});}
      assets=assets.concat(next);el.value='';
      memo.clear();notify('圖片已載入。請在下方選頁，再按「AI 建議圖片與位置」或「套用到本頁」。');
    }catch(err){if(token===request)fail(err.message||'圖片讀取失敗，請換一張圖片。');}
  });
  document.addEventListener('click',e=>{if(e.target.closest('[data-mascot-remove]')){request++;assets=[];enabled=false;allowCover=false;render();}});
  async function captureMedia(out,src){
    const saved=[];let serial=0;
    for(const path of Object.keys(out.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p))){
      const doc=xmlDoc(await out.file(path).async('string'),path),relPath=path.replace('slides/','slides/_rels/')+'.rels';if(!out.file(relPath))continue;
      const rel=xmlDoc(await out.file(relPath).async('string'),relPath);let changed=false;
      for(const pic of xmlList(doc,'pic')){
        if(!xmlList(pic,'cNvPr').some(n=>n.getAttribute('descr')==='吉祥物圖片'))continue;
        const blip=xmlList(pic,'blip')[0],id=blip?.getAttribute('r:embed');const link=xmlList(rel,'Relationship').find(n=>n.getAttribute('Id')===id);if(!link)continue;
        const original='ppt/media/'+link.getAttribute('Target').split('/').pop();if(!out.file(original))throw Error('吉祥物圖片資源遺失，請重新上傳');
        const ext=original.split('.').pop();let dest;do{dest='ppt/media/mascot_asset_'+(++serial)+'.'+ext;}while(src.file(dest)||out.file(dest));
        saved.push({dest,bytes:await out.file(original).async('uint8array')});link.setAttribute('Target','../media/'+dest.split('/').pop());changed=true;
      }
      if(changed)out.file(relPath,new XMLSerializer().serializeToString(rel));
    }
    return ()=>saved.forEach(v=>out.file(v.dest,v.bytes));
  }
  let aiCache=null;
  function aiSnapshot(s,idx){
    const stamp=JSON.stringify([request,allowCover,s,idx,curStyle(),assets.map(a=>[a.name,a.role]),S.templateRevision]);
    if(aiCache&&aiCache.stamp===stamp&&aiCache.template===S.pptTemplate)return aiCache;
    const copy=JSON.parse(JSON.stringify(s));delete copy.mascotPlacement;delete copy.mascotHidden;
    const candidates=assets.flatMap((a,assetIndex)=>{
      if(s.layout==='cover'&&a.role!=='brand')return [];
      const options=computePlacement(copy,idx,a,true);if(!Array.isArray(options))return [];
      const near=options.map(p=>({...p,distance:Math.min(...p.targets.map(t=>Math.hypot(Math.max(t.x-p.box.x-p.box.w,p.box.x-t.x-t.w,0)/p.W,Math.max(t.y-p.box.y-p.box.h,p.box.y-t.y-t.h,0)/p.H)))})).filter(p=>p.distance<.22).sort((a,b)=>a.distance-b.distance);
      // Keep options on both sides; the AI chooses a content target and a facing direction.
      const selected=[...near.filter(p=>p.box.x+p.box.w/2<p.W/2).slice(0,8),...near.filter(p=>p.box.x+p.box.w/2>=p.W/2).slice(0,8)];
      return selected.map(p=>({assetIndex,box:p.box,W:p.W,H:p.H,targets:p.targets,placement:{assetIndex,x:p.box.x/p.W*100,y:p.box.y/p.H*100,width:p.box.w/p.W*100}}));
    });
    return aiCache={assets:assets.map(a=>({...a})),candidates,stamp,template:S.pptTemplate};
  }
  return {panel,editorPanel,html,add,placement,captureMedia,purpose,aiSnapshot,context,notify};
})();

async function throttle(){
  const gap = Number(S.cfg.gapMs)||0;
  if(!gap) return;
  const wait = lastCall + gap - Date.now();
  if(wait>0){
    for(let left=Math.ceil(wait/1000); left>0; left--){
      if(S.busy) toast(String(S.busy).replace(/（.*?）$/,'')+'（等 '+left+' 秒，避開免費額度上限）');
      await sleep(1000);
    }
  }
  lastCall = Date.now();
}

async function ask(system, text, img, options){
  let lastErr;
  for(let attempt=0; attempt<3; attempt++){
    await throttle();
    try{ const out = await askOnce(system,text,img,options); bumpUsage(); return out; }
    catch(e){
      lastErr = e;
      if(!e.retryable || attempt===2) throw e;
      const wait = 20*(attempt+1);
      for(let left=wait; left>0; left--){
        toast('額度滿了，'+left+' 秒後再試一次');
        await sleep(1000);
      }
    }
  }
  throw lastErr;
}

async function askOnce(system, text, img, options){
  const c = S.cfg;
  options=options||{};
  const proto = (PROVIDERS[c.provider]||{}).proto || 'openai';
  if(!c.key && c.provider!=='ollama' && proto!=='proxy') throw new Error('還沒設定 API 金鑰，請點右上角「設定」。');
  const mt = Number(c.maxTokens)||2000;
  let url, headers, body, pick;

  if(proto==='proxy'){
    if(!c.base) throw new Error('課程模式尚未設定伺服器網址，請聯絡主辦方，或到設定改用其他方式。');
    url = c.base.replace(/\/$/,'');
    headers = {'content-type':'application/json','x-course-code':c.key||''};
    body = {model:c.model, system, text, maxTokens:mt, image:img||null};
    pick = d => d.text||'';

  }else if(proto==='anthropic'){
    url = c.base.replace(/\/$/,'')+'/v1/messages';
    headers = {'content-type':'application/json','x-api-key':c.key,
      'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};
    const content = img
      ? [{type:'image',source:{type:'base64',media_type:img.media,data:img.b64}},{type:'text',text}]
      : text;
    body = {model:c.model,max_tokens:mt,system,messages:[{role:'user',content}]};
    pick = d => (d.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');

  }else if(proto==='openaiResponses'){
    url = c.base.replace(/\/$/,'')+'/responses';
    headers = {'content-type':'application/json','authorization':'Bearer '+c.key};
    const content = img
      ? [{type:'input_text',text},{type:'input_image',image_url:'data:'+img.media+';base64,'+img.b64}]
      : [{type:'input_text',text}];
    body = {model:c.model,instructions:system,input:[{role:'user',content}],max_output_tokens:mt,store:false};
    pick = d => d.output_text || (d.output||[]).filter(x=>x.type==='message')
      .flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text||'').join('\n');

  }else if(proto==='openai'){
    url = c.base.replace(/\/$/,'')+'/chat/completions';
    headers = {'content-type':'application/json','authorization':'Bearer '+(c.key||'ollama')};
    const content = img
      ? [{type:'text',text},{type:'image_url',image_url:{url:'data:'+img.media+';base64,'+img.b64}}]
      : text;
    body = {model:c.model,max_tokens:mt,messages:[{role:'system',content:system},{role:'user',content}]};
    pick = d => (((d.choices||[])[0]||{}).message||{}).content||'';

  }else{
    /* 瀏覽器直連 Gemini 時用查詢參數傳金鑰，避免 GitHub Pages 的 CORS 預檢
       因 x-goog-api-key 自訂標頭而被瀏覽器擋下。 */
    url = c.base.replace(/\/$/,'')+'/v1beta/models/'+encodeURIComponent(c.model)+':generateContent?key='+encodeURIComponent(c.key);
    headers = {'content-type':'application/json'};
    const parts = img ? [{inline_data:{mime_type:img.media,data:img.b64}},{text}] : [{text}];
    const generationConfig={maxOutputTokens:mt,temperature:Number.isFinite(options.temperature)?options.temperature:0.7};
    /* 本工具仍使用 generateContent REST 端點。responseFormat 是新版模型才逐步支援的
       格式；部分 Flash／Flash-Lite 會直接回 HTTP 400。generateContent 的相容欄位
       responseMimeType + responseSchema 支援範圍較廣，圖表規格先使用這組格式。 */
    if(options.jsonSchema){
      generationConfig.responseMimeType='application/json';
      generationConfig.responseSchema=options.jsonSchema;
    }
    body = {systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts}],generationConfig};
    pick = d => (((d.candidates||[])[0]||{}).content||{}).parts?.map(p=>p.text||'').join('')||'';
  }

  let res;
  try{
    res = await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});
  }catch(e){
    if(c.provider==='ollama') throw new Error('連不上本機 Ollama。請確認它正在執行，並且已設定 OLLAMA_ORIGINS=* 允許瀏覽器呼叫。');
    if(proto==='proxy') throw new Error('連不上課程伺服器，請確認網路，或稍後再試。');
    throw new Error('連不上這個服務。可能是網路問題，也可能是它不允許瀏覽器直接呼叫。');
  }
  /* Gemini 會不定期調整可用模型；舊瀏覽器也可能在 localStorage 留著已下架的模型名稱。
     收到 404 時，先依這把金鑰實際看得到的 models 清單選一個文字生成模型，再自動重試一次。 */
  if(!res.ok && res.status===404 && proto==='gemini'){
    try{
      const listUrl=c.base.replace(/\/$/,'')+'/v1beta/models?pageSize=1000&key='+encodeURIComponent(c.key);
      const listRes=await fetch(listUrl);
      if(listRes.ok){
        const data=await listRes.json();
        const available=(data.models||[])
          .filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent'))
          .map(m=>String(m.name||'').replace(/^models\//,''))
          .filter(Boolean);
        const preferred=[...(PROVIDERS.gemini.models||[]),...available.filter(m=>/flash/i.test(m)),...available];
        const next=preferred.find(m=>m!==c.model && available.includes(m));
        if(next){
          c.model=next;
          persistCfg();
          url=c.base.replace(/\/$/,'')+'/v1beta/models/'+encodeURIComponent(next)+':generateContent?key='+encodeURIComponent(c.key);
          res=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});
        }
      }
    }catch(e){ /* 保留原始 Gemini 回應，交給下面的錯誤處理顯示 */ }
  }
  if(!res.ok){
    let detail='';
    try{ const j=await res.json();
      detail = typeof j.error==='string' ? j.error : ((j.error&&(j.error.message||j.error.type))||''); }catch(e){}
    if(res.status===401||res.status===403) throw mkErr(proto==='proxy'
      ? (detail||'通行碼不正確，請向課程主辦方索取。')
      : ('金鑰無效或沒有權限。'+(detail?'（'+detail+'）':'')));
    if(proto==='proxy' && detail) { const e=mkErr(detail); e.retryable = res.status===429||res.status>=500; throw e; }
    if(res.status===429){
      const e = mkErr('叫得太頻繁，或今天的免費額度用完了。'+(detail?'（'+detail+'）':''));
      e.retryable = true; throw e;
    }
    if(res.status>=500){ const e=mkErr('對方的服務暫時出問題（HTTP '+res.status+'）。'); e.retryable=true; throw e; }
    if(res.status===404) throw mkErr(proto==='gemini'
      ? 'Google 找不到「'+c.model+'」或這把金鑰無法使用該模型。已嘗試自動尋找可用模型仍失敗。'+(detail?'（'+detail+'）':'')
      : '服務找不到「'+c.model+'」或目前帳號無法使用此模型。'+(detail?'（'+detail+'）':''));
    throw mkErr('模型回應失敗 HTTP '+res.status+(detail?'：'+detail:''));
  }
  const out = pick(await res.json());
  if(!out) throw mkErr('AI 沒有回內容，再試一次，或換一個模型。');
  return out;
}

function mkErr(m){ return new Error(m); }

function parseJSON(raw,source){
  let t = String(raw).replace(/```json/gi,'').replace(/```/g,'').trim();
  t = t.replace(/^[\s\S]*?(?=[\[{])/,'');                    // 丟掉前面的贅語
  t = t.replace(/<think>[\s\S]*?<\/think>/gi,'').trim();      // 丟掉推理模型的思考段
  const end = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
  if(end>-1) t = t.slice(0,end+1);
  const tries = [
    t,
    t.replace(/,\s*([\]}])/g,'$1'),                           // 尾逗號
    t.replace(/,\s*([\]}])/g,'$1').replace(/[""]/g,'"').replace(/['']/g,"'"),
    closeBrackets(t.replace(/,\s*([\]}])/g,'$1'))             // 被截斷時補回括號
  ];
  for(const x of tries){ try{ return JSON.parse(x); }catch(e){} }
  if(source==='manual') throw new Error('貼上的內容格式無法解析。請確認內容完整，並重新複製 AI 回覆後再貼上。');
  throw new Error('AI 回的格式不對，通常是輸出被截斷或模型沒有依指定格式回答。可以調高輸出上限、減少頁數，或換一個模型。');
}

function closeBrackets(t){
  let out='', inStr=false, esc=false; const stack=[];
  for(const ch of t){
    if(esc){ esc=false; out+=ch; continue; }
    if(ch==='\\'&&inStr){ esc=true; out+=ch; continue; }
    if(ch==='"'){ inStr=!inStr; out+=ch; continue; }
    if(!inStr){
      if(ch==='['||ch==='{') stack.push(ch==='['?']':'}');
      else if(ch===']'||ch==='}') stack.pop();
    }
    out+=ch;
  }
  if(inStr) out+='"';
  out = out.replace(/,\s*$/,'').replace(/:\s*$/,':null');
  while(stack.length) out += stack.pop();
  return out;
}

function chunkText(text,size){
  size = size||480;
  const out=[]; let buf='';
  String(text).replace(/\r/g,'').trim().split(/\n{2,}/).forEach(p=>{
    if((buf+p).length>size && buf){ out.push(buf.trim()); buf=''; }
    if(p.length>size){ for(let i=0;i<p.length;i+=size) out.push(p.slice(i,i+size)); }
    else buf += p+'\n\n';
  });
  if(buf.trim()) out.push(buf.trim());
  return out.filter(c=>c.length>20);
}

function bigrams(s){
  const t=String(s).toLowerCase().replace(/[\s.,;:!?、，。；：！？()「」【】]/g,'');
  const o=[]; for(let i=0;i<t.length-1;i++) o.push(t.slice(i,i+2)); return o;
}

function allChunks(){
  const sources=[...(S.materials||[])];
  if(manualBrief()) sources.push({name:'使用者直接輸入',text:manualBrief()});
  activeUploads().forEach(u=>sources.push({name:u.name,text:u.text||''}));
  const seen=new Set(), out=[];
  sources.forEach(m=>chunkText(m.text).forEach((t,i)=>{
    const key=String(m.name||'')+'\n'+t;
    if(seen.has(key)) return;
    seen.add(key); out.push({text:t,src:m.name||'素材',i});
  }));
  return out;
}

function retrieve(chunks,q,k){
  k=k||3; if(!chunks.length) return [];
  const g=[...new Set(bigrams(q))]; if(!g.length) return [];
  return chunks.map(c=>{
    const low=c.text.toLowerCase(); let sc=0;
    g.forEach(x=>{ if(low.includes(x)) sc++; });
    return Object.assign({},c,{score:sc/g.length});
  }).filter(c=>c.score>0.05).sort((a,b)=>b.score-a.score).slice(0,k);
}

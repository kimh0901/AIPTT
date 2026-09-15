/* Explicit template lifecycle service. No global function replacement.
 * Parsing remains in the existing parser pipeline. Only this service commits
 * uploads and invalidates template-dependent state. Content and chart data stay intact.
 */
const TemplateSession=(()=>{
  let request=0,storeQueue=Promise.resolve();
  const fields=['designIndex','templateLayoutPath','templateArea','templateMode','templateFitMode',
    'templateAutoDesignIndex','templateAutoSafeFor','templatePlainLayoutFor','templateSafeDesignIndex'];
  const clone=v=>JSON.parse(JSON.stringify(v));
  async function identify(file){
    const buffer=await file.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',buffer);
    return {buffer,key:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')};
  }
  function invalidate(){
    DESIGN_ASSIGN={};
    S.wizardPreviewCache=null;S.lastTemplatePreviewError='';
    S.templateRevision=(S.templateRevision||0)+1;
  }
  function commit(template,key){
    const old=S.pptTemplate,oldKey=old?.sessionKey;
    const archive=S.templateSessionEdits||(S.templateSessionEdits={});
    if(old&&oldKey!==key){
      if(oldKey)archive[oldKey]=Object.fromEntries(S.slides.map(s=>[s.id,Object.fromEntries(fields.filter(f=>s[f]!==undefined).map(f=>[f,clone(s[f])]))]));
    }
    if(oldKey!==key){
      for(const s of S.slides){
        // On first upload, also drop stale assignments restored from a different project.
        fields.forEach(f=>delete s[f]);
        if(archive[key]?.[s.id])Object.assign(s,clone(archive[key][s.id]));
      }
    }
    const wasPreview=typeof previewSession!=='undefined'&&previewSession;
    const fromWizard=wasPreview?.wizard;
    if(wasPreview)pClose();
    template.sessionKey=key;S.pptTemplate=template;
    S.templatePrefs={name:template.name,key,mapping:template.mapping};
    S.tplPreview=true;invalidate();
    if(S.view==='editor')S.tab='style';
    saveDraft();render();
    if(wasPreview)present(fromWizard);
  }
  async function upload(file){
    const token=++request;toast('讀取 PowerPoint 母片');
    try{
      const identified=await identify(file);
      const template=await parsePptTemplate(file);
      if(token!==request)return {stale:true};
      commit(template,identified.key);
      // Serialize persistence so an older write cannot finish after a newer upload.
      storeQueue=storeQueue.catch(()=>{}).then(async()=>{
        if(token===request)await idbTemplate('put',{name:file.name,buffer:identified.buffer});
      });
      try{await storeQueue;}catch(e){if(token===request)toast('母片已套用，但瀏覽器無法保存；下次請重新上傳。');return {saved:false};}
      if(token===request){
        const caution=template.placeholderFit===false||template.structureMode==='theme';
        const message=caution?'母片已更新；部分版面需人工確認，請檢查預覽。':'母片已更新，已重新計算預覽；文字與圖表資料保持不變。';
        toast(message);
        setTimeout(()=>{if(token===request&&S.busy===message&&!S.err)done();},2600);
      }
      return {saved:true};
    }catch(e){if(token===request)fail(e.message||'母片讀取失敗，原模板仍保留');return {error:true};}
  }
  return {upload,invalidate,identify};
})();

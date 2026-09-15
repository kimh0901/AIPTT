/* Presentation only: no slide state, template geometry or export dependencies. */
const MascotUI=(()=>{
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function panel({assets,enabled,scope,allowCover,roles,results,count,editor='',autoExpanded=false}){
    return `<section class="mascot-ui" aria-label="吉祥物圖片設定">
      <h3>吉祥物圖片（選用）</h3>
      <p>在逐頁微調選擇左側投影片，上傳圖片後取得 AI 建議或手動套用，再按「整份預覽」檢查結果。</p>
      <h4>1. 上傳圖片</h4>
      <label class="mascot-ui__upload"><span>加入 PNG／JPG 圖片</span><span class="mascot-ui__help">不限制張數，可分批追加，不取代已配置的圖片；保留角色檔名，例如 DEN_衝刺、阿光_結尾</span><input data-mascot-upload multiple type="file" accept="image/png,image/jpeg"></label>
      <p role="status">${assets.length?'已載入 '+assets.length+' 張圖片。接著選擇下方套用方式。':'尚未上傳圖片。建議使用透明背景 PNG。'}</p>
      <div class="mascot-ui__actions">${assets.map((a,i)=>'<img src="'+escape(a.data)+'" alt="已載入圖片 '+(i+1)+'：'+escape(a.name)+'" style="width:64px;height:64px;object-fit:contain">').join('')}</div>
      ${assets.length?'<h4>2. 選擇套用方式</h4>'+ (editor||'<p>完成風格設定並進入編輯器後，即可選擇投影片並按「套用到本頁」。現在也可先設定自動套用。</p>'):''}
      <details class="mascot-ui__advanced" ${enabled||autoExpanded?'open':''}><summary>自動套用多頁${enabled?'（已開啟）':''}</summary>
      <p>這裡是本機關鍵詞與留白配置，不會呼叫 AI。需要角色方向、道具與內容互動或 Q&A 雙角色時，請在本頁選「AI 建議圖片與位置」。單頁手動套用可直接選擇任何圖片。</p>
      <div class="mascot-ui__assets">${assets.map((a,i)=>`<div class="mascot-ui__asset"><img src="${escape(a.data)}" alt="吉祥物 ${i+1} 預覽"><div class="mascot-ui__asset-info"><div>${escape(a.name)}</div><label class="mascot-ui__field"><span>圖片用途</span><select data-mascot-role="${i}">${Object.entries(roles).map(([v,label])=>`<option value="${v}" ${a.role===v?'selected':''}>${escape(label)}</option>`).join('')}</select></label></div></div>`).join('')}</div>
      <label class="mascot-ui__check"><input data-mascot-enable type="checkbox" ${enabled?'checked':''} ${assets.length?'':'disabled'}><span>啟用吉祥物自動放置</span></label>
      <label class="mascot-ui__field"><span>套用頁面</span><select data-mascot-scope><option value="closing" ${scope==='closing'?'selected':''}>只在結尾頁（建議）</option><option value="all" ${scope==='all'?'selected':''}>各頁依用途與安全留白配對</option></select></label>
      <label class="mascot-ui__check"><input data-mascot-cover type="checkbox" ${allowCover?'checked':''}><span>明確允許封面使用「品牌封面」圖片（不套用其他用途）</span></label>
      </details>
      ${assets.length?'<h4>3. 預覽與確認</h4><p>目前顯示 '+count+'／'+results.length+' 頁。到畫布檢查位置；可在風格或圖表分頁調整本頁，也可選「本頁不放圖片」。</p>':''}
      ${assets.length?'<button class="mascot-ui__remove" type="button" data-mascot-remove>移除全部圖片</button>':''}
      <p>單張上限 3 MB，不設張數或整組容量上限；大量圖片仍受瀏覽器記憶體限制，建議分批加入。只保留於本次工作階段，重新開啟需重新上傳。請準備已去背、有授權的 PNG；不自動去背、翻轉或裁切。PPTX 中保留可移動、縮放、替換的圖片。</p>
      <details><summary>逐頁視覺檢查（需人工確認）</summary><p>一般頁寬 12–17%；診斷、警告、行動或成果頁寬 18–23%；雙結尾合計 25–35%。沒有足夠留白就略過，不更動原文。保護距離以 1280 px 畫布的 30 px 等比例計算。</p><p>請逐頁確認：表情與道具清楚、語意相符、方向朝內容、沒有遮擋文字或圖表、遠離 Logo／頁碼／版權、沒有白黑底或去背殘留、沒有拉伸裁切、姿態不過度重複，並保持母片商務風格。這不是自動視覺驗證通過的宣告。</p></details>
      ${results.length?`<details><summary>目前可放置 ${count}／${results.length} 頁</summary>${results.map((r,i)=>`<p>第 ${i+1} 頁：${r.box?'使用 '+escape(r.asset.name)+(r.warning?'（'+escape(r.warning)+'）':''):escape(r.reason)}</p>`).join('')}</details>`:''}
    </section>`;
  }
  return {panel};
})();

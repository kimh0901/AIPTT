# lib 資料夾（選用）

平台預設從網路載入下列程式庫。**一般情況這個資料夾可以留空。**

如果貴單位的網路擋掉 jsdelivr、unpkg 與 cdnjs，把對應的檔案放進這個資料夾，平台就會改讀本機的，完全不連外。

## 要放哪些檔案

只需要放你會用到的功能所對應的檔案。

| 檔案 | 對應功能 | 下載網址 |
|---|---|---|
| `pptxgen.bundle.js` | 匯出 PowerPoint | https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js |
| `mammoth.browser.min.js` | 解析 Word | https://cdn.jsdelivr.net/npm/mammoth@1.9.0/mammoth.browser.min.js |
| `xlsx.full.min.js` | 解析 Excel | https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js |
| `pdf.min.js` | 解析 PDF、擷取風格 | https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js |
| `pdf.worker.min.js` | 同上（必須一起放） | https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js |

用一台能連外的電腦開啟網址，按 Ctrl+S 另存新檔，檔名保持原樣。

## 確認有沒有生效

平台右上角「設定」→ 最下面「外部程式庫」→ 按「檢查連線」。成功時會顯示來源是「本機 lib 資料夾」。

## 注意

用 `file://` 直接雙擊開啟頁面時，瀏覽器可能不允許讀取同資料夾的 js 檔。請改從 GitHub Pages、內部網站，或本機的 `python -m http.server` 開啟。

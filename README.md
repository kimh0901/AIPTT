# 簡報生成器 GitHub Pages 版

2026-09-09 匯出提醒版。由 GitHub Pages 驗證版另存，僅調整匯出排版警告，無須 npm 或伺服器後端。

## 部署

1. 解壓縮套件，將裡面的檔案與資料夾上傳至自己的 GitHub repository 根目錄。必須直接看到 index.html、assets、lib、layout-safety.js、template-reliability.js，不要只上傳 ZIP，也不要多包一層資料夾。
2. 在 repository 的 Settings → Pages，Source 選 Deploy from a branch。
3. Branch 選 main（或實際上傳的分支），資料夾選 / (root)，按 Save。
4. 等待 GitHub 部署成功，使用 Pages 顯示的網址。更新後若仍見舊畫面，按 Ctrl+F5。

官方說明：https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

保留 .nojekyll，assets 與 lib 的檔名大小寫及路徑不可修改。使用組織帳號時可能需管理員允許 Pages。

## 資料與金鑰

- 不要把個人 API 金鑰、Excel、原始簡報、內部文件或瀏覽器草稿上傳 GitHub。此套件不含測試用原始文件。
- 使用者在網站自行輸入金鑰；純前端網站不能安全保存供所有人共用的秘密金鑰。
- 檔案解析可在瀏覽器進行。使用 AI 功能時，提示與相關素材會傳送至設定的 AI 供應商，請先確認資料可外傳。不要誤認為「檔案本機解析」代表 AI 完全不連外。
- GitHub Pages 只提供網站，不提供 AI 額度，也不會自動解決供應商模型、金鑰權限或 CORS 問題。
- 瀏覽器草稿不等於雲端同步。從 file:// 換到 Pages 網址時，可能需要重新上傳母片及素材。

## 使用限制

請參閱 QA-REPORT.md。複雜向量、SmartArt、缺少字型、動畫與特殊母片不保證完整預覽。文字溢出、重疊等排版風險不再阻擋匯出：下載開始後顯示需人工微調的頁碼（依匯出後的續頁頁序）。不修改原文或自動保證修復，請在 PowerPoint 核對。無效區域、檔案損壞及打包錯誤仍會攔下。

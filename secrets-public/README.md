# secrets-public — 公開發布版內建憑證

這個資料夾的 `*.json` 會被 `electron-builder.public.yml` 的 extraResources
打包進 **公開發布版** 安裝檔的 `resources/secrets/`，讓使用者免自填憑證
（設定頁顯示「內建檔案」）。**測試版（electron-builder.yml）不會打包這裡。**

## 規則

1. `*.json` 已被 .gitignore 排除，絕不進版控。
2. 只放「可公開發行」的 production 憑證：
   - `google_oauth.json` — Google 驗證通過後的 client（installed app 的
     client_secret 在桌面 app 本來就視為非機密）
   - `meta_oauth.json` / `threads_oauth.json` — ⚠ 內建等於可被解包提取，
     公開發布前建議先 rotate app_secret（舊 secret 曾隨早期安裝檔外洩過）
   - `tiktok_oauth.json` — **先不要放**：目前只有 sandbox 憑證（只有
     Target Users 能用），等 TikTok 正式審核過、拿到 production 憑證再放
3. 使用者若在設定頁貼自己的憑證，DB 優先於內建檔案。

## 發布流程

- 測試版（先發）：`npm run release:win` → repo puffinpuff → 你自己的 app 自動更新
- 公開版（確認後才發）：`npm run release:public` → repo puffinpuff-releases

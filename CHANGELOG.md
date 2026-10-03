# 海鸚泡芙 PuffinPuff｜變更紀錄

格式參照 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

---

## v0.9.11 — 2026-10-03 — Threads 全面退出本次 App Review

### 🎯 決策
Threads 功能與權限全部退出本次審查，先專注 FB / IG 上線：
- App Review 提交中移除 `threads_basic`、`threads_content_publish`
  （加上前次移除的 `threads_manage_insights`，threads 權限已全數退出）
- Meta 後台的「存取 Threads API」使用案例無法刪除（新版後台無此入口、
  必要權限不可單獨移除），但它處於未申請狀態，不影響審核與上線
- `THREADS_UI_ENABLED` 關回 false（v0.9.10 短暫開啟過）
- 拍攝腳本 v2：移除 Threads 場景，審查影片只需 4 個場景（3-5 分鐘）

### 📋 本次送審權限（8 個，全 FB/IG）
pages_manage_posts / pages_read_engagement / pages_show_list /
instagram_basic / instagram_content_publish / business_management /
public_profile / Business Asset User Profile Access

### 底層保留
threadsAdapter / threadsOAuth / IPC / DB schema 不動，日後翻 flag 即可重啟。

---

## v0.9.10 — 2026-10-03 — 重新開啟 Threads UI（App Review 錄影需要）

### 🎯 背景
Meta App Review 提交進行中（2026-10-03）：
- 商家與存取權驗證已通過（李白廬商行）
- 10 個權限的用途說明已填寫完成
- 資料處理問卷完成、網站平台已新增
- 已從提交中移除未使用的 instagram_manage_messages 與未實作的 threads_manage_insights

審核需要螢幕錄影示範 threads_basic / threads_content_publish 的實際操作，
因此重新開啟 v0.7.3 關閉的 Threads UI。

### 🔧 變更
- `FEATURE_FLAGS.THREADS_UI_ENABLED`：false → **true**
  （帳號頁 Threads 卡片、發布頁 Threads chip / 分頁恢復顯示）
- 新增 `審查錄影/` 資料夾：
  - `開始錄影.bat` — 用內建 ffmpeg 錄全螢幕（15fps、按 q 停止）
  - `拍攝腳本.md` — App Review 示範影片逐場景拍攝指引

### ⚠ Threads OAuth 注意
v0.7.x 時 Threads OAuth 曾卡在「登入後跳首頁」。現在商家驗證已通過 +
Meta 端 propagation 時隔數月應已完成，本版重新開放測試；若仍卡住，
就把 threads 兩權限也從本次 App Review 移除，待日後補申請。

---

## v0.9.9 — 2026-07-21 — 歷史頁加「清空歷史」按鈕

### 🔧 變更
- 歷史頁右上角新增「清空歷史」按鈕（紅色、有紀錄時才顯示）
- 一鍵刪除所有歷史紀錄（成功 / 失敗 / 草稿），**保留「已排程、尚未發布」的項目**
- 確認對話框顯示總筆數 + 明確警告不可復原
- 已發布到平台上的內容不受影響（只清本機紀錄）
- 沿用既有 `system:clearHistory` IPC（設定頁的清理功能同源）

---

## v0.9.8 — 2026-07-21 — 側欄版本號改動態顯示

### 🐛 問題
側欄品牌頭下方的版本 badge 從 v0.1.0 起就寫死「v0.1.0 開發中」，
升級 20 多版從來沒變過；設定頁「關於」的版本號是動態的，兩處不一致。

### 🔧 修正
- Sidebar badge 改用 `system:getVersion` 動態抓真實版本（跟「關於」同一來源）
- 拿掉「開發中」字樣 — 顯示如 `v0.9.8`
- 之後每次升版側欄自動跟著變，不用再手動改

---

## v0.9.7 — 2026-07-21 — Meta token 清理功能

### 🎯 情境
同一個 FB 使用者換密碼 / 重新連結後，「Meta 連線自動續期」會留下失效的舊 token 列
（每 24 小時 refresh 都報錯 "The session has been invalidated because the user changed
their password..."），無法移除、永遠佔版面 + 一直報錯。

### 🔧 變更
- 每筆 token 卡片右側新增「🗑 刪除」按鈕（含確認對話框）
- 只移除自動續期的追蹤紀錄，**不影響已連線的 FB / IG 帳號**
- 新 IPC：`system:deleteMetaUserToken(fbUserId)`
- 刪除後列表即時更新

---

## v0.9.6 — 2026-07-21 — 「週」檢視一併改清單邏輯

### 🎯 變更
承 v0.9.5「天」改清單式：**「週」也改成清單** — 列出未來 7 天所有排程時間點，
一行一筆（日期 + 時間 + 標題），24 小時時間格線（DAY / WEEK grid）完全移除。

```
7/21 – 7/27
──────────────────────────────────────
日期          時間     排程
7/21（一）   18:00   【勞資領航者…】以為責任制就能無…
7/21（一）   20:00   【勞資領航者…】員工出事老闆能切…
7/22（二）   11:00   【勞資領航者…】全公司都知道他有…
...
```

### 實作
- 自訂工具列：`今天 ◀ ▶` + `天 / 週 / 月` 三顆按鈕（Mantine 樣式）
- 天、週共用 AGENDA 清單檢視，只差涵蓋天數（`length` = 1 或 7）
- 標題自動切換：單日顯示「M 月 D 日（星期X）」、週顯示「M/D – M/D」
- 月檢視維持格狀月曆不變
- 點任一行照樣開排程詳情

---

## v0.9.5 — 2026-07-21 — 「天」檢視改清單邏輯（只顯示有排程的時間點）

### 🎯 呈現邏輯改變
v0.9.3 / v0.9.4 兩次修 24 小時格線都無效 → 放棄格線，改變呈現邏輯：

**「天」檢視 = 清單式 agenda** — 只列出當天有排程的時間點，一行一筆：
```
時間     排程
18:00   【勞資領航者｜企業軍師 林郁汶】以為責任制就能無…
20:00   【勞資領航者｜企業軍師 林郁汶】員工出事老闆能切…
21:00   【勞資領航者｜企業軍師 林郁汶】用錯一個人比貪汙…
```

### 優點
- 沒有空白時段佔畫面 — 3 筆排程就 3 行，一眼看完
- 純表格排版，無絕對定位 → 不可能再出現「事件黏底部」「捲不到」問題
- 點任一行照樣開啟排程詳情（重新排程 / 取消 / 預覽）
- 沒排程時顯示「此區間沒有排程」

### 變更
- 「天」按鈕 → RBC AGENDA 檢視（`length={1}` 單日）
- 時間欄只顯示起始時間點（HH:mm）
- agenda 表格套馬卡龍主題（hover 高亮、時間欄 mint 色）
- 週 / 月檢視維持原樣

---

## v0.9.4 — 2026-07-20 — 排程日/週檢視根因修正（CSS overflow 破壞 rbc 定位）

### 🎯 真正的根因（v0.9.3 沒修到）
`globals.css` 的馬卡龍主題把 `overflow: hidden` 同時蓋到
`.rbc-month-view / .rbc-time-view / .rbc-time-header` 三個容器上。
月檢視沒事，但**日/週檢視（time-view）的內部結構被破壞**：
- 事件的絕對定位鏈（day column → events container → event）被打斷
- 事件全部被「黏」在容器底部疊成一條橫列，跟實際時段脫鉤
- 捲動範圍異常，晚間 18:00-21:00 排程永遠看不到

### 🩹 修正
- `.rbc-time-view` 改用 `overflow: clip`（只裁圓角、不干擾內部定位）
- `.rbc-time-header` 拆出獨立規則（無 overflow hidden）
- 強制還原 rbc 標準規則：
  - `.rbc-time-content` = 唯一垂直捲動容器（`overflow-y: auto` + `flex: 1`）
  - `.rbc-time-column` / `.rbc-day-slot` = `position: relative`
  - `.rbc-events-container` = `position: absolute; inset: 0`
  - `.rbc-day-slot .rbc-event` = `position: absolute`

### 結果
日/週檢視事件回到正確時段位置、全天 00:00-23:59 可完整捲動（搭配 v0.9.3 的自適應高度 + 預設捲到 8:00）。

---

## v0.9.3 — 2026-07-20 — 排程月曆卷軸修正（晚間排程看不到）

### 🐛 症狀
排程頁日/週檢視：月曆容器寫死 720px 高，時間軸捲不到底，
晚上 18:00-21:00 的排程被擠壓在底部邊緣顯示不完整。

### 🩹 修正
- **容器高度自適應**：`720px` 固定值 → `calc(100vh - 230px)`（最小 640px），大螢幕直接看到更多時段
- **時間軸開放全天**：原本限 6:00 起（且基準日期用「今天」而非檢視日期，切日期後對位異常）
  → 改為 00:00-23:59 完整時間軸，基準日期跟著當前檢視日期走
- **預設捲動位置**：開日/週檢視自動捲到早上 8:00（`scrollToTime`），要看凌晨往上捲即可

---

## v0.9.2 — 2026-07-20 — 平台錯開序列發布（防 port 佔用機制）

### 🎯 變更
多平台一鍵發布從「並聯同時發」改為「**錯開序列發**」：

```
舊：IG ┐
    FB ├─ 同時開跑（tunnel port 競爭風險）
    YT ┘

新：IG（吃 tunnel/port）→ 完成 → 清 port → 等 30 秒
    → FB → 完成 → 等 30 秒
    → YT Shorts → 完成
    →（Threads 若啟用則最後）
```

### 規則
- **固定順序**：Instagram（唯一需要 tunnel/port 的平台）最先 → Facebook → YouTube Shorts → Threads
- **每平台完全結束才發下一個**（含 tunnel 關閉 = 清 port）
- **平台間等 30 秒**：讓 OS 完全釋放 socket（quick tunnel 的 TIME_WAIT 徹底消化）
- 取消發布時跳過等待，立即中止後續平台

### 影響
- 三平台總時長增加約 60 秒（2 段等待），換取 port 零競爭
- 單一平台發布行為不變（沒有等待）
- 進度卡片顯示順序執行：完成一個亮一個，其餘顯示「排隊中」

---

## v0.9.1 — 2026-07-19 — 安裝檔不再 bundle secrets（安全修正）

### 🔒 安全事件與處置
- **事件**：repo 公開後，GitHub Releases 的安裝檔（v0.6.9-v0.9.0）含 `secrets/*.json`
  （meta / threads app_secret 可被任何下載者讀取）
- **處置**：
  1. 已刪除全部 11 個公開 Release 的安裝檔資產（tag + 原始碼保留；git history 無 secret 實值）
  2. v0.9.1 起 electron-builder **不再把 secrets 打進安裝檔**
  3. app_secret 旋轉由使用者至 Meta Dashboard 執行（見升級步驟）

### 🔧 變更
- `electron-builder.yml`：`files` 與 `asarUnpack` 移除 `secrets/*.json`
- 憑證來源（v0.9.0 架構不變）：
  - 打包版：設定頁「OAuth 憑證」貼入 → DPAPI 加密存 DB
  - dev 模式：仍讀專案 `secrets/` 資料夾（自動匯入 DB）

### 📋 升級步驟（既有使用者）
1. （建議先做）Meta Dashboard 旋轉 app_secret：App Settings → Basic → Reset App Secret；
   Threads 設定頁同樣 Reset
2. 安裝 v0.9.1（覆蓋安裝 — **AppData 資料不受影響**：帳號連線、排程、歷史、範本、通道設定全保留）
3. 開啟設定頁 → 「OAuth 憑證（自帶 App）」→ 三個 provider 各貼一次新的 credentials JSON
4. 之後所有機器都用同樣流程；安裝檔本身乾淨無機密

### 資料保全說明
- 使用者資料（DB / 快取）位於 `%APPDATA%\海鸚泡芙 PuffinPuff\`，安裝 / 升級 / 移除都不會刪除
  （NSIS `deleteAppDataOnUninstall: false`）
- 憑證 / token 均以 Windows DPAPI 加密，僅本機本使用者可解密

---

## v0.9.0 — 2026-07-19 — OAuth 憑證自帶（開源商用版第二塊拼圖）

### 🎯 目標
使用者自行提供 Google / Meta / Threads App credentials，
不再依賴開發者 bundle 的 `secrets/*.json`。開源使用者 clone 下來就能建置可用版本。

### 🔑 三層憑證來源（新架構）
```
1. DB oauth_credentials 表（使用者在設定頁貼的，DPAPI 加密）← 最優先
2. secrets/*.json 檔案（開發者本機 build 的 fallback）
   — 首次讀到時自動匯入 DB（一次性遷移）
3. 都沒有 → 友善錯誤指引到設定頁
```

### 🔧 變更
- **DB schema v12**：`oauth_credentials` 表（provider PK、encrypted_json DPAPI 加密）
- **新檔** `src/main/lib/credentialsStore.ts` — 中央憑證存取層 + 欄位驗證 + 遮罩摘要
- **重構 10 檔 13 個呼叫點**：googleOAuth / metaOAuth / threadsOAuth /
  youtubeAdapter / facebookAdapter / instagramAdapter / threadsAdapter /
  accountsHandlers / metaTokenRefresher / statsCollector — 全部改走 credentialsStore
- **新 IPC**：`credentials:getStatus / save / delete`
- **新 UI**：設定頁「OAuth 憑證（自帶 App）」卡片
  - 三區塊（Google / Meta / Threads），顯示設定狀態與來源（使用者提供 / 內建檔案）
  - 內嵌申請教學（Google Cloud Console / Meta Developer Dashboard 步驟）+ 貼 JSON 表單
  - 憑證僅存本機（DPAPI 加密），不上傳任何伺服器

### 📋 對現有使用者
- 完全無感 — secrets 檔案還在，首次啟動自動匯入 DB，之後 DB 優先
- 對開源使用者：clone → build（無 secrets 也能 build）→ 啟動後設定頁貼自己的 App credentials

### 規劃文件
`docs/v0.9.0_OAuth憑證自帶規劃.md`

---

## v0.8.1 — 2026-07-19 — Named Tunnel 本機 port 可設定化

### 🎯 目的
保障「本機發布」路線的長期可用性：v0.8.0 singleton 已根治 TIME_WAIT 佔用，
但若 port 33344 被**其他程式**長期佔走，過去只能改 code。現在 port 開放使用者設定。

### 為什麼不是「多 port 輪替」？
- singleton 架構下 port 只 bind 一次、永不釋放重綁 → 沒有「搶 port」動作，輪替要解的問題不存在
- Cloudflare ingress 固定指向一個 port（`localhost:33344`），輪替到別的 port，
  Cloudflare 流量還是導去舊 port → 抓不到檔案。多 port 需要多條 ingress 規則，複雜度高但無收益

### 🔧 變更
- 設定頁 Named Tunnel 區新增「本機 Port」欄位（預設 33344，範圍 1024-65535）
- 改 port 時提醒同步修改 Cloudflare dashboard 的 Service URL
- port 變更會自動重建常駐 singleton
- 新 IPC：`tunnel:setNamedLocalPort`；`tunnel:getNamedLocalPort` 改回傳設定值

---

## v0.8.0 — 2026-07-19 — 媒體通道抽象化（開源商用版基礎）

### 🎯 目標
根治高頻發布的 port 佔用與 cloudflared 通道不穩問題，並為開源商用版鋪路：
讓使用者自行選擇並設定自有發布通道。

### ☁️ 新功能一：雲端物件儲存通道（S3 相容，推薦）

IG / Threads 需要通道的唯一原因是 Meta 的 container API 要「公開 HTTPS URL」來抓檔案。
新通道直接把檔案上傳到**使用者自己的 bucket** → 給 Meta 抓 → 發完自動刪除：

- 支援 **Cloudflare R2**（免費 10GB + 零出流量費，推薦）/ AWS S3 / Backblaze B2 / MinIO（自架）
- **無本機 port** → port 佔用問題根治
- **無 cloudflared 進程** → spawn/kill/CLI bug 全部消失
- **無限並發**（每次上傳都是獨立 object key）
- 兩種 URL 模式：presigned（bucket 免公開、1 小時失效，預設推薦）/ 公開 URL 前綴
- Keys 用 Windows DPAPI 加密存 DB
- 設定頁內建 R2 五分鐘設定教學 + 一鍵測試連線（寫入/讀取/刪除全鏈驗證）

### 🔄 新功能二：Named Tunnel singleton 重構

舊設計每次上傳 spawn cloudflared + 開 server，用完 kill → socket TIME_WAIT → 高頻發布 port 被佔。
新設計：
- 整個 App 生命週期只有**一個常駐 server + 一個常駐 cloudflared**
- server 是多檔案註冊表（Map），同時 serve 多個檔案，URL 帶唯一前綴不互撞
- port **只 bind 一次**，永不釋放重綁 → 佔用問題根治
- token/hostname 變更自動重建；cloudflared 意外死掉下次上傳自動復活
- 切離 named 模式 / App 結束時自動關閉

### 🖥 UI

設定頁「IG 隧道工具」改名「**媒體發布通道（IG / Threads）**」，三模式：
1. ☁️ 雲端物件儲存（推薦 — 穩定 + 可高頻）
2. Named Tunnel（v0.8.0 起常駐連線）
3. Quick Tunnel（零設定，偶爾發布用）

### 🔧 技術
- 新依賴：`@aws-sdk/client-s3`、`@aws-sdk/s3-request-presigner`（Apache-2.0）
- DB schema v11：`s3_configs` 表（keys DPAPI 加密）
- 新檔：`src/main/lib/s3ConfigRepo.ts`、`src/main/lib/s3MediaHost.ts`
- `serveFileViaCloudflareTunnel` dispatcher 加 s3 分支 — adapters 零修改
- 新 IPC：`tunnel:getS3Config / saveS3Config / deleteS3Config / testS3`
- 規劃文件：`docs/v0.8.0_媒體通道抽象化規劃.md`

### 📋 使用者遷移
- 升級後預設模式不變（quick/named 維持原設定）
- 建議：Cloudflare dashboard → R2 → 建 bucket + API Token → 填入設定頁 → 測試 → 切到物件儲存模式
- 開源商用版待辦（v0.9.0）：OAuth credentials 首次啟動精靈（不再 bundle secrets）

---

## v0.7.6 — 2026-06-02 — 修 IG 圖文發布「Only photo or video can be accepted」錯誤

### 🐛 症狀
發布圖文到 IG 時失敗，錯誤訊息：
```
IG create-image-container：Meta API 錯誤（type=OAuthException code=9004/2207052 HTTP 400）
Only photo or video can be accepted as media type.
```
FB 圖文照樣成功，只有 IG 掛掉。

### 🩹 修法
Meta 從 v22.0+ 開始對 IG image container 強制要求明確傳 `media_type=IMAGE`；
之前依賴 Meta 自動推斷 → 現在會被拒絕。

補上兩處：
- **單圖 image container**（`publishImagePost` 的 create-image-container 階段）
- **Carousel 子容器**（`publishCarouselPost` 的 create-child-N 階段）

Reels（`media_type=REELS`）與 CAROUSEL parent（`media_type=CAROUSEL`）本來就有傳，不受影響。

### 影響
- 單張 IG 圖文貼文 ✅ 修好
- IG Carousel 多圖貼文 ✅ 順帶修好（同個 API 差異）
- IG Reels 影片 ✅ 完全不受影響（本來就正確）
- FB / YT 完全不受影響

---

## v0.7.5 — 2026-06-02 — 修 port 33344 偶發占用 hotfix

### 🐛 症狀
連續上傳兩支影片時偶爾跳：
```
本機 port 33344 已被佔用，無法啟動 named tunnel 本機 server。
```
但隔一段時間重試就會成功 → 代表是**上次 tunnel 的 socket 還在 TIME_WAIT 狀態**沒釋放。

### 🩹 修法
- **close 時強制斷所有連線** — 用 Node 18.2+ 的 `server.closeAllConnections()`，
  把上次 Cloudflare 邊緣節點留下的 keep-alive 連線一次全部 destroy，避免 socket lingering
- **bind 失敗時自動 retry 3 次** — 退避時間 1.5 → 3 → 4.5 秒
- **retry 過程即時回報** UI（status 訊息會顯示「port 33344 被前次連線佔用中，等 1.5 秒後重試...」）
- **最終失敗時的錯誤訊息升級** — 明確說「等 30-60 秒會自動釋放」+ 3 個可選的根本解法

### 影響
- 連發 IG 不再卡 port 占用問題
- Quick tunnel 路徑不受影響（用隨機 port，沒這個問題）

---

## v0.7.4 — 2026-06-02 — 修舊 post 重發炸 hotfix

### 🐛 Bug
重新發布 v0.7.0 之前存的舊 post 時，會跳：
```
TypeError: Cannot read properties of undefined (reading 'enabled')
```
原因：v0.7.0 加 threads 平台後，舊 post 的 `contentJson` 沒有 threads 欄位，
直接讀 `content.perPlatform.threads.enabled` 就 undefined 炸。

### 🩹 修法
新增 `normalizePublishContent(raw)` helper（位於 `src/shared/types.ts`），
所有解析 `contentJson` 的 code path 都套用：
- `publishHandlers.republishExistingPost` — 重發
- `publishHandlers.startPublishJob` 入口 — 防 caller 漏帶 threads
- `scheduler.fireScheduledPost` — 排程觸發
- `PublishPage` 草稿載回

舊資料自動補預設值 `{ enabled: false }`，不影響原本 YouTube / FB / IG 的設定。

---

## v0.7.3 — 2026-06-02 — 暫時關閉 Threads UI（保留底層 code）

### 🚧 暫時下架原因
Threads OAuth 在 Meta Dev mode 下卡關 — 登入後直接跳 threads.net 首頁，不顯示同意頁。
排查路徑都試過（redirect URI 對齊、tester 加入、獨立 session、永遠開 DevTools），
但 Meta 後台 propagation 未完成，無法在現階段穩定收 callback。
為避免使用者按了卡住，先把 UI 入口關掉，等之後 Meta App 通過 review 再開。

### 🔧 變更
- 新增 `FEATURE_FLAGS.THREADS_UI_ENABLED = false`（位於 `src/shared/types.ts`）
- AccountsPage：filter 掉 Threads 卡片（不顯示連線按鈕）
- ContentEditor：filter 掉 Threads 平台 chip + Threads 編輯分頁
- **底層保留**：`threadsAdapter.ts`、`threadsOAuth.ts`、IPC handlers、DB schema、secrets file 通通不動
- 之後要重啟 Threads UI：把 `THREADS_UI_ENABLED` 翻 true 即可（一行改）

### 沒動到的（既有 3 平台一鍵發布完全不受影響）
- YouTube Shorts / Facebook Reels & Photo / Instagram Reels & Post & Carousel 全部正常

---

## v0.7.2 — 2026-05-30 — Threads redirect URI 對齊 + secrets 改 asar.unpacked

### 🔧 修正
- **Threads redirect URI** 從 `https://localhost/...` 改成 `https://puffin-puffs.com/puffinpuff-threads-callback`
  - Meta Dashboard 對 Threads API 拒絕 `localhost`，必須用公開可訪問的 HTTPS domain
  - Redirect URI 只是個 OAuth 標記，Electron 在 `will-redirect` 時攔截，puffin-puffs.com 不會被實際訪問
- **secrets/*.json 改 asar.unpacked**
  - 之前 secrets 打進 asar 內，使用者改 credentials 必須重打包
  - v0.7.2 起 secrets 放在 `resources/app.asar.unpacked/secrets/` 下，使用者可直接編輯 JSON

### 📋 升級步驟
1. 安裝 v0.7.2（自動覆蓋舊版）
2. Threads 連線 — 應該會跳到「PuffinPuff v2 想要存取你的 Threads」同意頁
3. 之後想換 Threads / FB / Google credentials → 編輯 `<安裝路徑>/resources/app.asar.unpacked/secrets/*.json` 即可，免重打包

---

## v0.7.1 — 2026-05-30 — Threads OAuth 診斷 hotfix

### 🔍 問題
v0.7.0 部分使用者連 Threads 時，OAuth 視窗開了登入後就停在 threads.net 首頁，
沒進到「Allow / Deny」同意頁，視窗關掉後 PuffinPuff 也沒任何反應 / toast。

### 🩹 修正
- **OAuth 視窗永遠開 DevTools**（不分 dev / packaged），方便看 Network tab
- **獨立 session partition** — 每次重新登入，避免 Threads 既有 cookie 衝突
- **監聽所有 navigation 事件** — will-redirect / will-navigate / did-navigate / did-redirect-navigation / did-navigate-in-page / did-fail-load 都有 handler
- **卡住偵測** — 若視窗停在 threads.net 非 /oauth 頁面超過 5 秒，console 印 4 大可能原因
- **詳細 log** — auth URL、每次 navigation、callback params 全部印到 main console
- **明確錯誤訊息** — 視窗關閉時提示「若卡 threads.net 首頁 = Threads 拒絕了授權請求」

### 📋 如何取得診斷 log

1. 啟動 v0.7.1 安裝檔
2. 設定頁 → 開 DevTools（v0.6.9 加的按鈕）
3. 帳號頁 → Threads 卡片 → 連線
4. 完成或取消後 → 切回 DevTools → Console tab → 把 `[threads-oauth]` 開頭的所有 log 複製貼給開發者
5. 同時也看 OAuth 視窗自己的 DevTools Network tab 的 redirect chain

---

## v0.7.0 — 2026-05-30 — 第 4 平台：Threads 接入

### 🧵 新功能 — Threads 一鍵發布

PuffinPuff 從「三平台一鍵發布」升級為「四平台一鍵發布」：

| 平台 | 影片 | 圖片 | 純文字 | 多圖 |
|------|------|------|--------|------|
| YouTube Shorts | ✓ | ✗ | ✗ | ✗ |
| Facebook | ✓ Reels | ✓ Photo | ✗ | ✓ Multi-photo |
| Instagram | ✓ Reels | ✓ Post | ✗ | ✓ Carousel (2-10) |
| **Threads** | **✓ Video** | **✓ Image** | **✓** | ⏳ v0.7.1 |

### 🔧 技術細節

**OAuth：獨立流程，與 FB/IG 不共用**
- Threads 走獨立 OAuth：`threads.net/oauth/authorize` → `graph.threads.net/oauth/access_token`
- 60 天長期 token（`th_exchange_token` grant_type）
- 需在 Meta Developer Dashboard 啟用 Threads API + 設定 Redirect URI
- 設定檔：`secrets/threads_oauth.json`（已產 stub，需填 app_id / app_secret）

**API：container pattern（與 IG 類似但 endpoint 不同）**
- POST `/{user-id}/threads` 建立 container → 輪詢 status → POST `/{user-id}/threads_publish`
- VIDEO / IMAGE 走 Cloudflare tunnel 公開檔案（沿用既有 tunnel infra）
- TEXT 模式直接 POST，無需 tunnel
- 500 字硬上限，超過自動截短

**主程式變更**
- `src/main/oauth/threadsOAuth.ts`（新）— Threads OAuth flow
- `src/main/adapters/threadsAdapter.ts`（新）— 三 media_type 統一上傳
- `src/main/ipc/accountsHandlers.ts` — `accounts:connectThreads` / `cancelThreadsAuth`
- `src/main/ipc/publishHandlers.ts` — `runThreads()` + dispatcher 加 threads 分支

**型別變更**
- `Platform`：已含 `'threads'`
- `PublishContent.perPlatform.threads`：`PlatformOverride`
- `PLATFORM_LIMITS.threads`：`{ title: 0, description: 500 }`
- `PostTargetRecord.platform`、`PublishPlatformState.platform` 加 threads

**UI 變更**
- AccountsPage：加 Threads 卡片 + 連線按鈕
- ContentEditor：加 Threads 平台 chip + Threads 分頁
- HistoryPage / SchedulePage：加 Threads icon（`IconBrandThreads`）
- PublishPage：透過 ContentEditor 自動接入

### ⚠ 已知限制（v0.7.1 預計處理）

- 批量匯入 UI 尚未加 Threads 平台選項（folderWatcher / bulk video / bulk image 都預設 threads.enabled=false）
- Threads insights（觸及數據）回傳空值（需 `threads_manage_insights` 權限 + 額外 API 接入）
- Threads 多圖 carousel API 尚未開放第三方，目前 carousel 模式只發第一張當 IMAGE
- mediaProbe validateForPlatforms 不檢查 Threads 規格（Threads 規格較寬鬆，直接上傳）

### 📋 使用前置作業（使用者需做）

1. 在 Meta Developer Dashboard 既有的 PuffinPuff App 啟用 **Threads API**
2. 設定 Threads Redirect URI：`https://localhost/puffinpuff-threads-callback`
3. 取得 Threads app_id + app_secret（可能與既有 FB/IG 不同）
4. 編輯 `secrets/threads_oauth.json` 填入真實值
5. 加入 Threads tester（Dev mode 限制）

---

## 🤖 自動 GitHub 推送機制（2026-05-29 設定）

從現在起，**打包流程自動同步到 GitHub**：

### 新 npm script
```bash
npm run release:win    # = build:win + 自動 commit + tag + push
npm run git:push       # 只跑 push（不重新打包）
npm run build:win      # 只打包不 push（舊行為保留）
```

### 自動流程（`scripts/post-release.cjs`）
1. `git add -A` 所有變更
2. 若有變更 → commit（訊息 `v<version> — release build`）
3. `git tag -f v<version>`（允許同版本重打覆蓋）
4. `git push origin main`
5. `git push origin v<version> --force`

### Repo
- 🔒 Private：https://github.com/rogs30541/puffinpuff
- 已透過 `.gitignore` 排除 `secrets/*.json`、`release/`、`node_modules/`

### 工作流（以後升版本）
1. 改 code
2. `package.json` bump 版本（例 0.6.9 → 0.6.10）
3. CHANGELOG 加新 entry
4. `npm run release:win`
5. ☕ 等 5-7 分鐘 → installer 在 release/、code + tag 推到 GitHub

---

## ✅ IG 上傳問題結案（2026-05-29 確認）

**v0.6.9 確認 IG Reels 上傳穩定可用。** 三平台（YT / FB / IG）一鍵發布全通。

### 真兇歸因（事後）
不是單一原因，是**多因素疊加 + Meta 端暫時性限制**：
1. **v0.6.4 換新 Meta App（804343579328970）** + 等 ~7 小時讓 Meta Standard Access propagate
2. v0.6.8 拿掉 `share_to_feed: true`（dev mode 下可能觸發 stub container）
3. v0.6.9 拿掉 poll 的 `status` field（只查 `status_code`）
4. Meta 端的暫時 rate-limit / 新 App propagation 完成後自動解除

### 關鍵誤判修正
- 一度判斷「dev mode 永久結構性 reject」→ **錯**，是暫時性限制
- 證據：v0.6.9 上 fail → fail → 20 分鐘後 success（同一份 code）= Meta 端狀態變化，非 code 問題
- `debug_token` 證實 8 個 scope 全到位（含 instagram_content_publish）→ 排除 OAuth 問題

### 穩定版鎖定
**v0.6.9 = 正式穩定版**。

### 持續注意事項
- IG 24h 上限 25 篇 → 排程間隔建議 ≥ 5-10 分鐘，避免再撞 Meta anti-spam
- Meta App 仍在 Dev mode → 之後若要讓「任意 IG 帳號」用，仍建議走 App Review → Live mode（非急迫）
- ⚠️ app_secret `bd80...`（v0.6.4 設定）使用者選擇暫不 rotate

---

## [0.6.9] - 2026-05-26｜🛠️ DevTools 按鈕 + 自動複製錯誤 + 嘗試 v0.3.x 回歸點

### 重要線索
使用者回報：**5/20 前（v0.3.0 批量圖文上線前）IG 上傳是可以的**。
→ 這代表「Meta dev mode 結構限制」假設站不住腳（Meta 不會回頭把以前能用的全部擋掉）
→ 真正原因是 PuffinPuff 自己在 v0.3.x 引入的 regression

### 改動

#### 1. 嘗試 v0.3.x 推測回歸點：移除 poll 的 `status` field
過去 poll IG container status 用 `fields=status_code,status`。`status` 是一個 text 描述欄位，平行於 `status_code` enum 欄位。

**推測**：v0.3.x 加 `,status` 時 IG container resource 對 status 欄位的 method 支援有變（或 Meta 後來對 dev mode App 收緊了），導致 GraphMethodException/33。

v0.6.9 改成 `fields=status_code` only（也是 Meta docs 範例的最早版本），不再查 `status`。

#### 2. Settings 加「🔬 開啟 DevTools」按鈕
使用者隨時能開 DevTools 看 console（不用記快捷鍵 Ctrl+Shift+I）。

新 IPC：`system:openDevTools` 呼叫 `webContents.openDevTools({ mode: 'detach' })`。

#### 3. 發布失敗加「📋 複製錯誤」按鈕
PublishProgress 的失敗 row 旁新增小按鈕，一鍵複製：
- 時間
- 平台
- 帳號
- 錯誤訊息

直接 Ctrl+V 到聊天就能貼。

### 升級
直接覆蓋 v0.6.9。**現在最該做的事情**：
1. 安裝 v0.6.9
2. 完全重啟 PuffinPuff
3. 重發那筆 IG
4. **如果 poll 改成 fields=status_code 後成功 → 真相是 status 字段的回歸**
5. 如果還是失敗 → 設定頁開 DevTools 看 console，截圖 + 用新「📋 複製錯誤」按鈕貼上來

---

## [0.6.8] - 2026-05-26｜🧪 IG 失敗最終診斷三件套

### 目的
v0.6.6 看到的錯誤 `code=100 GraphMethodException/33`。在我說「100% dev mode 限制」之前，必須再確認 3 件事：
1. 是不是 `share_to_feed: true` 這個 v0.6.0 加的 flag 造成 dev mode 下的奇怪行為
2. Container 創建時 Meta 是不是有回額外訊息我們漏掉
3. OAuth 真實授予的 scope 是不是跟 PuffinPuff 預期一致

### 改動

#### 1. 拿掉 `share_to_feed: true`
Meta 預設 `share_to_feed=true`，顯式設可能在 dev mode 觸發特殊路徑。先拿掉看會否改變。

#### 2. Container 創建完整 log
原本只 log id。現在 log 完整 `resp.data` + `HTTP status`，看 Meta 是否回傳額外的 warning / error info。

#### 3. **`debug_token` 診斷工具（新功能）**
帳號頁每個 Meta 帳號旁新增 **🔬 Scope** 按鈕。
點下去會呼叫 Meta `/debug_token` endpoint 查當前 token 實際的：
- `scopes`（真實授予的權限清單）
- `is_valid`（token 是否有效）
- `expires_at`（到期時間）
- `app_id`（屬於哪個 App）
- `profile_id` / `user_id`（屬於哪個 user）

**關鍵測試**：如果 scope 清單缺 `instagram_content_publish` → OAuth 同意了但沒實際給 → 不是 dev mode 問題、是 OAuth 流程 bug。
如果 scope 都有 → 確認是 dev mode 對該 permission 的硬限制。

### 使用流程

1. 安裝 v0.6.8
2. 重啟 PuffinPuff
3. 帳號頁 → 點 `@everpro.mita02` 旁邊新的 **🔬 Scope** 按鈕
4. 跳出來的通知 → **整段截圖貼上來**
5. 看到 scopes 內容後我才能下最終判斷

之後再重發 IG，看：
- Console 印的 container 創建 response（v0.6.6 + v0.6.8 雙重 log）
- 是否仍然 GraphMethodException/33

### 升級
直接覆蓋 v0.6.8。

---

## [0.6.7] - 2026-05-26｜🪝 範本套用擴及批量匯入 + 圖文 Bulk

### 改動

繼 v0.6.5 範本只接到 PublishPage，現在補上：

#### 1. SchedulePage 批量影片匯入 Modal
在「全域預設」卡片之前加入 TemplateApplyBar：
- mode 鎖 `video-reels`（批量匯入只接影片）
- 套用範本 → 自動填入 titleTemplate / description / hashtags / privacy
- 「存為新範本」可把當前批量設定存起來

#### 2. ImagePostBulkModal
在共通設定區加入 TemplateApplyBar：
- mode 鎖 `image-post`
- 套用範本 → 自動填入 hashtags

### 結果

**3 個地方都能用範本了**：
- ✅ 發布頁（單檔，v0.6.5）
- ✅ 批量影片排程（v0.6.7）
- ✅ 批量圖文（v0.6.7）

### 升級
直接覆蓋 v0.6.7。範本資料保留。

---

## [0.6.6] - 2026-05-26｜🔍 IG poll-status 暴力 logging（抓真兇）

### 目的
v0.6.4 切新 Meta App 後 IG 仍 code 100 "Authorization Error"。已排除：
- ✅ App 累積 state（已換新 App）
- ✅ Test account 限制（VVLEE 自己是 App Admin + Page admin）
- ✅ Token 失效（剛 OAuth）
- ✅ Permission 缺漏（6 個 permissions 都齊）

剩下未知。需要看 Meta 完整 response 才能定位。

### 改動

#### 1. `instagramAdapter.ts` `igError()` 暴力 logging
失敗時 console.error 印出：
- `Request URL`（完整 IG API 端點）
- `Request method` + `Request params`
- **`Response data (full)`** ← 整個 Meta JSON response 用 JSON.stringify 印
- `Response headers`
- `HTTP status` + `statusText`

#### 2. `metaErrorHelpers.ts` code=100 訊息升級
不再用「通常是 caption 太長」這種誤導文字，改為帶出：
- `type` / `subcode` / `fbtrace_id`
- `error_user_msg`（Meta 給使用者的提示）
- 列出 5 種常見原因
- **保留原始 message** 給使用者直接看

例如使用者會看到：
```
Meta code=100 OAuthException/2207003 fbtrace=xxxxxxxxx
[原始訊息]：Authorization Error
[Meta 給使用者的訊息]：Sorry, this content isn't available right now

常見原因：
(1) caption 超過 2200 字
(2) 影片格式不符 IG Reels 規格
(3) hashtag 超過 30 個
(4) IG 帳號被 Meta 限制 publish
(5) dev mode 對 instagram_content_publish 的硬限制
```

#### 3. poll-status 額外 error log
v0.6.6 在 poll 失敗 throw 之前再印一次完整 response.data，雙保險避免 log 被吞。

### 使用方式

1. 安裝 v0.6.6
2. 開啟 PuffinPuff 看主視窗左上選單 → 檢視 → 開啟 DevTools（或 Ctrl+Shift+I）
3. 切到 Console 分頁
4. 重發 IG → 失敗時 console 會印出 `=== IG API FAILURE @ phase=... ===` 區塊
5. **整段截圖貼給我** → 我就能定位真實原因

### 升級
直接覆蓋 v0.6.6。

---

## [0.6.5] - 2026-05-26｜🪝 範本實際接到發布流程

### 痛點
v0.6.1 已經建好範本管理頁，但「**範本只能管理、沒地方套用**」。使用者建好範本卻得手動複製貼上，沒省到力。

### 改動

#### 新元件：`TemplateApplyBar`
- 「套用範本」dropdown：列出符合當前 mode（含 'any' 通用範本）的範本
- 顯示已用次數（讓常用範本浮上來）
- 「存為新範本」按鈕：把當前 form 內容存成範本
- 套用時自動：
  - 替換 title（支援 `{filename}` 變數，filename 自動去前綴）
  - 替換 description / hashtags / privacy
  - 累加 useCount + 更新 lastUsedAt

#### PublishPage 整合
- 在 mode 選擇器後、ContentEditor 前加 TemplateApplyBar
- 拖檔後立刻看到「套用範本」+「存為新範本」工具列
- 套用範本 → 內容立刻填入 → 還能進 ContentEditor 微調
- 編輯完滿意 → 存為新範本下次用

### 未整合（v0.6.6 預定）
- SchedulePage 批量影片匯入 + ImagePostBulkModal 的範本套用（這 2 個還是要手 key 內容）

### 升級
直接覆蓋 v0.6.5。

---

## [0.6.4] - 2026-05-26｜🔄 切換到全新 Meta App「PuffinPuff v2」

### 目的
舊 Meta App（id=1688734675601145）可能累積了隱性限制 / 風險旗標。賭一把：建一個全新的 App，重置所有 Meta 端 state。

### 改動
`secrets/meta_oauth.json` 三個值切換：
- `app_id`：1688734675601145 → **804343579328970**
- `app_secret`：（已 rotate）
- `config_id`：1275523534730366 → **1013830964668154**

### ⚠️ 副作用（升級必讀）
1. **所有現有 Meta（FB / IG）連線會失效** — 不同 App 的 token 互不通用
2. 升級後**所有 FB/IG 帳號要重新 OAuth 連結**
3. 第一次連結時瀏覽器跳的 Meta 授權視窗 **App 名稱會顯示「PuffinPuff v2」**（不是舊的）— 這是正常的
4. 重新連結後權限會跟著新 App 的 Business Login Configuration（6 個 permission 都齊全）

### 升級流程
1. 覆蓋安裝 v0.6.4
2. 開 PuffinPuff → 帳號頁
3. 看到原本所有 FB/IG 帳號狀態變「失效」（預期）
4. 全部斷開
5. 點「連結 Facebook」→ 走新的 OAuth 流程
6. 連結成功後重發 IG 試試

### 已知未做
- App 仍在 Dev mode → 還是有 Tester 限制
- 如果新 App 還是 code 100 → 真兇就是 dev mode + Tester 結構性限制，跟 App 新舊無關

---

## [0.6.3] - 2026-05-26｜🎛️ PublishPage 加 Mode 選擇器（圖文 vs 影片 UI 真正分離）

### 痛點
v0.6.0 後端 dispatch 已經三態（video/image/carousel），但 PublishPage 還是看不出來。使用者拖檔之後才知道走哪條路，視覺上「圖文跟影片發布看起來一模一樣」。

### 改動
PublishPage 頂部加 **Mode 選擇器**（Segmented control 樣式）：

| 模式 | 表情 | 流程 |
|---|---|---|
| 🎬 影片 Reels | sky | YT Shorts + FB/IG Reels |
| 🖼 單圖貼文 | mango | FB Photo + IG Single Image（無 YT）|
| 🎠 多圖 Carousel | lavender | FB MultiPhoto + IG Carousel（無 YT）|

- 切換 mode 自動清空已選媒體（避免類型不對）
- 拖檔提示文字根據 mode 變化：
  - Reels：「拖入 .mp4 / .mov 影片檔（建議 9:16 直立、3-180 秒）」
  - 單圖：「拖入 .jpg / .png 單張圖（建議 1080×1080 以上）」
  - Carousel：「拖入第一張圖（.jpg/.png），稍後在編輯區補上其他 1-9 張」
- 標題右側顯示當前 mode badge（顯眼）
- 發布時顯式傳 postType 對應 UI 選擇（搭配 v0.6.0 backend 雙重保險）

### 結果
- ✅ 進入發布頁立刻看到 3 種 mode 選項
- ✅ 知道現在要發什麼，UI 一目了然
- ✅ 發布按鈕送到 backend 的 postType 跟 UI 選擇一致
- ✅ 跟 v0.6.0 backend 自動偵測雙重防護：caller 傳對 + backend 用副檔名驗證

### 升級
直接覆蓋 v0.6.3。設定保留。

---

## [0.6.2] - 2026-05-26｜🧷 批量匯入 scanFolder 支援拖單檔

### 痛點
過去 schedule 批量匯入只認「資料夾」，拖一個 .mp4 進去會跳：
```
不是資料夾：G:\...\acv_xxx.mp4
```
讓使用者卡住，要先找到該檔所在資料夾、再拖整個資料夾。

### 改動
`src/main/ipc/scheduleHandlers.ts` `scanFolderForVideos`：
- 偵測 input 是檔案還是資料夾
- 單檔（副檔名是支援的影片格式）→ 自動 fallback 用該檔的父資料夾 + files 只列該單檔
- 單檔但不支援的副檔名 → 友善錯誤訊息列出支援清單
- 非檔案非資料夾 → 改成「不是檔案或資料夾」

### 結果
現在可以**拖單一影片**進批量匯入區，會自動處理：
- folderPath = 該影片的父資料夾
- files = [那個單檔]

之後排程流程跟拖資料夾完全一樣。

### 升級
直接覆蓋 v0.6.2。

---

## [0.6.1] - 2026-05-26｜📝 內文範本（不用每次重 KEY 影片描述）

### 新功能：Content Templates

過去發每一支影片都要重新打描述、hashtag、平台設定 — 太累。v0.6.1 加「**內文範本**」功能：

- 把常用組合（標題模板、描述、hashtag、適用 mode）存成範本
- 之後發新影片時一鍵套用
- 範本可分四種 mode：通用 / 影片 Reels / 單圖貼文 / 多圖 Carousel
- 標題模板支援 `{filename}` 變數（自動去除前綴編號）

### 改動

#### 1. 新側邊導覽「範本」（Ctrl+5，設定改 Ctrl+6）
- 列出所有範本，按使用次數 + 最近使用排序
- 編輯 / 複製 / 刪除 / 新增

#### 2. DB schema migration v10
- 新表 `content_templates`（name, mode, title_template, description, hashtags, privacy, per_platform_json, target_accounts_json, use_count, last_used_at, ...）
- 索引：mode、last_used_at

#### 3. IPC + types
- `window.puffin.templates.{list, get, create, update, delete, duplicate, recordUse}`
- 新型別：`ContentTemplate`、`TemplateMode`、`CreateTemplateInput`、`UpdateTemplateInput`

### 程式碼

- `src/main/lib/database.ts`：migration v10
- `src/main/lib/templatesRepo.ts`：CRUD（新檔）
- `src/main/ipc/templatesHandlers.ts`：IPC（新檔）
- `src/renderer/src/pages/TemplatesPage.tsx`：頁面（新檔，含編輯 Modal）
- `src/renderer/src/components/Sidebar.tsx`：加「範本」項
- `src/renderer/src/App.tsx`：route + 切換
- `src/main/appMenu.ts`：Menu 加範本 / 改 settings 快捷鍵到 Ctrl+6
- `src/shared/types.ts`：型別

### 未做（留 v0.6.2）
- PublishPage / 批量匯入 modal 套用範本（這個 release 只先讓「管理」存得起來，套用流程下版做）
- Schedule / History mode badge（純視覺，自動偵測已夠用）

### 升級

直接覆蓋 v0.6.1。Schema v10 自動跑（新增空表，不影響現有資料）。

---

## [0.6.0] - 2026-05-26｜🏗️ FB/IG 並聯上傳 pipeline 重架構（Reels / Image / Carousel tri-state）

### 為什麼要重架構

過去 `postType` 只是二元（'video' / 'image'），且 caller（PublishPage、批量匯入、排程觸發）需要自己傳對的值。一旦傳錯：
- 圖檔被當影片送 IG Reels API → Meta 拒絕「但訊息 generic」→ 整天 debug 不出來
- 多圖 carousel 跟單圖混用同一個 postType=image → 派發邏輯卡 if-else 結構不清

v0.6.0 重新把整個 pipeline 收緊。

### 主要改動

#### 1. PostMode 三態（取代二元 postType）
- `'video'` (legacy) ↔ `'video-reels'`：YT Shorts + FB Reels + IG Reels
- `'image'` (legacy) ↔ `'image-post'`：FB Photo + IG Single Image（無 YT）
- `'carousel'`（**新**）：FB Multi-Photo + IG Carousel（2-10 圖，無 YT）

`shared/types.ts` 加 `postTypeToMode()` / `modeToPostType()` / `detectModeFromFiles()` 三個 helper。

#### 2. DB schema migration v9
- `posts.post_type` 欄位接受 'carousel' 值
- Migration 把現有「post_type='image' 且 content_json.imageCarouselPaths >= 1」的舊資料自動升級為 'carousel'

#### 3. 入口處強制自動偵測 mode（核心修正）
`src/main/ipc/publishHandlers.ts` `startPublishJob`：
- 不再無腦相信 caller 傳的 postType
- 用副檔名（mp4/mov/... vs jpg/png/...）+ carouselPaths 長度推導真實 mode
- **caller 傳錯也會被覆蓋並 log 警告**
- 例如：圖檔被誤傳 postType='video' → 自動改成 'image' → 圖檔不會跑去 IG Reels API

#### 4. Dispatcher 樹狀 → 三態派發
之前：`postType === 'image' ? photo : reels` 二元分支
現在：
```ts
if (postType === 'video') runInstagram();
else if (postType === 'carousel') runInstagramImage(..., carouselPaths);
else runInstagramImage(..., undefined); // image 強制 carouselPaths=undefined 走單圖
```

#### 5. IG Reels container 加 `share_to_feed=true`
2024+ Meta 對某些帳號預設 `share_to_feed=false` → Reel 不會出現在主 feed → 看起來像沒發成功。顯式設 true 避免。

#### 6. Tunnel propagation 延遲 3 秒
cloudflared tunnel ready 後立刻叫 Meta 來 fetch → Cloudflare edge 路由還沒 propagate 完 → Meta 取得 502 → container 處理失敗。
v0.6.0 在 tunnel ready 後等 3 秒讓 edge 完成 propagation 再叫 Meta 來。

#### 7. Local server 支援 HEAD method
Meta fetch 前常會先 HEAD 預檢檔案大小。過去我們的 server 只認 GET → HEAD 直接 404 → Meta 可能會放棄。
v0.6.0 補 HEAD support。

#### 8. Local server 動態 Content-Type
過去硬塞 `video/mp4` 不分檔案類型。改為依 exposedName 副檔名挑：
- mp4/m4v → video/mp4
- mov → video/quicktime
- jpg/jpeg → image/jpeg
- png → image/png
- webp → image/webp
- gif → image/gif

避免 IG 圖檔上傳時 Meta 收到「Content-Type: video/mp4 + 內容是 PNG」這種 mismatch。

### 影響

- ✅ **bug: 圖檔被當影片送 IG Reels API** → 修好
- ✅ **bug: cloudflared tunnel 太快被叫 fetch 導致 IG container ERROR** → 修好
- ✅ **bug: IG Reels 發了但沒出現在 feed**（share_to_feed=false）→ 修好
- ✅ **bug: Meta HEAD 預檢失敗** → 修好
- ✅ **bug: 圖檔 Content-Type 錯誤** → 修好

### 升級

直接覆蓋安裝 v0.6.0。schema v9 migration 自動跑，現有 image carousel 排程資料正確轉成 'carousel'。

### 已知未做（v0.6.1 預定）
- PublishPage 入口加 explicit mode 選擇器（目前靠自動偵測）
- SchedulePage / HistoryPage 顯示 mode badge（目前看標題猜）

---

## [0.5.5] - 2026-05-26｜🎬 IG/FB Reels 規格更新：上限從 90s → 180s（3 分鐘）

### 痛點 / 真正的元兇
從 2026 年某個時點起，Meta 把 IG / FB Reels 上限**正式放寬到 180 秒**。PuffinPuff `PLATFORM_SPECS` 還寫舊的 **90 秒**。

實際後果：
- 使用者放 1-3 分鐘的影片進來 → PuffinPuff 把它標為「不符規格」**但仍允許發布**
- 發布時影片 < 180 秒 → 實際上 Meta 是接受的
- 過程中 IG 偶爾 reject（特別是接近 / 超過 180s 的）→ Meta 回 `code 100 "Authorization Error"`（generic 訊息，沒提時長）
- v0.4.4 的 parseMetaError 太寬鬆 → 把所有 OAuthException 當 auth 失效 → 引導使用者一直重連 Meta，永遠繞不出來

這次反覆 debug 一整天（cloudflared rate limit → buy domain → named tunnel → Meta App Dev mode）**真正的元兇就是這個過時的時長限制**。

### 改動

`src/main/lib/mediaProbe.ts`：
- `PLATFORM_SPECS.facebook.maxDuration`：90 → **180**
- `PLATFORM_SPECS.instagram.maxDuration`：90 → **180**
- 註解校對時間 2025-05 → 2026-05

### 影響

- 1-3 分鐘的影片：之前被誤判「不符」但實際 Meta 接受；現在 PuffinPuff 也認為符合 ✅
- 超過 3 分鐘的影片：仍會被 PuffinPuff 擋下（避免送到 Meta 後 code 100 假錯誤）
- YT Shorts 仍 180 秒（沒變）

### 升級

直接覆蓋 v0.5.5。**這次裝完直接重發那筆 IG**，如果影片在 180 秒以內 → 應該真的能成功了。

如果影片超過 180 秒 → 需要剪短，PuffinPuff 規格頁會明確警告。

---

## [0.5.4] - 2026-05-25｜🐛 修 parseMetaError 把 OAuthException 全部當 auth 失效的誤判

### 痛點
v0.4.4 加的 `parseMetaError` 對 auth 錯誤判斷太寬鬆：
- 看到 `type: OAuthException` 就分類為 auth
- 看到訊息含 `Authorization` 就分類為 auth

問題是 **Meta API 對「很多非授權錯誤」都會回 `type: OAuthException`**，例如：
- IG 影片格式問題
- IG container 過期 / 處理失敗
- IG 內容審查拒絕（被當廣告封殺、違反社群守則）
- IG account 暫時停權
- 各種 IG-specific 錯誤

這些 PuffinPuff 全當「token 失效」→ 自動 refresh + 重試 → retry 還是 fail（因為根本不是 token 問題）→ 顯示「Meta 授權失效」，**真正錯誤訊息被蓋掉**。

使用者反覆斷開重連 Meta，每次都失敗一樣 — 因為問題從來不在 token。

### 修正

#### 1. `parseMetaError` 收緊 auth 判斷
- 移除「`type === OAuthException`」這個條件
- 移除「message 含 `authorization` 字串」這個條件
- 只認真正的 auth 訊號：HTTP 401 或 Meta error code 190 / 102

#### 2. 「unknown」分類顯示完整真實錯誤
- 過去 fallback 訊息只顯示 message 前 150 字
- 現在顯示 `type=X code=Y/Z HTTP=N: <message 前 250 字>`
- 使用者一眼看到 type / code，可以對照 Meta API docs 知道真正原因

#### 3. AxiosError 以外的 throw 不再字串匹配
- 過去：`msg.includes('Authorization') || msg.includes('OAuthException')` → 分類 auth
- 現在：unknown，連帶完整訊息

### 改動

`src/main/lib/metaErrorHelpers.ts` 三處：
- L37-43：非 AxiosError fallback 改為 unknown
- L70-84：auth 條件收緊
- L116-126：unknown 訊息加入 type / code / subcode / HTTP status

### 影響

- 之後 IG 真的因為 token 失效時，照樣會 auto-refresh + 重試
- IG 因為**其他**原因失敗時，會看到 Meta 真正的錯誤訊息（含 type + code）
- 帳號頁不會再無謂叫你「重新連結 Meta」

### 升級

直接覆蓋 v0.5.4。設定保留。**安裝後重發 IG**，會看到真正錯誤訊息 → 我們才能對症下藥。

---

## [0.5.3] - 2026-05-25｜🐛 修 Named Tunnel cloudflared help mode bug（再修一次，這次真的修對）

### 修正

v0.5.1 把 `--no-autoupdate` flag 從 `tunnel run` 後面移到 `tunnel` 前面（猜測它是 global flag），但實測 **v0.5.1 還是同樣 fail with help mode**。表示我之前的假設錯了。

### 根本原因（這次找對了）

從使用者 PowerShell 成功跑過的 log 看到：
```
INF cloudflared will not automatically update on Windows systems.
```
→ **cloudflared 在 Windows 預設就不會 auto-update**，`--no-autoupdate` flag 在 Windows 上完全多餘。

而當前 cloudflared 版本（2026.5.0）的 CLI parser **對 `--no-autoupdate` 處理有 bug**，不論放開頭還是結尾，都會把整個命令導向 help mode 並 exit 0。

### 改動

`src/main/lib/tunnel.ts` 兩處：完全拿掉 `--no-autoupdate`。最終 spawn 命令：
```
cloudflared.exe tunnel run --token <TOKEN>
```
與 PowerShell 手動測試（已驗證可用）完全一致。

### 為什麼 quick tunnel 加 --no-autoupdate 沒問題？

v0.4.x 的 quick tunnel 走 `cloudflared tunnel --url X --no-autoupdate`（不是 `tunnel run` 子命令），那個 parser 路徑可以接受尾端 `--no-autoupdate`，所以一直沒事。
是 v0.5.0 引入 `tunnel run` 子命令才暴露 cloudflared CLI 的這個 bug。

### 升級

直接覆蓋安裝 v0.5.3。設定全保留。

---

## [0.5.2] - 2026-05-25｜✨ Named Tunnel UX 改進：測試不用重貼 token

### 痛點
v0.5.0/0.5.1 設定流程很奇怪：
- 貼 token → 按「儲存設定」→ token 欄位清空（為避免一直顯示）
- 想接著按「測試連線」→ **欄位空著沒法測**
- 必須重貼 token 才能測試 → 浪費時間 + 容易又貼錯

### 改動

#### 1. 「儲存設定」不再清空 token 欄位
- token state 保留，PasswordInput 顯示為點點（本來就不會洩漏明文）
- 儲存後可立即按「測試連線」

#### 2. 「測試連線」支援 DB 後援
- IPC `tunnel:testNamed` 收到空 token 時 → 從 DB 讀加密 token 解密用
- 使用者**完全不用重貼 token** 來測試
- 之後 navigation 切走再切回、或 PuffinPuff 重開 → 一樣可以直接測（用 DB token）

#### 3. 「測試連線」按鈕條件放寬
- 從「需要 token 且 hostname」→ 「只要 hostname 且（有 token 或有 config）」
- 已儲存過設定的情況下，只要 hostname 填好就能測

### 推薦操作流程（v0.5.2）

1. 首次：貼 token + hostname → 按「儲存設定」→ 按「測試連線」→ 看綠勾
2. 之後：直接按「測試連線」（用 DB token + hostname）
3. 換 token：欄位貼新的 token → 儲存 + 測試

### 升級

直接覆蓋安裝 v0.5.2。tunnel 設定保留。

### 技術細節
- `src/main/ipc/tunnelHandlers.ts`：`tunnel:testNamed` 加 fallback 邏輯
- `src/renderer/src/components/TunnelConfigCard.tsx`：handleSave 不 setToken('')、handleTest 允許空 token、按鈕 disabled 條件更新

---

## [0.5.1] - 2026-05-25｜🐛 修 Named Tunnel 測試/啟動失敗（cloudflared CLI 參數順序）

### 修正

#### 症狀
- v0.5.0 設定 Named Tunnel 並按「測試連線」時跳「cloudflared 異常結束（exit code 0）」
- stdout 印出 cloudflared 完整 help text 然後正常結束
- 同一個 token + 同一個 cloudflared 在 PowerShell 手動跑可以正常 Register tunnel connection
- 也就是說 token 對、binary 對，但 PuffinPuff 呼叫方式不對

#### 根本原因
`--no-autoupdate` 是 cloudflared 的**全域 flag**，必須放在 `tunnel` 子命令**之前**：
- ❌ 錯：`cloudflared tunnel run --token X --no-autoupdate` → cloudflared 把 `--no-autoupdate` 當成 `run` 子命令的未知 flag → 落入 help mode → exit 0
- ✅ 對：`cloudflared --no-autoupdate tunnel run --token X` → 全域 flag 先處理 → 進入 run 流程

v0.4.x quick tunnel 走 `cloudflared tunnel --url X --no-autoupdate`（不是 `tunnel run`），那個 CLI 解析路徑可以接受尾端 `--no-autoupdate`，所以一直沒問題。v0.5.0 的 named tunnel 走 `tunnel run` 才暴露這個 bug。

### 改動

`src/main/lib/tunnel.ts` 兩處：
- `serveViaNamedCloudflareTunnel`：spawn 參數從 `['tunnel', 'run', '--token', X, '--no-autoupdate']` 改成 `['--no-autoupdate', 'tunnel', 'run', '--token', X]`
- `testNamedTunnelConnection`：同上

### 升級

直接覆蓋安裝 v0.5.1。設定（token、hostname、tunnel mode）全部保留。

---

## [0.5.0] - 2026-05-25｜🚀 Cloudflare Named Tunnel 支援（無 IP 限流，穩定無痛）

### 主要新功能

#### Cloudflare Named Tunnel 模式
- 設定頁新增「IG 隧道工具」雙模式：
  - **Quick Tunnel**（預設）：原 v0.1 ~ v0.4.x 行為，無設定但 Cloudflare 對 IP 限流
  - **Named Tunnel**（新）：用使用者的 Cloudflare 帳號 + tunnel token + 固定 hostname，**無 IP rate limit**，可永久密集發布
- 設定流程內建教學（Alert 卡片）：
  - 開啟 Cloudflare Zero Trust dashboard 連結
  - 5 步驟說明（建 tunnel → 複製 token → 設 Public Hostname → 貼回 PuffinPuff → 測試）
  - 明確指示 service URL 必須是 `localhost:33344`
- Token 用 Windows DPAPI（safeStorage）加密儲存
- 「測試連線」按鈕：spawn cloudflared 試連 + HEAD 請求 hostname 確認 DNS + tunnel routing 正常
- 「刪除設定」自動切回 Quick Tunnel 模式

### 技術細節

#### 新增 DB schema v8
- `app_settings`：key-value 通用設定表（首位住客：`tunnel_mode`）
- `tunnel_configs`：named tunnel 加密 token + hostname + last_verified_at

#### 新增主程式檔案
- `src/main/lib/settingsRepo.ts`：app_settings CRUD + `getTunnelMode()` / `setTunnelMode()` typed accessor
- `src/main/lib/tunnelConfigRepo.ts`：tunnel_configs CRUD，含 internal（含 token 明文）/ public（不含）兩種型別
- `src/main/ipc/tunnelHandlers.ts`：tunnel:* IPC（getMode / setMode / getNamedConfig / saveNamedConfig / deleteNamedConfig / testNamed / getNamedLocalPort）

#### tunnel.ts 抽象化
- 新增 `NAMED_TUNNEL_LOCAL_PORT = 33344`（固定 port，對應 Cloudflare ingress service URL）
- `serveFileViaCloudflareTunnel()` 變成 dispatcher（根據 `getTunnelMode()` 分派）
  - quick → 原 `serveViaQuickCloudflareTunnel`（保留 v0.4.7 的 1015 退避邏輯）
  - named-cloudflare → 新 `serveViaNamedCloudflareTunnel`（spawn `cloudflared tunnel run --token`，等 stderr 出現 "Registered tunnel connection"）
- 新增 `testNamedTunnelConnection()`：30 秒內等就緒 + HEAD 請求 hostname 驗證
- 新增 `createLocalFileServer()` 共用 helper（含 EADDRINUSE 友善訊息）

#### 新增前端元件
- `src/renderer/src/components/TunnelConfigCard.tsx`：Radio 切換 + 設定表單 + 測試連線 + 狀態顯示
- SettingsPage 用此元件取代舊「IG 隧道工具」card（保留 v0.4.6 重下載按鈕）

### 規劃文件
- `docs/v0.5.0_named_tunnel_規劃.md`：完整對比表 + Cloudflare 設定步驟 + DB schema + UI mockup + 工程量估算

### 升級

- 從 v0.4.x 任意版直接覆蓋安裝 v0.5.0
- 首次啟動會跑 v8 migration（新增兩個 table，不影響現有資料）
- 預設 tunnel mode 是 `quick`，不主動切換 — 使用者需自己去設定頁開 Named Tunnel
- Quick Tunnel 路徑完全保留（含 v0.4.7 的 1015 退避邏輯），所以即便不用 Named Tunnel 也跟 v0.4.7 等同

### 使用者操作流程（首次設定 Named Tunnel）

1. PuffinPuff → 設定頁 → 「IG 隧道工具」卡片
2. 點 [開啟 Cloudflare Zero Trust dashboard] 連結
3. Networks → Tunnels → Create a tunnel → Cloudflared
4. 命名 tunnel（例 `puffinpuff-vvlee`）
5. **複製畫面上 token**（eyJ... 開頭）
6. Public Hostname 頁：
   - Subdomain: `puffin`
   - Domain: `mememaker-tw.com`（或其他你 Cloudflare 託管的網域）
   - Service Type: `HTTP`
   - URL: `localhost:33344`（**必須**是這個 port）
7. 儲存
8. 回 PuffinPuff：貼 token → 填 `puffin.mememaker-tw.com` → [儲存設定]
9. [測試連線] → 看到綠勾 ✅
10. 切換到「Named Tunnel」radio
11. 之後 IG 上傳完全無 1015 限流問題

---

## [0.4.7] - 2026-05-25｜🚦 Cloudflare quick tunnel 限流偵測 + 智慧退避

### 修正

#### IG 上傳失敗：error 1015 / 429 Too Many Requests
- 症狀：發 IG Reels / 圖片時，v0.4.6 自動重下載 cloudflared 後**仍然失敗**，stderr 出現 `error code: 1015` 或 `429 Too Many Requests`
- 根本原因：**Cloudflare 對「無帳號 quick tunnel」做 IP rate limit**（error 1015 是 Cloudflare 標準限流碼）。密集測試（連續發多支或多次重試）會把同一個出口 IP 撞到上限
- v0.4.6 的錯誤：對所有失敗都「重下載 binary」→ 浪費 30MB 流量但問題沒解，因為瓶頸不在 binary

### 改動

#### A. 錯誤分類 → 對症下藥
- 新增 `classifyTunnelError(stderr)`：偵測 stderr 中的 `1015` / `429 Too Many Requests` → 標記為 `rate_limit`
- 失敗時根據類型挑恢復策略：
  - **rate_limit**：**不重下載 binary**，改成指數退避（等 60s → 再 120s，最多 2 次）+ retry
  - **unknown**（exit code 1 但非限流）：保留 v0.4.6 的「重下載 + 再試」邏輯

#### B. 友善錯誤訊息
- 若退避 2 次仍是 rate_limit → 跳出**具體解決方案**：
  ```
  Cloudflare quick tunnel 對你的 IP 限流中（error 1015 / 429 Too Many Requests），退避重試 2 次仍然失敗。

  【解決方法】請擇一：
    1. 等 30-60 分鐘讓 Cloudflare 自動解除限流
    2. 切換網路（手機熱點）讓出口 IP 改變
    3. 開啟 VPN 換出口 IP
    4. （未來 v0.5.0）改用 Cloudflare named tunnel，無 IP 限流
  ```
- UI 進度回呼 onStatus 會即時顯示「Cloudflare 限流，等 60 秒後重試（1/2）...」讓使用者知道發生什麼

#### C. 設定頁說明升級
- 「IG 隧道工具」卡片加入兩種錯誤的處理方式說明：
  - exit code 1（無 1015）→ 系統自動重下載
  - error 1015 → 自動退避；若失敗請等待或換網路

### 預告 v0.5.0
- **Cloudflare named tunnel** 支援：無 IP rate limit，永久穩定（需 Cloudflare 免費帳號 + tunnel token）
- 或 **ngrok fallback** 選項

### 升級必裝
- 從 v0.4.6 直接覆蓋 v0.4.7
- 無 schema 變動

### 技術細節
- `src/main/lib/tunnel.ts`
  - 新增 `TunnelAttemptError` class（kind: 'rate_limit' | 'unknown', stderr 原文）
  - 新增 `classifyTunnelError(stderr): TunnelErrorKind`
  - `attemptTunnel` reject 改丟 TunnelAttemptError 帶分類
  - `serveFileViaCloudflareTunnel` 重寫恢復流程：Phase A 直接試 → Phase B 限流退避 → Phase C unknown 重下載
- `src/renderer/src/pages/SettingsPage.tsx`：更新 cloudflared 卡片文案

---

## [0.4.6] - 2026-05-25｜🌐 cloudflared 錯誤診斷 + 自動重下載

### 修正

#### IG 上傳失敗：cloudflared 異常結束（exit code 1）
- 症狀：發 IG Reels / 圖片時跳「cloudflared 異常結束（exit code 1）」，無法上傳
- 主因：本機 `cloudflared.exe` 是舊版（上次下載完就一直用），Cloudflare quick tunnel API 升級後不相容
- 修正：
  1. **錯誤訊息可診斷**：tunnel.ts 改為完整收集 cloudflared 的 stdout / stderr，啟動失敗時把實際輸出附在錯誤訊息裡（過去只顯示「exit code 1」沒任何線索）
  2. **自動重下載 + 重試**：第一次 spawn cloudflared 失敗時，自動刪除舊 exe + 重新下載最新版 + 自動再試 1 次。整個過程使用者無感，過時的 binary 會被自動換掉
  3. **手動按鈕**：設定頁加「重新下載 cloudflared（~30MB）」按鈕（位於「IG 隧道工具」卡片），萬一未來再次發生可以手動觸發

### 影響範圍
- IG Reels 上傳（v0.1.x 起一直使用 cloudflared quick tunnel）
- IG 圖片 / Carousel 上傳（v0.3.0 起）
- v0.4.4 加的「auth 自動重試」遇到底層 tunnel 失敗時也能自動恢復

### 升級必裝
- 從 v0.4.5 直接覆蓋安裝 v0.4.6
- 無 schema 變動，資料 / 帳號 / 排程 / 監聽資料夾全部保留

### 技術細節
- `src/main/lib/tunnel.ts`
  - 新增 `downloadCloudflared()` 純下載函式（不檢查既存檔案）
  - 新增 `redownloadCloudflared()`：刪舊檔 + 重下載，回傳 `{ path, bytes }`（給 IPC 用）
  - 新增 `attemptTunnel(bin, port)`：拆出單次 spawn 流程，失敗丟出帶 stderr 細節的 Error
  - `serveFileViaCloudflareTunnel()` 改用 `attemptTunnel`，catch 後自動 `redownloadCloudflared()` + 再試一次
- `src/main/ipc/systemHandlers.ts`：新增 `system:redownloadCloudflared` IPC
- `src/preload/index.ts` + `src/shared/types.ts`：暴露 `system.redownloadCloudflared()`
- `src/renderer/src/pages/SettingsPage.tsx`：新增「IG 隧道工具」卡片 + 「重新下載 cloudflared」按鈕

---

## [0.4.5] - 2026-05-22｜🚨 修正 packaged 版動態 require 失敗（hotfix）

### 修正
- v0.4.4 在 packaged 版（裝完的 .exe）會跳「Cannot find module './accountsRepo'」錯誤
- 根本原因：electron-vite 把所有 main process 程式碼 bundle 進單一 `index.js`，但程式碼裡有 8 處 `require('./xxx')` 動態載入相對路徑模組 — 在 dev mode 可以（檔案還在硬碟），packaged 後 bundler 沒辦法解析這些路徑就 throw error
- 修正方式：把所有 8 處 dynamic require 改成檔案頂部 normal import：
  - `src/main/lib/metaTokenRefresher.ts`：`getAccountById`
  - `src/main/lib/folderWatcher.ts` × 2：`getWatchedFolderById`、`pathSep`
  - `src/main/lib/scheduler.ts`：`execute`
  - `src/main/ipc/watchersHandlers.ts`：`startAllWatchers / stopAllWatchers`
  - `src/main/ipc/systemHandlers.ts` × 3：`query / listPosts / net`
- 不會造成 circular dep（檢查過）

### 影響的功能
- v0.4.4 加的「IG/FB 失敗自動 refresh token + 重試」原本是 packaged 版會崩
- v0.4.1 的「資料夾監聽 → 處理新檔」原本也會在 packaged 版崩
- 設定頁的 stats、history CSV、update check 原本也會崩
- 全部 v0.4.5 修好

### 升級必裝
- 從 v0.4.0 ~ v0.4.4 任一版升上來都建議直接覆蓋安裝 v0.4.5
- 沒有 schema 變動，資料完全保留

---

## [0.4.4] - 2026-05-22｜🛡️ Meta 連線自動修復 + 配額偵測 + 帳號測試按鈕

### 新增功能

#### A. Meta token 失效自動 refresh + 重試
- 發布到 IG / FB 過程中遇到「Authorization Error」（OAuth Exception）→ 自動：
  1. 偵測這是 auth error（用 `parseMetaError` 判斷 code 190 / 102 / OAuthException / 401）
  2. 觸發 `runMetaTokenRefresh({ force: true })` 換新 user token + 重抓 Pages
  3. 用刷新後的新 token 自動再試 1 次
  4. 還失敗才真正標 failed
- 對你今天遇到的 IG `poll-status 階段失敗：Authorization Error` 直接解
- 不會造成無限重試 — 每個發布最多重試 1 次

#### B. Meta API 配額 / 錯誤友善訊息
- 新模組 `src/main/lib/metaErrorHelpers.ts` 把 Meta 錯誤分類：
  - `auth` (190/102/401/OAuthException) → 「授權失效，會自動續期」
  - `quota` (4/17/32/613/80004/80005 等) → 「24h 25 篇配額用完，請等待恢復」
  - `permission` (200/210/230/290) → 「權限不足，請重新連結並確認權限」
  - `invalid` (100) → 「參數錯誤：caption 太長 / 圖片格式 / 時間過期」
  - `transient` (5xx) → 「Meta server 異常，系統會自動重試」
  - `unknown` → 完整原始錯誤
- 所有 IG / FB 錯誤訊息走這個分類器，UI 看到的訊息都是中文友善版

#### C. 帳號頁「測試連線」按鈕
- 每個帳號卡片在「解綁」旁加 **🔍 測試** 按鈕
- 點下去 call 對應平台 API（YT: channels.list mine=true / FB: /{page-id}?fields=name / IG: /{ig-user-id}?fields=username）
- 跳通知顯示：
  - ✓ 成功：「YouTube 連線正常（頻道名）」+ 延遲 ms
  - ✕ 失敗：對應的 friendly message（含 Meta auth/quota 提示）
- 對診斷 token 狀況非常有用 — 不用試發影片就知道哪個帳號掛了

### 內部
- 新模組 `src/main/lib/metaErrorHelpers.ts`：`parseMetaError`、`isMetaAuthError`、`isMetaQuotaError`
- `metaTokenRefresher.ts` 加 `refreshUserTokenForAccount(accountId)` helper
- `facebookAdapter.ts`、`instagramAdapter.ts` 的 `fbError` / `igError` 改用新分類器
- `publishHandlers.ts` 加 `withMetaAuthRetry()` wrapper，包住 runFacebook / runInstagram 的 adapter call
- `accountsHandlers.ts` 新 IPC `accounts:testConnection`
- `AccountsPage.tsx` UI 加按鈕
- `shared/types.ts` PuffinAPI accounts 加 testConnection
- 對 user 你今天卡的問題：v0.4.4 裝完直接到歷史頁點「重新發布失敗的平台」就會自動 refresh token 後重試

### 你的工作流改善
| 場景 | v0.4.4 之前 | v0.4.4 之後 |
|---|---|---|
| Auth Error 發生 | 看訊息一頭霧水 + 手動解綁重連 | 自動 refresh + 重試，多數情況使用者完全不感知 |
| 想知道哪個帳號 token 還活著 | 試發一支影片 | 帳號頁點「🔍 測試」3 秒知道 |
| IG 24h 內超過 25 篇 | 顯示 generic error | 「已達 IG 24 小時 25 篇發布配額上限，請等待恢復」|

---

## [0.4.3] - 2026-05-22｜🧹 移除排程頁重複的 AutoLaunch toggle

### 修正
- **排程頁**頂部 Alert 內舊版本（v0.1.3）的「電腦開機時自動啟動 PuffinPuff」switch 被移除
- 此 switch 跟「設定」→「排程容錯」section 的主 switch 重複，且後者在 v0.3.3 增加了「自動保護機制」更完整
- 移除後 Alert 仍保留說明文字，提示前往設定頁調整：
  - **autoLaunch ON**：顯示「✓ 電腦開機時 PuffinPuff 自動啟動，24/7 排程不錯過」
  - **autoLaunch OFF**：顯示「⚠ 至『設定』→『排程容錯』打開以避免錯過排程」
- 避免使用者在兩處看到同樣設定造成混淆

### 內部
- `SchedulePage.tsx` 移除 `<Switch>` + 對應的 `handleToggleAutoLaunch`
- 移除未使用的 `Switch` import
- `autoLaunch` state 仍保留（只用來顯示 Alert 顏色）
- 改為每 10 秒輪詢 getAutoLaunch（捕捉使用者在設定頁的變更）

---

## [0.4.2] - 2026-05-22｜📊 觸及數據抓取（YT / FB / IG）

### 新增功能

#### 發布後一鍵抓取數據
歷史頁細節 Modal「各平台結果」標題列右側新增「**抓取數據**」按鈕（只在 completed / partial 狀態顯示）。

點下去 PuffinPuff 會：
1. 對每個成功發布的平台 target 呼叫對應 API
2. 把 views / reach / likes / comments / shares 寫進資料庫
3. UI 立刻顯示數據（不用重新整理）

#### 各平台對應 API
| 平台 | API | 抓什麼 |
|---|---|---|
| YouTube | `videos.list?part=statistics` | viewCount, likeCount, commentCount |
| Facebook | `/{post-id}?fields=likes.summary,comments.summary,shares,reactions` + `/insights?metric=post_impressions` | likes, comments, shares, reach |
| Instagram | `/{media-id}?fields=like_count,comments_count` + `/insights?metric=reach,plays/impressions` | likes, comments, views, reach |

⚠ 注意：
- IG insights 需要「商業帳號」(Business Account) 才能拿，個人帳號只能拿 like_count / comments_count
- FB insights 需要該 Page 有足夠的 `pages_read_engagement` 權限
- YT 純看公開資料，所有帳號都能拿

#### UI 呈現
每個平台 target 卡片下方顯示數據儀表板：
- 👁 觀看（YT views / IG plays）
- 📡 觸及（FB / IG reach）
- 👍 讚
- 💬 留言
- 🔄 分享
- 「抓取於 MM/DD HH:MM」時間戳記
- 失敗時顯示 ⚠ 紅色提示

### 內部
- DB schema v7：`post_targets` 加 views / likes_count / comments_count / shares_count / reach / stats_fetched_at / stats_error 欄位（ALTER）
- 新模組 `src/main/lib/statsCollector.ts`：3 個平台的 fetch stats 函式
- `postsRepo.ts` 新增 `updateTargetStats`
- 新 IPC `posts:fetchStats` 走主流程：拿 post → 對每個 success target 抓 → 寫 DB → 回傳更新後 targets
- `HistoryPage.tsx` PostDetail 加按鈕 + 數據顯示 + state 同步

### V0.4.3+ 規劃
- 排程：發布 24h / 7d 後自動抓
- 月曆事件按表現上色（高觸及綠 / 低觸及灰）
- 月報自動產出（含圖表）

---

## [0.4.1] - 2026-05-22｜📂 資料夾監聽自動排程（代操神器）

### 新增功能

#### 監聽資料夾、新檔自動排程
排程頁加「📂 監聽資料夾」按鈕 → Modal 內管理。

**運作流程**：
```
1. 你設定一個資料夾 + 模板（平台、帳號、Hashtag、標題模板、間隔）
2. 把影片直接丟到該資料夾
3. PuffinPuff 5 秒內偵測到新檔
4. 自動套模板建立排程（時間 = nextScheduleAt，間隔遞推）
5. 原檔移到「_processed/yyyy-mm/」子資料夾留紀錄
6. 跳系統通知告知
```

**Modal UI**：
- 列表顯示所有監聽中的資料夾
- 每個顯示：標籤、路徑、平台 icon、間隔、下次排程時間、enabled switch
- 新增 / 編輯：選資料夾、設標籤、設第 1 篇時間、間隔（小時）、平台、帳號、標題模板、Hashtag
- 刪除：跳確認，原已建立的排程不會被刪

**啟動行為**：
- App 啟動時自動載入所有 enabled watchers + setup fs.watch
- 也會掃一次資料夾撿掉漏接的新檔（App 關閉期間丟進去的）
- 5 秒 debounce（避免抓到複製中的檔案、避免事件重複）

**適用情境**：
- 代操客戶：客戶把素材直接丟到共享資料夾 / NAS → PuffinPuff 自動排
- 工作室：剪輯師 export 完直接存到資料夾就完事
- 一個人多帳號：素材夾分類後各自監聽，自動投放
- 24/7 內容工廠：拍片 / 剪片 / 上架完全管線化

### 內部
- DB schema v6：`watched_folders` 表（folder_path, label, enabled, template_json, next_schedule_at, interval_hours, last_processed_at, last_error...）
- 新模組 `src/main/lib/watchedFoldersRepo.ts`：CRUD
- 新模組 `src/main/lib/folderWatcher.ts`：fs.watch + 5s debounce + 處理流程 + 移檔
- 新 IPC `src/main/ipc/watchersHandlers.ts`：list / create / update / delete / pickFolder
- 新前端 `src/renderer/src/components/WatchersModal.tsx`
- `shared/types.ts` 加 WatchedFolder / WatcherTemplate / Create/Update Input
- 補上之前漏定義的 MetaUserTokenInfo / MetaTokenRefreshResult 型別

### 限制與後續
- 子資料夾不會被掃（不遞迴）
- 大檔案複製中時可能會誤觸（debounce 5 秒已大幅降低風險，但 USB 慢速複製可能 > 5 秒）
- 處理過的檔在 `_processed/yyyy-mm/` 內，會佔原資料夾空間 — 未來可加自動清理（v0.4.x）

---

## [0.4.0] - 2026-05-22｜🔁 失敗自動重試 + 匯出 CSV + 自動更新檢查

### 新增功能

#### 失敗自動重試（指數退避）
- 新模組 `src/main/lib/retry.ts` 提供 `withRetry()` helper
- 三個平台 adapter（YT / FB Reels / IG Reels）全部包上重試邏輯
- **只重試 transient errors**：
  - 網路層（ECONNRESET / ETIMEDOUT / DNS）
  - HTTP 429（rate limit）
  - HTTP 5xx（server error）
- **不重試 permanent errors**：
  - HTTP 4xx（除 429）：token 失效 / 內容違規 / 參數錯誤
  - 業務邏輯錯誤（例如 IG container ERROR/EXPIRED）
- 預設：最多 3 次重試、2s → 4s → 8s 退避
- 重試中 UI 顯示「重試 N/3（Ms 後）：錯誤訊息」

#### 匯出歷史紀錄 CSV
- 設定頁「資料管理」區塊新增「匯出歷史 CSV」按鈕
- 用 `dialog.showSaveDialog` 讓使用者選位置
- CSV 結構：每平台一列（方便 Excel pivot 分析）
  ```
  post_id, title, post_type, created_at, finished_at, overall_status,
  platform, account_name, target_status, remote_id, remote_url, error_message
  ```
- UTF-8 + BOM（Excel 自動正確顯示中文）
- 匯出後 notification 顯示路徑與筆數

#### 自我更新檢查
- 啟動時自動 fetch `https://mememaker-tw.com/puffinpuff/version.json` 比較版本
- 若有新版：
  - 設定頁「關於」section 顯示芒果黃徽章「🎉 有新版 v X.Y.Z」
  - 顯示「下載新版」按鈕（連到 downloadUrl）
  - 顯示更新內容（releaseNotes）
- 隨時可點「檢查更新」按鈕重查
- 失敗（無網路 / JSON 不存在）：靜默，不影響 App 運作

#### version.json 格式（後台部署在 mememaker-tw.com/puffinpuff/version.json）
```json
{
  "latest": "0.4.0",
  "downloadUrl": "https://mememaker-tw.com/puffinpuff/download/PuffinPuff-0.4.0-Setup.exe",
  "releaseNotes": "失敗自動重試 + 匯出 CSV + 自動更新檢查"
}
```

### 內部
- 新檔 `src/main/lib/retry.ts`
- `publishHandlers.ts` 三個 runX 函式全包 `withRetry()` + `onRetry` callback 更新 UI
- `systemHandlers.ts` 新增 `system:exportHistoryCsv` + `system:checkForUpdate`
- `shared/types.ts` PuffinAPI 加對應方法
- `SettingsPage.tsx` 新增匯出 CSV 按鈕 + 啟動自動 check + 關於區更新徽章/按鈕

### 升級建議
- 從 v0.3.x 直接覆蓋安裝
- 第一個 v0.4.0 安裝完，記得到 mememaker-tw.com 後台部署 version.json，未來新版就會自動通知

---

## [0.3.3] - 2026-05-22｜🛡️ AutoLaunch 永遠 ON 保護機制

### 新增功能

#### 「電腦開機自動啟動」自動保護
- **過去**（v0.2.8）：首次啟動自動 ON，但使用者一旦手動關掉就永遠關
- **現在**（v0.3.3）：App 每次啟動都檢查
  - 若 autoLaunch OFF + **沒有**「永久停用」標記 → 自動重新打開（保護排程）
  - 若有「永久停用」標記 → 完全尊重，不再干涉
- 預設行為：使用者誤關 / 被防毒/系統重置關掉 → 下次啟動自動修復

#### 設定頁新增「永久停用此保護」開關
- 位置：排程容錯 section 內，主 switch 下方一張卡片
- 預設關（即啟用保護）
- 卡片背景隨狀態變色：
  - 保護啟用中 → 薄荷綠
  - 永久停用 → 芒果黃（警告色提醒）
- 文字說明動態切換：
  - 啟用中：「✓ 即使你關掉上面 switch，App 下次啟動仍會自動重新打開（避免你忘記再次啟用導致排程不準）」
  - 永久停用：「⚠ 自動保護已停用：上面 switch 你關了就會永遠關」

#### 主 switch 行為調整
- 使用者手動關掉主 switch 時：
  - 若沒勾「永久停用」→ 跳黃色提醒「下次重啟會自動再打開，要永久關掉請勾下方的選項」（8 秒）
  - 若已勾「永久停用」→ 跳普通通知確認
- 「永久停用」開時，主 switch 顯示 disabled（避免使用者搞混）

### 內部
- `src/main/lib/autoLaunch.ts`：新增 `isAutoLaunchPermanentlyDisabled` / `setAutoLaunchPermanentlyDisabled` 函式
- 標記檔：`userData/.autolaunch_permanently_disabled`
- `src/main/index.ts` 啟動邏輯重寫：
  - 先檢查永久停用標記
  - 沒標記 + autoLaunch OFF → 自動修復
  - 首次啟動（無 `.first_run_done`）跳通知；後續修復靜默
- 新 IPC：`system:getAutoLaunchPermanentlyDisabled` / `system:setAutoLaunchPermanentlyDisabled`
- `shared/types.ts` 補齊 PuffinAPI 型別

### 設計理念
排程容錯是 PuffinPuff 的核心差異化價值。如果使用者誤關自動啟動 → 電腦關機就漏發排程 → 排程功能形同虛設。
v0.3.3 用「自動保護 + 永久停用開關」雙層機制：
- 一般用戶不會意識到這個機制存在（autoLaunch 永遠 ON）
- 真正不需要的人可以明確 opt-out（一個動作就解掉）

---

## [0.3.2] - 2026-05-22｜🎠 IG Carousel 多圖貼文（2-10 張）

### 新增功能

#### A 模式：subfolder = carousel
資料夾結構：
```
my-posts/
├── 001/                  ← 子資料夾 = carousel 貼文
│   ├── 1.jpg
│   ├── 2.jpg
│   ├── 3.jpg
│   └── caption.txt       ← 整個 carousel 的 caption
├── 002.jpg               ← 單張貼文
├── 002.txt
└── 003/
    ├── 1.png
    ├── 2.png
    └── caption.txt
```

- 子資料夾內 jpg/png/webp/gif 依檔名自然排序，第 1 張當「主圖」（封面）
- caption 從 `caption.txt`（建議名）或任何一個 .txt 讀取
- 上限 10 張（超過只取前 10）
- 不足 2 張 → 警告但仍當單張處理
- 子資料夾名稱當 baseName 顯示

#### B 模式：CSV filename 支援 `|` 分隔多張
```csv
filename,caption,hashtags,platforms,scheduled_at,account_alias
001_a.jpg|001_b.jpg|001_c.jpg,"3 張 carousel","#test","ig","2026-06-01 20:00",""
002.jpg,"單張","#test","fb,ig","2026-06-02 20:00",""
```

#### IG Carousel API 實作
- 新函式 `publishCarouselPost` in `instagramAdapter.ts`
- 流程：
  1. 每張圖依序起 cloudflared tunnel
  2. POST `/media?image_url=...&is_carousel_item=true` → 取得 N 個 child container ID
  3. 等所有 child 進入 FINISHED 狀態
  4. POST `/media?media_type=CAROUSEL&children=id1,...,idN&caption=...` → parent ID
  5. 輪詢 parent 直到 FINISHED
  6. POST `/media_publish?creation_id=parent_id` → 發布
  7. 關閉所有 tunnels
- 一次處理 2-10 張，全程進度回報

#### FB 多圖暫不支援（v0.3.3 規劃）
- 若 carousel + FB 啟用 → 預覽顯示警告「FB 不支援多圖貼文，會只發第 1 張」
- 該批貼文發 FB 時走單張流程（publishPhotoPost），caption 仍完整保留

#### UI 標記
- 預覽表「檔案 / Caption」欄旁顯示薰衣紫 badge「Carousel N 張」
- 解析度欄仍顯示主圖規格

### 內部
- `ImagePostPair` 加 `additionalImagePaths?: string[]`
- `ImagePostBulkRow` 加 `additionalImagePaths?: string[]`
- `PublishContent` 加 `imageCarouselPaths?: string[]`（給排程 trigger 用）
- `imagePostsScanner.ts` A 模式新增 subfolder 掃描；B 模式 filename 加 `|` 分隔解析
- `publishHandlers.ts` IG 分流時偵測 `args.content.imageCarouselPaths`，>= 1 → 走 carousel；否則走 single image
- `scheduleHandlers.ts` `bulkCreateImagePosts` 把 `row.additionalImagePaths` 寫進 content

### 已知限制（v0.3.3+ 規劃）
- FB Album / multi-photo post 尚未實作
- IG Stories carousel 不支援（Stories 是另一個 API）
- carousel 內每張圖的 alt text / tag 個別設定尚未支援

### 升級
- 直接覆蓋安裝 v0.3.2
- 既有資料完全不影響
- 想試 carousel：把幾張同主題的圖放進子資料夾 + caption.txt，丟進「批量圖文」即可

---

## [0.3.1] - 2026-05-21｜圖文 B 模式 CSV manifest + 解析度自動驗證

### 新增功能

#### B 模式：CSV manifest 精確控制每篇貼文
- 把 `manifest.csv` 放在圖文資料夾根層 → PuffinPuff 自動切到 B 模式
- CSV 格式：
  ```csv
  filename,caption,hashtags,platforms,scheduled_at[,account_alias]
  ```
- 每篇貼文獨立指定：時間、平台、Hashtag、目標帳號
- `platforms`：`fb` / `ig` / `fb,ig`
- `scheduled_at`：`YYYY-MM-DD HH:MM` / `YYYY/MM/DD HH:MM` / ISO 8601
- `account_alias`（選填）：`fb:粉專名稱 ig:Username` 用空格分隔；空白則用 Modal 預設帳號
- Modal 在 B 模式自動切換 UI：
  - 隱藏全域排程設定（時間/間隔/Hashtag）
  - 紫色資訊卡片提示「來自 CSV 控制」
  - 只剩「預設目標帳號」下拉（當 CSV 沒指定 account_alias 時用）

#### 圖片解析度自動驗證（IG 拒收前先警告）
- 拖入資料夾 → 用 `ffprobe` 並發掃每張圖的 width / height
- 預覽表新增「解析度」欄位顯示 W×H + 縱橫比
- IG 規則驗證：
  - 最低 320×320，低於這個會跳紅色錯誤標記
  - 縱橫比 0.8（4:5）~ 1.91（1.91:1），超出範圍跳警告
  - 過大解析度（> 1440×1800）跳「IG 會自動降到 1080 寬」提示
- 警告只是提示，使用者仍可確認排程；錯誤會被標 ✕ 並跳過該列

### 內部
- 新模組 `src/main/lib/imageProbe.ts`：用既有 ffprobe-static 取圖檔解析度（不新增依賴）
- `imagePostsScanner.ts` 變成 async；B 模式新增 `scanCsvManifestMode()` 用 `csv-parse/sync` 解析
- `shared/types.ts` `ImagePostPair` 加 `imageWidth/imageHeight` + B 模式專屬 `csv*` 欄位
- `ImagePostBulkModal.tsx` 加 mode 判斷、CSV 解析整合、解析度警告計算、預覽表加欄位

### CSV 範例

```csv
filename,caption,hashtags,platforms,scheduled_at,account_alias
001_勞資地雷1.jpg,"【企業勞資地雷 1】違法解雇\n\n（內文略）","#勞資顧問 #違法解雇","fb,ig","2026-06-02 20:00","fb:勞資領航者 ig:everpro.mita02"
002_薪資Q1.png,"員工常問 Q1：加班費怎麼算？","#薪資結構","fb","2026-06-03 14:30",""
003_對比.jpg,"✅ 合法 vs ❌ 違法：解雇程序","#勞動法","ig","2026-06-04 20:00",""
```

---

## [0.3.0] - 2026-05-21｜🎨 批量圖文模式上線（FB photos + IG single image）

### 新增功能（v1.2 大版本里程碑）

#### 批量圖文發布到 Facebook 粉專 + Instagram Feed
- 排程頁新增「**批量圖文**」按鈕（櫻花粉色按鈕，旁邊就是既有「批量影片」按鈕）
- 拖入「圖文資料夾」→ 自動配對每篇貼文的「圖檔 + 同名 .txt 文字檔」→ 批量排程
- **A 模式（配對檔案）**：001.jpg + 001.txt、02_勞資地雷.png + 02_勞資地雷.txt
  - 圖檔支援 jpg / png / webp / gif
  - 文字檔 UTF-8 編碼、整檔內容當作 caption
  - 配對失敗（孤兒圖 / 孤兒 txt / 空檔）會顯示警告但不中斷
  - 自然排序（001 在 010 之前）
- **B 模式（manifest.csv）**：v0.3.1 預告，目前偵測到會跳提示
- 排程規則：每日定時（起始日 + 時間 + 每 N 天 + 跳週末），整批用同一規則
- 每平台目標帳號可選（如同 v0.2.9 批量影片）

#### 後端架構
- **schema v5**：`posts` 表加 `post_type TEXT DEFAULT 'video'` 欄位
- **新 module** `src/main/lib/imagePostsScanner.ts`：掃資料夾、配對、回傳 ImageFolderScanResult
- **FB photo API**：`publishPhotoPost` 用 `POST /{page-id}/photos`（multipart upload，Node 18+ 原生 FormData + Blob）
- **IG image API**：`publishImagePost` 用 IG Container API（IMAGE 模式 vs Reels 的 REELS 模式），同樣走 cloudflared tunnel 暴露公開 URL
- **publishHandlers 分流**：依 `postType` 決定走 video adapter 或 image adapter；圖文模式自動排除 YouTube + 跳過自動轉檔
- **scheduler 傳 postType**：排程觸發時把 postType 一起傳給 publish trigger
- 新 IPC：`schedule:scanImageFolder`、`schedule:bulkCreateImagePosts`

#### 前端架構
- 新元件 `ImagePostBulkModal.tsx`（獨立 component，不污染既有 BulkImportModal）
- 拖放區 + Modal 切配色（櫻花粉系，跟影片模式的薄荷綠區分視覺）
- 預覽表：縮圖、檔名、Caption 前 60 字、排程時間、平台 icon、錯誤
- shared types 新增 `PostType`、`ImagePostPair`、`ImageFolderScanResult`、`ImagePostBulkRow`

### 適用情境
- 勞資 / 法律 / 健康顧問品牌：每月 30 篇知識圖卡
- 餐廳 / 寵物店 / 健身房：每週菜色 / 商品圖文
- 行銷代操：客戶月度內容批量排程

### 配套文件
完整 7 篇圖文內容企劃方法論已在 v0.2.8 階段寫好：
```
docs/image-post-planning/
├── 00_overview.md
├── 01_topic_planning_framework.md    ← 8 種主題框架
├── 02_chatgpt_prompt_templates.md    ← 10 種 prompt 模板（一次產 30 篇）
├── 03_image_generation_guide.md      ← Canva / Lovart / 免費圖庫
├── 04_folder_naming_convention.md    ← A 模式命名規則
├── 05_csv_manifest_template.md       ← B 模式（v0.3.1 上線時用）
└── 06_workflow_example.md            ← 勞資顧問 30 天完整實戰
```

### 已知限制
- ❌ B 模式（CSV manifest）尚未實作，移到 v0.3.1
- ❌ IG Carousel 多圖貼文尚未支援
- ❌ FB Album / IG Stories 尚未支援
- ❌ 圖片解析度自動驗證（IG 320×320 最小要求）尚未實作 — 失敗會在發布時才看到平台錯誤
- ✅ 但 token 自動續期、排程容錯、多帳號、自動 GC 等 v0.2.x 功能全部適用

### 升級
- 直接覆蓋安裝 v0.3.0
- 既有影片排程 + 影片批量功能完全不影響
- 圖文功能直接可用（不需要新的 OAuth 授權）

---

## [0.2.9] - 2026-05-21｜批量影片匯入加多帳號選擇

### 新增功能

#### 批量排程現在可以選目標帳號
- 過去批量匯入 30 支影片時，會 fallback 到「accounts[0]」（DB 第一個帳號）
- 對代操多客戶情境很痛：無法把 A 批排到客戶 A、B 批排到客戶 B
- v0.2.9 加：批量匯入 Modal 在「發布平台」下方新增每平台帳號下拉
  - 顯示該平台所有已連結帳號
  - 自動選第一個當預設（向後相容）
  - 沒連結該平台帳號 → 下拉 disabled + placeholder 提示去連結
- 整批 30 支影片**用同一組帳號**發布（解決 80% 場景）
- 缺帳號的列會被標 error 而非默默 fallback

### 已知限制（v0.3.0 解）
- 目前批量只能整批選同一帳號，無法逐篇分散到不同客戶
- v0.3.0 圖文模式 CSV manifest 將支援逐篇 `account_alias` 欄位

### 內部
- `shared/types.ts` `BulkScheduleRow` 加 `targetAccounts: { youtube?, facebook?, instagram? }`
- `scheduleHandlers.ts` `buildContentFromRow` 接收 `targetAccounts` 傳進 `perPlatform[platform].accountId`
- `scheduleHandlers.ts` `bulkCreate` IPC 把 row.targetAccounts 傳下去
- `SchedulePage.tsx` `BulkImportModal` 加 accounts state + Select 下拉 × 3 + 缺帳號驗證
- 排程觸發時 `publishHandlers.ts` 既有的 `override.accountId` 邏輯就會自動套用（v0.2.1 已實作）

### 升級
- 直接覆蓋安裝 v0.2.9 即可
- 已有的排程 (v0.2.8 以下建立的) 仍 fallback 到 accounts[0]
- 新建立的批量排程開始走「明確帳號」邏輯

---

## [0.2.8] - 2026-05-21｜首次啟動自動開啟「電腦開機自動啟動」

### 新增功能

#### 排程容錯保護預設啟用（首次啟動）
- 過去「電腦開機自動啟動 PuffinPuff」是 opt-in switch，預設 OFF
- 但這個功能是排程容錯最後一塊拼圖（電腦關機 = 排程必錯過）
- 新使用者裝完往往沒注意到要去設定頁勾，因此 **v0.2.8 改為首次啟動時自動 ON**
- 用 `userData/.first_run_done` 標記檔判斷：
  - 標記檔不存在 → 首次啟動 → setAutoLaunch(true) + 跳系統通知 + 寫標記
  - 標記檔已存在 → 老使用者 → 完全不干涉現有設定
- 使用者隨時可至「設定」→「排程容錯」手動關閉

### 為什麼這樣改
- 排程容錯的底層保護（DB 立即落盤、崩潰恢復、6 小時內補發）本來就永遠啟用
- 但「開機自動啟動」是讓「24/7 待命」變可能的關鍵 — 沒開等於前面那些保護半個用不到
- 新使用者「裝完就有完整保護」是正確的預設值

### 內部
- `src/main/index.ts` 啟動流程加 first-run 檢測
- 使用 `userData/.first_run_done` 標記檔（內含 enabledAt + version）
- 失敗只 console.warn，不會 crash App

### 升級
- 直接覆蓋安裝 v0.2.8 即可
- 已裝過 v0.2.7 以下版本的使用者**不會被覆蓋**（標記檔由 v0.2.8 開始建立，舊 userData 沒有此檔 → 第一次跑 v0.2.8 就會 setAutoLaunch(true)）
- 想保持原樣（不要自動開）的老使用者可在裝完後馬上到設定頁手動關掉

---

## [0.2.7] - 2026-05-21｜設定頁顯示 Meta token 狀態 + 立即刷新按鈕

### 新增功能

#### 設定頁新增「Meta 連線自動續期」區塊
- 顯示目前儲存的所有 Meta long-lived user token（每連結一個 FB 用戶會有一筆）
- 每筆顯示：
  - FB 使用者名稱 + FB User ID
  - **剩餘天數徽章**（顏色預警：> 7 天綠色 mint / 7 天內芒果黃 / 已過期紅色）
  - token 到期時間（精確日期）
  - 上次自動續期執行時間（若有跑過）
  - 上次錯誤訊息（若 refresh 失敗）

#### 「立即刷新 Meta token」按鈕
- 強制執行一次 token refresh（不等 7 天到期視窗）
- 對每個 user token：
  - 成功 → 換新 60 天 token，重新抓 /me/accounts 同步所有 Page / IG token
  - 失敗 → 寫入 last_refresh_error 欄位讓 UI 顯示
- 結果以 notification 摘要：「續期 N 個、仍新 N 個、失敗 N 個」

#### 解決使用者「我怎麼知道自動續期真的有在跑？」的疑慮
- 之前 v0.2.5 雖然實作了自動續期但完全沒 UI 可看
- 現在使用者能在設定頁看到所有 token 的狀態 + 主動觸發測試

### 內部
- `SettingsPage.tsx` 新增「Meta 連線自動續期」Card
- 用 `system:listMetaUserTokens`、`system:refreshMetaTokens` IPC（v0.2.5 已實作）
- 沒有改任何後端邏輯，純前端 UI 與資料展示
- 新 icon imports：`IconKey`（標題）、`IconAlertTriangle`（錯誤狀態）

### 升級
- 直接覆蓋安裝 v0.2.7 即可
- 已重新連結 Meta 的使用者（v0.2.5+ 後做過）會立即看到 token 狀態
- 還沒重新連結的會看到「尚未啟用」提示，引導到帳號頁

---

## [0.2.6] - 2026-05-21｜OAuth 視窗不再自動跳 DevTools

### 修正
- **Meta OAuth 授權視窗**過去無論在 dev 或 packaged 版本都會自動彈出 DevTools 視窗，
  對一般使用者造成困擾（看到一堆程式碼介面以為當機）
- 改為**只在開發模式（`!app.isPackaged`）**才自動跳 DevTools
- 同時把 `webPreferences.devTools` 從預設 `true` 改為 `!app.isPackaged`，
  packaged 版本連按 F12 都不會跳 DevTools，更乾淨

### 內部
- 修改 `src/main/oauth/metaOAuth.ts` line 164、174 的條件式
- Google OAuth 走 loopback flow（系統瀏覽器），本來就無此問題

### 升級
- 直接覆蓋安裝 v0.2.6 即可，無需重新連結帳號
- v0.2.5 的 Meta token 自動續期功能保留

---

## [0.2.5] - 2026-05-21｜Meta long-lived token 自動續期

### 新增功能

#### Meta user token 自動續期（背景每日檢查）
- Meta long-lived user token 預設 60 天到期，原本到期後使用者需手動到「帳號」頁重新連結 Meta
- v0.2.5 新增 `meta_user_tokens` SQLite 表（schema v4），OAuth 完成時把 user-level 60 天 token 加密存入
- **App 啟動 30 秒後** + **每 24 小時** 自動跑 refresh 檢查：
  - 任何 token 剩餘到期 < 7 天 → call `GET /oauth/access_token?grant_type=fb_exchange_token` 換新 60 天 token
  - 成功後重抓 `/me/accounts` 並 upsert 所有對應的 FB / IG 帳號 token（避免 user token 換了但 Page token 沒同步）
  - 成功跳 Windows 通知「已自動續期 Meta 連線」
  - 失敗跳 Windows 通知「Meta 連線需要重新授權」並把錯誤訊息存入 `last_refresh_error` 欄位
- **設定頁可手動觸發**：「立即刷新 Meta token」按鈕（不等 7 天視窗，強制 refresh）

### 為什麼重要
- 配合即將申請的 Meta App Review，token 永久有效是「永不過期」的最後一塊拼圖
- 排程功能即使長期不打開 App 設定頁，背景也會自己保證 token 不過期
- 失敗情況有明確訊息與通知，不會默默失敗

### 內部
- 新增 `src/main/lib/metaUserTokens.ts`：CRUD + 加密存取
- 新增 `src/main/lib/metaTokenRefresher.ts`：refresh 邏輯 + setInterval 排程
- 修改 `src/main/oauth/metaOAuth.ts`：OAuth 完成時呼叫 `upsertMetaUserToken`
- 修改 `src/main/index.ts`：啟動時 `startMetaTokenRefreshSchedule()`，結束時 `stopMetaTokenRefreshSchedule()`
- 修改 `src/main/lib/database.ts`：加 schema v4 migration
- 新增 IPC：`system:listMetaUserTokens`、`system:refreshMetaTokens`
- `shared/types.ts` 新增 `MetaUserTokenInfo` / `MetaTokenRefreshResult` 型別

### 升級注意事項
- 從 0.2.4 升級不會自動填 `meta_user_tokens` 表（沒辦法，舊版沒留 user-level token）
- **建議升級後到「帳號」頁解除 Meta 後重新連結一次**，啟用自動續期
- 若不重新連結，原有的 Page token 仍可用（直到 user token 過期），但無法享受自動續期保障

---

## [0.2.4] - 2026-05-21｜啟動自動 GC + 一鍵取消全部排程

### 新增功能

#### 啟動自動 GC（避免轉檔 / 縮圖快取無限累積）
- **App 啟動時**自動掃 `userData/transcoded/` 與 `userData/thumbs/`
  - 轉檔暫存：**30 天未存取（atime）的檔案自動刪除**（典型大小 5–50MB / 個）
  - 縮圖快取：**90 天未存取的檔案自動刪除**（典型大小 ~50KB / 個）
  - GC 在 `setImmediate` 背景跑，不阻塞 App 啟動
- **GC 結果寫進 `userData/.last_gc.json`**，設定頁可看：
  - 上次執行時間
  - 各別刪除 / 掃描檔案數量
  - 各別釋放空間
- 設定頁新增「**立即清理**」按鈕：可手動觸發一次（用同樣的 30/90 天規則）
- 新 IPC：`system:getLastGc`、`system:runGcNow`

#### 排程「取消全部排程」按鈕
- SchedulePage 標題列新增紅色「取消全部排程」按鈕（旁邊就是「批量匯入資料夾」）
- 點下去跳確認 Modal：「將取消目前所有 N 筆排程……此動作無法復原」
- 確認後：
  - 取消所有 node-schedule in-memory job
  - 從 DB 刪除所有 `status='scheduled'` 紀錄（targets 由 FK CASCADE 自動清）
  - 立即落盤（`flushDatabase`）
  - 跳通知告知實際取消數量
- 排程列表為空時按鈕自動 disabled

### 為什麼這兩個重要
- **自動 GC**：之前轉檔快取沒有任何自動清理機制；長期排程批量發布的使用者可能每月累積 1GB+，一年累積 7-15GB。現在保持「自然新陳代謝」
- **取消全部排程**：批量匯入後若發現整批設定錯（時間錯 / 平台錯 / 用了錯的工作日邏輯），舊版只能一筆一筆取消。現在一鍵清光

### 內部
- 新增 `src/main/lib/cacheGc.ts`：`runCacheGc()`、`readLastGcResult()`、`GcRunResult` 型別
- `scheduler.ts` 新增 `cancelAllScheduledPosts()`：先掃 DB scheduled posts、取消 in-memory jobs、刪 DB row、flush
- 新 IPC：`schedule:cancelAll`
- `shared/types.ts` 新增 `GcResult` / `GcDirStats` 型別
- 設定頁「資料管理」區塊新增 GC 狀態列 + 立即清理按鈕

### 安全性
- GC 用 `Math.max(atimeMs, mtimeMs)`：避免 Windows 預設 atime 不即時更新而誤刪「最近建好但還沒被讀過」的檔
- GC 失敗（讀目錄 / unlink）只 console.warn，不會 crash App
- App 還沒跑過 GC 時 `getLastGc()` 回傳 null，UI 顯示「尚未執行過自動清理」

---

## [0.2.3] - 2026-05-21｜V1.1 收尾：轉檔快取清理 + 錯誤可複製 + 影片預覽放大

### 新增功能

#### 轉檔快取清理（設定頁）
- **F12 設定頁 → 資料管理** 新增「🎬 轉檔快取」徽章與「清空轉檔快取」按鈕
- 即時顯示快取數量與佔用磁碟（與縮圖快取並排）
- 清空前彈出確認 Modal，告知「下次發布相同來源影片會重新轉檔（多花 30–90 秒）」
- 對應 IPC：`system:clearTranscoded`、`SystemStats.transcodedCount` / `transcodedBytes`

#### 錯誤詳情複製成 Markdown
- 歷史頁細節 Modal 對「失敗 / 部分成功」紀錄新增「**複製錯誤 Markdown**」按鈕
- 一鍵把整筆失敗訊息整理成 Markdown 區塊（含影片路徑、發布時間、各平台狀態與錯誤訊息）
- 方便丟到 ChatGPT / Notion / Email 求助與紀錄
- 字數標題等元資料也一併附上，省去使用者手動截圖再描述的步驟

#### 影片預覽放大（Modal）
- 新增 `VideoPreviewModal` 元件：在歷史頁／排程細節點縮圖即可彈出放大預覽
- 自動偵測檔案類型（影片 vs 圖片），影片用 HTML5 `<video controls autoplay>`、圖片用 `<img>`
- 黑色背景 + 80vw / 80vh 居中、保持完整縱橫比
- 用 `puffin-media://` 協定讀本機檔，不暴露真實路徑到 renderer

#### 多帳號 UI 顯示（確認）
- 確認 `AccountsPage` 已正確支援同平台多帳號顯示（依平台分區、每個帳號獨立卡片）
- 對應 `ContentEditor` 也已有下拉切換（0.2.1 已實作），這次純粹補確認測試

### 內部
- `src/main/ipc/systemHandlers.ts`：新增 `system:clearTranscoded` IPC、`getStats()` 回傳 transcoded 兩個欄位
- `src/renderer/src/components/VideoPreviewModal.tsx`：新建
- `src/renderer/src/pages/HistoryPage.tsx`：加 `buildErrorMarkdown()`、`copyToClipboard()` + Modal 整合
- `src/renderer/src/pages/SchedulePage.tsx`：細節 Modal 縮圖點擊整合 VideoPreviewModal
- `src/renderer/src/pages/SettingsPage.tsx`：加轉檔快取統計與清空按鈕

### V1.1 完整收官
本版完成 V1.1 階段所有 polish 項目：
- 0.2.0 草稿載回 + F12 設定頁 + F5b 自動轉檔
- 0.2.1 多帳號發布選擇
- 0.2.2 常駐系統匣
- **0.2.3 轉檔清理 + 錯誤複製 + 影片預覽 + 規劃文件 v0.9**

---

## [0.2.2] - 2026-05-21｜常駐系統匣（背景運作確保排程不錯過）

### 新增功能
- **PuffinPuff 改為常駐 App**：點關閉按鈕（X）不會結束程式，而是隱藏到系統匣
- **系統匣圖示**（右下角箭頭內，海鸚 logo）：
  - **左鍵**：顯示主視窗
  - **雙擊**：同上
  - **右鍵選單**：顯示主視窗 / 快速跳到任一頁（發布、排程、歷史、帳號、設定）/ 完全結束 PuffinPuff
  - Tooltip：「海鸚泡芙 PuffinPuff（背景運作中）」
- **第一次隱藏到 tray 時**跳系統通知告知，避免使用者以為 App 失蹤
- **真正結束**：透過 tray 右鍵選單最底「完全結束 PuffinPuff」項目，或 Alt+F4 配合 tray menu
- **單一實例鎖**：重複執行安裝檔不會開第二個 App，會把現有視窗叫到前面

### 為什麼這個重要
- 排程功能**只在 App 運作時才會即時觸發**
- 之前用戶不小心按了 X → App 退出 → 排程到期不會發
- 現在按 X → 視窗消失但 App 仍在背景跑、scheduler 持續工作
- 配合「開機自動啟動」設定 → 24/7 都能準時發布

### 內部
- `BrowserWindow.on('close')` 攔截、設 `event.preventDefault()` + `mainWindow.hide()`
- `isQuitting` flag：tray「完全結束」設為 true、`before-quit` 也設 true
- `app.on('window-all-closed')` 不再呼叫 `app.quit()`（避免關視窗就退出）
- `app.on('before-quit')` 統一清理 scheduler、DB、tray
- 新增單一實例鎖（`requestSingleInstanceLock` + `second-instance` event）
- `electron-builder.yml` 加 `extraResources: build/icon.png + icon.ico` 讓 packaged 版能讀到圖示

### 使用情境
| 行為 | 結果 |
|---|---|
| 按視窗 X | 隱藏到 tray，背景持續運作 |
| 從 tray 點圖示 | 主視窗顯示回來 |
| 從 tray 右鍵點任一頁 | 主視窗顯示並切到該頁 |
| 從 tray 右鍵「完全結束」 | 真正結束所有資源、退出 App |
| 重複執行 Setup.exe 安裝後的捷徑 | 既有 App 浮上來，不會開第二個 |

---

## [0.2.1] - 2026-05-21｜多帳號選擇

### 新增功能
- **每平台可選帳號**：若某平台連線 2 個以上帳號，ContentEditor 該平台分頁顯示下拉選單；單一帳號則顯示帳號頭像 + 名稱確認；零帳號顯示警示
- **publishHandlers 邏輯**：尊重 `override.accountId`，未指定才 fallback 到 `accounts[0]`
- 帳號頁 `加入另一個帳號` 按鈕本來就支援多連線，這次補齊發布端的選擇 UI

### 適用情境
- 連兩個 YouTube 頻道（個人 + 品牌）→ 發布時下拉選要發到哪個
- 連多個 FB 粉專 → 同一支影片發到不同粉專而不亂搶
- IG 一帳號（透過 FB 粉專）目前仍是 1 對 1，但若未來連多個粉專自動帶出對應 IG

### 內部
- `PlatformOverride` 加 `accountId?: number`
- `ContentEditor` 載入 accounts.list() 並依平台分組
- 帳號變化會即時反映在 chip + 各分頁

---

## [0.2.0] - 2026-05-21｜V1.1 三大 polish：草稿載回 + 設定頁 + 自動轉檔

### 新增功能

#### 草稿載回繼續編輯
- 歷史頁細節 Modal 對「草稿」狀態紀錄，新增「**繼續編輯此草稿**」按鈕
- 點下去自動切到發布頁、載入儲存的影片 + 內容、原草稿自動刪除避免重複
- 編輯完可重新發布、加入排程、或再存新草稿

#### F12 設定獨立頁
- **排程容錯區塊**：搬入「電腦開機自動啟動」switch（原本散在排程頁）
- **資料管理區塊**：
  - 即時顯示 📊 歷史紀錄筆數 + 🖼 縮圖快取數量/大小
  - 打開資料夾位置（也可從說明選單觸發）
  - 清空縮圖快取（保留已用的會自動重生）
  - 清空歷史紀錄（**不會**刪排程中與授權 token）
  - 兩個清空動作都有確認 Modal 防止誤觸
- **關於區塊**：版本、Slogan、版權
- **通用偏好區塊**：通知 / 自動轉檔開關（V1.1 顯示為已啟用、不可關，預留 V1.5 整合）
- 完整 userData 路徑可複製

#### F5b 自動轉檔
- 發布前自動偵測媒體規格：若任一啟用平台 needsTranscode → 觸發 FFmpeg 轉檔
- **目標格式**：H.264 + AAC + yuv420p + 1080×1920 + 30fps + faststart（三平台都吃）
- **比例適配**：先 scale 縮到 9:16 框內、再 letterbox 加黑邊置中（保留完整畫面）
- **快取機制**：以「檔案路徑 + 大小 + mtime」hash 命名輸出檔，重發同片不會重轉
- **進度即時回報**：PublishProgress UI 顯示黃色「影片預處理中」卡片 + 進度條 + 已處理秒數 / 總秒數
- 轉檔失敗時 fallback 用原檔上傳（讓使用者看到平台層的錯誤訊息）

### 內部
- 新增 `src/main/lib/transcoder.ts`
- `PublishJobState.transcoding`（optional）攜帶轉檔進度
- `startPublishJob` 預處理階段：probe → validate → 條件性 transcode → 用新路徑上傳
- 新增 IPC `system:getStats`、`system:clearHistory`、`system:clearThumbnails`、`system:getDataFolder`、`system:openDataFolder`、`system:getVersion`
- App.tsx 改為條件渲染（不再用 PAGE_MAP），支援 props 傳遞（onLoadDraft / draftIdToLoad）

---

## [0.1.9] - 2026-05-20｜檔名自動清理前綴

### 變更
- `cleanFilename()`：替換 `{檔名}` 時自動去除常見的編號 / 英數 ID / 日期前綴
- 受影響範圍：單支發布拖入影片 + 批量匯入資料夾每列

### 會被自動 strip 掉的前綴

| 模式 | 範例輸入 | 替換後 |
|---|---|---|
| 純數字 + 分隔 | `01-工作寫四萬.mp4` | `工作寫四萬` |
| 多位數字 + 分隔 | `001_勞動爭議.mp4` | `勞動爭議` |
| 日期 | `2024-01-15-真實案例.mp4` | `真實案例` |
| 緊湊日期 | `20240115_面試技巧.mp4` | `面試技巧` |
| 短英數 ID | `acv_工作寫四萬.mp4` | `工作寫四萬` |
| 多字母 ID | `IMG_1234_勞動爭議.mp4` | `勞動爭議` |
| 含 ID + 數字組合 | `VID20240101_案例.mp4` | `案例` |
| 括號編號 | `[Episode 5] 案例.mp4` | `案例` |
| 圓括號編號 | `(EP01) 工作寫四萬.mp4` | `工作寫四萬` |
| **複合前綴** | `acv-001-工作寫四萬.mp4` | `工作寫四萬` |
| **日期 + 編號 + ID** | `20240115_001-acv_案例.mp4` | `案例` |

### 不會被 strip 的（避免誤刪）

- 中文字元前綴：`企業軍師-案例.mp4` → `企業軍師-案例`（保留）
- 沒有分隔字元時的英文：`Title案例.mp4` → `Title案例`（無 ` - / _ . ` 分隔不視為前綴）
- `Episode 5 - 標題` 這種帶空格的句構：保留（避免誤刪有意義的章節編號）
- 全 strip 變空字串 → 退回去副檔名後的原始檔名（安全 fallback）

### 內部
- `substituteTitleFilename` 內部呼叫 `cleanFilename` 而非單純 strip 副檔名
- 遞迴 strip 直到結果不再變動（處理 `acv-001-` 等複合情況）

---

## [0.1.8] - 2026-05-20｜排程改月曆檢視（萬年曆 + 天/週/月）

### 變更
- **SchedulePage 改用 react-big-calendar 呈現**：每筆排程以彩色塊塊顯示在對應日期與時刻
- **可切換三種模式**：天 / 週 / 月（頂部工具列）
- **繁體中文 locale**：dayjs zh-tw、星期幾用中文、訊息全中文
- **配色與 Mantine 主題一致**：今日格用芒果黃 #FCE4A6 強調；排程事件用薰衣紫漸層（依該排程啟用的平台數量深淺）
- **點任一事件**：打開細節 Modal 顯示完整資訊（縮圖、標題、預定時間、平台、描述、Hashtag）+ 可一鍵取消排程
- **自動更新**：每 5 秒重新讀取資料庫；事件位置自動跟隨日期變動

### 視覺對應
| 啟用平台數 | 事件色 |
|---|---|
| 3 個（YT + FB + IG 全發）| 深薰衣紫 `#D8C6E8` |
| 2 個 | 中薰衣紫 `#E6DAEE` |
| 1 個 | 淺薰衣紫 `#F0E8F5` |

### 操作提示
- 月檢視：每天最多顯示幾筆 + 「N 更多…」彈出
- 週檢視：時間軸 6:00–23:59
- 天檢視：詳細時間軸看單日完整排程
- 上 / 下一頁：頭部「◀ / ▶」按鈕；「今天」按鈕回到當下

---

## [0.1.7] - 2026-05-20｜套用品牌預設文案 + 移除 YT 頻道預設開關

### 變更
- **移除**「使用 YouTube 頻道預設上傳資料」開關（在共通與 YouTube 分頁皆移除）
- **預設文案改為勞資領航者品牌模板**：
  - 預設標題模板：`【勞資領航者｜企業軍師 林郁汶】{檔名} #薪資結構 #資遣費計算 #勞資調解 #勞資糾紛`
  - 預設 Hashtag：`#勞資顧問 #勞動法規 #企業勞資管理 #勞資調解 #勞資糾紛 #薪資結構 #資遣費計算 #職災保險 #勞資講座 #企業顧問`
  - 描述欄位仍為空，用戶自行填寫共用內容
- **新增 `{檔名}` placeholder**：標題模板中 `{檔名}` 會自動替換為當下影片的檔名（去副檔名）
  - 單支發布：拖入影片後立即替換
  - 批量匯入：每列依該影片檔名替換
  - 替換後標題可繼續編輯
- **批量匯入 Modal 改動**：
  - 「自動去副檔名」checkbox 移除
  - 新增「標題模板」TextInput（含使用說明）
  - 「共通 Hashtag」預填品牌標籤
  - 用戶仍可改全域模板，也可逐列覆寫單一標題

### 範例（檔名為 `2026-04-勞動爭議處理.mp4`）
- 套用模板後預填的標題：
  `【勞資領航者｜企業軍師 林郁汶】2026-04-勞動爭議處理 #薪資結構 #資遣費計算 #勞資調解 #勞資糾紛`

---

## [0.1.6] - 2026-05-20｜修正 packaged 版的 ffprobe / ffmpeg 路徑

### 修正
- 在已安裝版本（非 dev mode）匯入影片會跳 `media:probe ENOENT` 錯誤
  - 原因：ffprobe-static / ffmpeg-static 的 `.path` 指向 `app.asar` 內部，但 Windows binary 無法從 asar 直接執行
  - 修正：spawn 前把路徑 `app.asar` 替換成 `app.asar.unpacked`（electron-builder 已把它們解壓到此）
- 對應檔案：`src/main/lib/mediaProbe.ts`、`src/main/lib/thumbnailer.ts`

### 升級指引
- 直接執行 0.1.6 Setup.exe 覆蓋安裝即可，所有資料保留

---

## [0.1.5] - 2026-05-20｜升級資料保留 UX 強化

### 確認 / 強化：升級安裝完全不會碰用戶資料

**架構保證**：所有 runtime 資料都在 `%APPDATA%\海鸚泡芙 PuffinPuff\` 而非安裝目錄：

| 資料 | 位置 | 升級後 |
|---|---|---|
| SQLite DB（排程、歷史、帳號 token） | `userData\puffinpuff.db` | ✅ 保留 |
| Cloudflared 二進位 | `userData\bin\` | ✅ 保留 |
| 影片縮圖 | `userData\thumbs\` | ✅ 保留 |
| Token 與 Refresh Token | DB 內 DPAPI 加密 | ✅ 保留 |

`electron-builder.yml` 設 `deleteAppDataOnUninstall: false`，**連卸載都不刪資料**。

### 新增 UX
- **「說明」選單 → 關於海鸚泡芙** dialog 加入「資料位置」說明 + 「打開資料夾」按鈕
- **「說明」選單 → 開啟資料夾位置**（Ctrl+Shift+D）一鍵在檔案總管開啟 userData 資料夾
- **啟動 log** 列印資料夾路徑，方便除錯與備份

### 升級操作建議
1. 直接執行新版 `Setup.exe` 即可（不必先卸載舊版）
2. NSIS 偵測到舊版會詢問升級
3. 完成後桌面捷徑指向新版、資料完全延續
4. 若想備份：複製 `%APPDATA%\海鸚泡芙 PuffinPuff\puffinpuff.db` 即可保留所有狀態

---

## [0.1.4] - 2026-05-20｜失敗紀錄可重新發布 / 重新排程

### 新增功能
- **歷史頁列表**：失敗 / 部分成功的紀錄列右側新增 🔁「重新發布」按鈕
- **歷史頁細節 Modal**：失敗的 post 顯示「可執行的動作」分區
  - 🟢 **重新發布失敗的平台**：只重試 status='failed' 的目標，已成功的不會被重發
  - 🟣 **重新排程到未來時間**：DateTimePicker 選未來時間 → 改回 scheduled 狀態 + 註冊到 scheduler

### 行為細節
- 重新發布**只重試失敗平台**（YT 成功、FB 失敗的 case，只重試 FB；YT 那邊不會被覆蓋）
- 重新發布完成後從 DB 重讀所有 targets 計算整體狀態（修正舊版用「當次 job 範圍」計算的 bug）
- 重新排程把 post 狀態 `failed` → `scheduled`、清掉 finished_at、註冊到 node-schedule
- 兩個動作都會自動關閉細節 Modal 並刷新列表

### 內部改動
- `publishHandlers.ts` 新增 `republishExistingPost()` + IPC `publish:republish`
- `scheduler.ts` 新增 `reschedulePost()` + IPC `schedule:reschedule`
- 完成發布後改用 `getPost(jobId)` 重讀全部 targets 計算 overallStatus

---

## [0.1.3] - 2026-05-20｜排程容錯與意外保護

### 新增功能（避免排程記錄與進度遺失）
- **建立排程立即落盤** — `createScheduledPost` 與 `cancelScheduledPost` 都會 `flushDatabase()` 同步寫硬碟，不再受 500ms debounce 期間 App 被殺掉的影響
- **崩潰恢復** — App 啟動時掃描 `status=publishing` 但 30 分鐘以上沒更新的紀錄，標為失敗並寫入原因「App 在發布中意外結束」；同時釋放卡住的 target
- **過時排程策略** — 排定時間晚於現在 6 小時以上的 scheduled 紀錄不會亂發；自動標為失敗、跳出系統通知說明
- **錯過的排程自動補發** — 排定時間在過去但仍在 6 小時內的，App 啟動後立即觸發
- **開機自動啟動切換** — SchedulePage 加 Switch，啟用後電腦開機 PuffinPuff 自動啟動接管排程
- **排程容錯說明卡** — SchedulePage 頂部 Alert 解釋三層保護機制與當前 autoLaunch 狀態

### 內部改動
- `database.ts` 新增 `flushDatabase()` 公開方法
- `postsRepo.ts` 新增 `listStuckPublishingPosts()` + `recoverStuckPost()`
- `scheduler.ts` 改寫 `bootstrapSchedulesFromDB()` 為三階段恢復（清崩潰 → 補錯過 → 略過時）
- 新增 `autoLaunch.ts` 與 `systemHandlers.ts` IPC

---

## [0.1.2] - 2026-05-20｜每日定時支援多時段（1-3 支 / 天）

### 新增功能
- 每日定時模式新增「**每天發幾支**」選項（1 / 2 / 3）
  - 選 N 支 → 顯示 N 個 TimeInput
  - 同一天的影片依時段順序分配（例：3 支 → 影片 1@10:00、影片 2@14:00、影片 3@20:00；下一天同樣 3 個時段）
  - 「每 N 天一組」改名（原「每 N 天一支」），更精準表達意義
- 跳週末邏輯擴展：整組（包含當天所有時段）一起跳到下個工作日
- 預覽表底部加摘要訊息：「共 N 支影片、分到 X 個發布日、各時段分別發於何時」

### 適用情境範例
- 「每天 10:00、14:00、20:00 各發一支」：每天 3 支、無跳週末
- 「工作日早晚各發一支」：每天 2 支（09:00、20:00）+ 跳週末
- 「每週一三五各發一支」：每天 1 支（20:00）+ 每 1 天 + 跳週末（自動分散）

---

## [0.1.1] - 2026-05-20｜批量匯入「每日定時」模式

### 新增功能
- 批量匯入資料夾現支援**兩種排程模式**：
  - **每日定時**（新；預設）：起始日期 + 每日固定發布時間（例 20:00）+ 每 N 天一支 + 可選「跳過週六日」
  - **間隔模式**：第一支起算每 X 小時/分鐘（原本的）

### 適用場景
- 每天晚上 8 點固定發一支：起始日期 = 明天，發布時間 = 20:00，每 1 天一支
- 工作日每天上午 10 點發：起始日期 = 下個週一，時間 = 10:00，間隔 1 天，跳週末打勾
- 每 3 天發一支：間隔天數 = 3
- 兩種模式都可即時預覽完整時間表

---

## [0.2.0] - 2026-05-20｜開發里程碑 M2：多平台發布實證

### 新增功能
- **F4 內容編輯器**
  - 四分頁：共通 / YouTube / Facebook / Instagram
  - 共通頁設標題/描述/Hashtag/隱私 → 各平台分頁可選擇性覆寫
  - 字數即時計數（YouTube 100 / FB 63K / IG 2200 字元上限）
  - 頂部三顆**可點擊平台 Chip**快速啟用/停用發布目標
- **F7 立即發布（YouTube + Facebook 上線、IG 進行中）**
  - YouTubeAdapter：Data API v3 `videos.insert` + resumable upload + 自動 token refresh
  - FacebookAdapter：Reels 3-step API（start phase → binary upload → finish phase 發布）
  - **YouTube「使用頻道預設值」開關**：勾起來則用檔名當標題、其他空白、隱私 private，到 YT Studio 完成編輯（適合大量上傳）
  - PublishProgress UI：每平台獨立進度條、bytes 計數、成功連結、失敗訊息、整體狀態總覽
  - 取消按鈕（cancelRequested flag）
- **生活品質提升**
  - 右鍵選單（electron-context-menu v3）含繁中本地化
  - 鍵盤快捷鍵：Ctrl+1-5 切頁、Ctrl+O 選檔、F11 全螢幕、F12 DevTools、F5 reload、剪貼簿快捷鍵
  - 側邊欄顯示快捷鍵提示（Ctrl 1、Ctrl 2…）
  - 主內容區可正常垂直捲動（修了原本的 overflow 限制）

### 修正
- HEVC 編碼影片預覽顯示為黑屏 → 加 `<video poster>` 用 ffmpeg 縮圖補上 + 友善提示「HEVC 不影響實際上傳」
- 影片+資訊版面在 SimpleGrid 中錯位（HEVC 提示元素跑到第 2 欄）→ 重構成左右兩個 Stack
- Mantine Dropzone 包裝 File 物件 → 改用自製 NativeDropzone
- ContentEditor 完整不顯示（被 root `overflow: hidden` 切掉）→ 移除根容器 overflow，改 AppShell.Main 設 overflow-y
- electron-context-menu v4 是 ESM only 無法用 → 鎖 v3.6.1（CJS）
- Facebook rupload 失敗 `Invalid Header format` → 改 Buffer 上傳 + 補 `X-Entity-Length` 與 `Content-Length` 雙 header
- 主程序錯誤訊息缺乏細節 → FB Adapter 加 AxiosError 解析、顯示 FB API 真正錯誤訊息

### 變更
- YouTube Shorts 時長上限放寬至 180 秒（依 Meta 2024 政策）
- 影片預覽容器限寬 270px 居中、保持 9:16 比例
- Sidebar nav item 加 shortcut 提示（單色等寬字、靠右對齊）
- 移除舊版 ContentEditor 三平台分頁靜態 badge，改為可互動 PlatformChip

### 已知問題
- IG 上傳尚未實作（V0.3 接入，需用 cloudflared 暴露本機檔為公開 URL）
- HEVC 大檔（>500MB）的 FB 上傳會吃 RAM（V1.5 換 chunked rupload）
- 發布結果尚未寫入 SQLite 歷史表（V0.4 接入）
- 自動轉檔（H.264 1080×1920 30fps）尚未實作（V0.5 接入）

### 規劃文件版本
- v0.6 同步釋出

---

## [0.1.0] - 2026-05-20｜開發里程碑 M1：帳號 + 媒體匯入

### 新增功能
- **F1 帳號管理（完整端對端）**
  - YouTube：Google OAuth 2.0 Desktop App + Loopback redirect + PKCE
  - Facebook：Meta Business Login + 嵌入式 BrowserWindow
  - Instagram：透過 FB 粉專自動連動，一次授權雙開
  - Token 加密儲存（`electron.safeStorage` / Windows DPAPI）
  - 帳號頁卡片化 UI、頭像、頻道/粉專名稱、解綁按鈕
- **F2 媒體匯入**
  - 自製 `NativeDropzone` 原生拖拉處理
  - Electron 原生 `dialog.showOpenDialog` 備援路徑
  - 支援 MP4 / MOV / WebM / MKV / 圖片
- **F3 影片預覽器**
  - HTML5 `<video>` + 自訂 `puffin-media://` 協議讀本機檔
  - 9:16 預覽容器
- **F5 跨平台規格驗證（規格偵測部分）**
  - ffprobe 偵測：解析度、時長、fps、codec、bitrate、檔案大小、音軌
  - YouTube Shorts 5-180s / FB Reels 3-90s / IG Reels 3-90s 規則
- **基礎建設**
  - Electron 32 + Vite + React 18 + TypeScript 工具鏈
  - sql.js (WASM) 本地資料庫 + schema_version migration
  - `src/shared/types.ts` 跨進程型別共用
  - Mantine v7 馬卡龍主題（薄荷/櫻花粉/薰衣紫/芒果黃/天藍/海鸚橘/深胡桃 7 色 ×10 階）

### 品牌資產
- 中文名「海鸚泡芙」、英文代號「PuffinPuff」
- 雙軌 Slogan：「發一次，到三家。」+「撲通一聲，內容飛上三平台。」
- LOGO 方案 C（App icon）+ 方案 D（圓形徽章）由 Lovart 產出

### 變更
- 本地資料庫改用 sql.js 取代 better-sqlite3（避開 Windows 上 Visual Studio C++ 編譯依賴）
- App 擁有者（Business Manager）從「快客投手工作室」改綁「李白廬商行」
- YouTube Shorts 時長上限從 60s 改為 180s（依 Meta/Google 2024 新政策）

### 修正
- Mantine Dropzone 包裝 File 物件導致 `webUtils.getPathForFile` 取不到原始路徑
  → 改用自製 `NativeDropzone`，直接用原生 `event.dataTransfer.files`
- Facebook 拒絕 Electron embedded webview
  → `setUserAgent` 偽裝成普通 Chrome（去掉 "Electron" 標記）
- Meta Business Login OAuth URL 缺 `override_default_response_type=true` 導致 Facebook 顯示 generic error
- electron-vite 預設打包所有 deps 導致 sql.js WASM 載入失敗
  → 加入 `externalizeDepsPlugin()`，把 deps 維持為 runtime require
- TypeScript Node 22+ Buffer 型別過嚴
  → `buffer.buffer.slice(...)` 顯式轉成 ArrayBuffer
- CSP 太嚴格擋住 YouTube 頭像 / 影片預覽
  → 放寬 `img-src` 含 `https:`、`media-src` 含 `puffin-media:`
- preload + renderer 型別跨檔分享問題
  → 拆出 `src/shared/types.ts`

### 已知問題 / 技術債
- electron-vite HMR 對 main process 子目錄變更不穩，需清 `out/` 手動重啟
- ffprobe-static / ffmpeg-static 在 packaged build 尚未驗證（V1 打包階段處理）
- Meta App 擁有者「李白廬商行」會影響未來 App Review，目前 V1 dev 模式不影響
- OAuth Modal 的 DevTools 預設開啟（開發階段方便除錯，packaging 前要關掉）
- 長期 user token 60 天過期時，UI 尚未做提醒，需 V1.5 補

### 規劃文件版本
- v0.5 同步釋出

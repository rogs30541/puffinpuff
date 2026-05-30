# Meta Screencast Recording Scripts

Meta App Review **強制要求** screencast 影片，每個 permission 都要看到實際 OAuth 流程 + 該 permission 在 App 內的使用情境。

---

## 拍攝環境準備

1. **錄影工具**：OBS Studio / Windows 內建 Game Bar（Win+G）/ ShareX
2. **解析度**：至少 1280×720（建議 1920×1080）
3. **時長**：每段 60-180 秒，越精簡越好
4. **格式**：MP4，上傳到 Meta App Review 介面（< 50 MB / 段）
5. **語言**：可全英文旁白；或英文螢幕標註 + 無聲操作

### 一定要拍到的「最小必看」畫面

- OAuth consent screen（必須清楚看到 PuffinPuff App name + 要求的權限清單）
- App 內實際使用該 permission 的畫面
- 結果（成功訊息 / 新發布的 post）

---

## Permission 1 + 2 + 4：合併拍一段「Login + Account List」

> `pages_show_list` + `pages_read_engagement` + `business_management` 三個常常合併出現在 Business Login 流程裡，Meta 接受一段影片涵蓋三個 permission。檔名建議：`meta_login_pages.mp4`

### 拍攝腳本（90 秒）

| 秒數 | 畫面 | 旁白 / 螢幕標註 |
|---|---|---|
| 0-3 | PuffinPuff 啟動畫面 | "PuffinPuff — a Windows desktop publisher." |
| 3-8 | 點側邊欄「帳號」進入 Accounts page | "Open the Accounts page." |
| 8-12 | 點「連結 Facebook」按鈕 | "Click 'Connect Facebook'." |
| 12-25 | Meta Business Login OAuth window 跳出 → 點「Continue as VVLEE」→ 選擇要連結的 Page（顯示 Pages 清單） | "Sign in via Meta Business Login. The app requests `business_management`, `pages_show_list`, `pages_read_engagement`." |
| 25-35 | 選一個 Page（例：「企業軍師林郁汶」）→ Continue | "User selects which Page to connect." |
| 35-45 | 回到 PuffinPuff Accounts page，看到新的 Facebook Page 卡片出現（顯示頭像、名稱、verified 標誌） | "PuffinPuff calls `/me/accounts` (uses `pages_show_list`) and `/{page-id}?fields=verification_status` (uses `pages_read_engagement`) to display the Page card." |
| 45-60 | 旁邊出現 Instagram 卡片，自動連動（顯示 IG username + 頭像） | "Instagram Business Account is automatically linked through the FB Page." |
| 60-75 | 切到「發布」頁，下拉「Facebook 帳號」可看到剛剛連結的 Page | "User selects this Page in the Publish form. The Page list comes directly from `pages_show_list`." |
| 75-90 | 回到 Accounts 頁，示範解除 → 帳號卡消失 | "User can disconnect anytime; the access token is immediately deleted from local storage." |

### 需要在影片上加的文字標註

- 0:12 浮現："Meta Business Login OAuth Flow"
- 0:25 浮現："Permissions requested: business_management, pages_show_list, pages_read_engagement"
- 0:35 浮現："`GET /me/accounts` → pages_show_list"
- 0:40 浮現："`GET /{page-id}?fields=verification_status` → pages_read_engagement"

---

## Permission 3：`pages_manage_posts`（FB Reels 發布）

檔名：`meta_publish_fb_reel.mp4`

### 拍攝腳本（120 秒）

| 秒數 | 畫面 | 旁白 / 螢幕標註 |
|---|---|---|
| 0-5 | PuffinPuff「發布」頁，準備好的測試影片（推薦使用無版權測試片，例如純色背景 + "PuffinPuff Test" 文字，15 秒長度） | "Publish flow for Facebook Reels." |
| 5-10 | 拖入影片到 Dropzone | "Drag video file." |
| 10-15 | 預覽器顯示影片，旁邊出現規格驗證（YT/FB/IG 都通過） | "Auto-validated for all 3 platforms." |
| 15-25 | 內容編輯器：填標題「PuffinPuff Test Reel for Meta Review」、描述、Hashtag | "Fill in title, description, hashtags." |
| 25-30 | 確認只啟用 Facebook（YT/IG 停用） | "Enable Facebook only for this demo." |
| 30-35 | 確認下拉選的是剛剛連結的測試 Page | "Confirm target Page: 'Test Page for Meta Review'." |
| 35-40 | 點「立即發布」 | "Click 'Publish Now'." |
| 40-70 | PublishProgress UI 顯示三階段：Start phase → Upload phase（進度條跑）→ Finish phase | "App calls `POST /{page-id}/video_reels?upload_phase=start`, then uploads binary to `rupload.facebook.com`, then `upload_phase=finish&video_state=PUBLISHED`." |
| 70-80 | 「✅ 發布成功」訊息出現，附「在 Facebook 開啟」連結 | "Publish succeeded." |
| 80-100 | 點連結 → 瀏覽器跳出該 Reel 在 Facebook 上的實際頁面 | "Visit the published Reel on Facebook." |
| 100-120 | 切到 PuffinPuff「歷史」頁，可看到剛剛這筆紀錄 | "Publish history shows the record with link to FB post." |

### 需要的文字標註

- 0:35 浮現："POST `/{page-id}/video_reels` (uses pages_manage_posts)"
- 0:80 浮現："Direct upload — no PuffinPuff server involved"

---

## Permission 5：`instagram_basic`（IG 帳號識別）

> 可以併入 Permission 1+2+4 那段（在 0:45-0:60 涵蓋了），但 Meta 強烈建議**單獨**拍一段強調 IG basic。檔名：`meta_ig_basic.mp4`

### 拍攝腳本（60 秒）

| 秒數 | 畫面 | 旁白 / 螢幕標註 |
|---|---|---|
| 0-5 | PuffinPuff Accounts page 已連結 FB | "After connecting Facebook, IG auto-links." |
| 5-15 | 切到 Accounts，IG 卡片顯示：頭像、@username、「商業帳號 ✓」 | "IG Business Account info comes from `GET /{ig-user-id}?fields=username,profile_picture_url`." |
| 15-25 | 切到「發布」頁，看到三個平台 chip：YT / FB / IG，IG 顯示為已連結 | "IG ready to publish in the editor." |
| 25-35 | 鼠標 hover IG chip 顯示 tooltip「Instagram: @testaccount」 | "User confirms IG target visually." |
| 35-50 | 切到「設定」頁可看到 IG 帳號詳細資訊 | "Detailed IG account info: ID, username, picture." |
| 50-60 | 回 Accounts page，示範解除 IG 連結（其實 IG 跟 FB 共用連結，故解除 FB 會同時解 IG） | "Disconnect FB also disconnects IG (linked via Business Login)." |

---

## Permission 6：`instagram_content_publish`（IG Reels 發布）

檔名：`meta_publish_ig_reel.mp4`

### 拍攝腳本（180 秒，**最關鍵**的一段）

| 秒數 | 畫面 | 旁白 / 螢幕標註 |
|---|---|---|
| 0-5 | PuffinPuff「發布」頁，準備好的測試影片（同 Permission 3 的測試片） | "IG Reels publish flow." |
| 5-10 | 拖入影片 | "Drag video." |
| 10-20 | 編輯內容：標題、Hashtag（注意 IG 不支援標題分行，純字串） | "Fill caption (IG uses single caption text)." |
| 20-25 | 確認只啟用 Instagram（YT / FB 停用） | "Enable Instagram only." |
| 25-30 | 點「立即發布」 | "Click 'Publish Now'." |
| 30-60 | PublishProgress UI：「啟動 cloudflared tunnel...」訊息 + 進度 | "App starts a local HTTP server on the user's PC, then uses `cloudflared` to create a temporary trycloudflare.com URL. The URL is random and unguessable." |
| 60-90 | 進度跳到「建立 IG container...」「輪詢狀態 #1...#2...」 | "POST `/{ig-user-id}/media?video_url=<temp_url>` creates container. The URL is only accessible during this fetch window." |
| 90-130 | 「✅ Container ready, publishing...」→ 「✅ 發布成功」 | "POST `/{ig-user-id}/media_publish?creation_id=...` finalizes the Reel." |
| 130-140 | UI 顯示「Cloudflared tunnel 已關閉」訊息 | "Temporary URL invalidated immediately after publish. Local server torn down." |
| 140-170 | 點「在 Instagram 開啟」→ 瀏覽器跳出 IG Reel 實際頁面 | "Visit published Reel on Instagram." |
| 170-180 | 回 PuffinPuff「歷史」頁，看到 IG 這筆 | "Publish history shows the IG row with link." |

### 必須有的文字標註（IG 審查很在意 URL 安全性）

- 0:30 浮現大字："Temporary tunnel via Cloudflare cloudflared — URL is random & unguessable"
- 0:60 浮現："`POST /{ig-user-id}/media?video_url=<temp>` (uses instagram_content_publish)"
- 0:130 浮現大字："Tunnel immediately torn down after publish completes"

---

## 拍攝建議

1. **使用測試帳號發布測試片**：不要用真實的勞資領航者頻道。準備一個專門的 FB Page「Test Page for Meta Review」+ IG 商業帳號「@puffinpuff_test」+ 一個短的測試影片（純色 + "Meta Review Test" 文字 + 15 秒）。
2. **錄影前先把 PuffinPuff 主視窗切到大小 1280×800，方便 1080p 錄影邊框乾淨**。
3. **每段影片標題與 description 用英文**，方便 Meta reviewer 看。
4. **錄完一次審完整流程**：login → publish FB → publish IG → 看歷史 → 解除連結。這段「Master demo」5-7 分鐘版本也準備一份，有時 reviewer 想看完整 flow。
5. **影片 metadata 也加英文 description**：上傳 Meta 介面時的「描述影片用途」欄位用英文寫「Demo of {permission_name} in PuffinPuff app」。

---

## 影片清單（提交時準備這些）

| 檔名 | 涵蓋 permissions | 約長 |
|---|---|---|
| `meta_login_pages.mp4` | pages_show_list, pages_read_engagement, business_management | 90s |
| `meta_publish_fb_reel.mp4` | pages_manage_posts | 120s |
| `meta_ig_basic.mp4` | instagram_basic | 60s |
| `meta_publish_ig_reel.mp4` | instagram_content_publish | 180s |
| `meta_master_demo.mp4`（可選） | 全部 | 5-7 min |

**總拍攝時間**（含 reset, retake）約 2-3 小時。
**剪輯後**所有 mp4 加起來不會超過 50 MB。

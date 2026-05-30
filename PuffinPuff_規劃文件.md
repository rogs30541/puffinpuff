# 海鸚泡芙 PuffinPuff｜規劃文件 v0.9

> 中文名：**海鸚泡芙**
> 英文代號：**PuffinPuff**
> Slogan（雙軌組合策略）：
> - **App Store / 廣告主標**：「發一次，到三家。」
> - **官網 / 影片 hook**：「撲通一聲，內容飛上三平台。」
> 文件版本：v0.9（V1.1 全部 polish 落地：草稿載回、設定頁、自動轉檔、多帳號、常駐 tray、預覽放大、錯誤複製）
> 更新日期：2026-05-21
> 狀態：🚀 **V1.1 已釋出**；最新版本 `0.2.2`，安裝檔位於 `release\海鸚泡芙 PuffinPuff-0.2.2-Setup.exe`

## 工程進度快照（v0.8）

| 模組 | 狀態 | 備註 |
|---|---|---|
| **F1 帳號管理** | ✅ 完成 | YouTube Google OAuth (loopback + PKCE)、FB+IG Meta Business Login (embedded browser + UA 偽裝) |
| **F2 媒體匯入** | ✅ 完成 | 自製 NativeDropzone 拖拉 + Electron 原生對話框雙路徑 |
| **F3 影片預覽器** | ✅ 完成 | HTML5 video + `puffin-media://` 自訂協議；HEVC 自動以縮圖 poster 補位 |
| **F4 內容編輯器** | ✅ 完成 | 三平台分頁 + 共通 + 各自覆寫、頂部 chip 快速啟用/停用、品牌標題模板 + 智慧檔名清理 + 預設 Hashtag |
| **F5 智慧驗證** | ✅ 完成 | YouTube 5-180s / FB IG 3-90s 規格驗證、需轉檔提示 |
| **F5b 自動轉檔執行** | ✅ 完成 | FFmpeg 轉成 H.264 1080×1920 30fps，letterbox 補黑邊；hash 快取避免重轉 |
| **F6 發布配置** | ✅ 完成 | 透過 ContentEditor 平台 chip 達成 |
| **F7 立即發布** | ✅ 完成 | YT + FB + IG 三平台端對端實證；進度條、bytes 計數、可取消、Windows 通知 |
| **F7b 重新發布 / 重新排程** | ✅ 完成 | 失敗紀錄一鍵重發只重試失敗平台；可改未來時間重排 |
| **F8 排程系統** | ✅ 完成 | node-schedule 引擎 + SQLite 持久化 + 容錯三層（崩潰恢復、過時策略、開機自啟）|
| **F8 月曆檢視** | ✅ 完成 | react-big-calendar 天/週/月 + 中文 locale + 馬卡龍配色 |
| **F8.5 批量匯入** | ✅ 完成 | **拖資料夾**自動掃描影片、間隔模式 / 每日定時 1-3 支多時段、跳週末、預覽表 |
| **F9 任務監控** | ✅ 完成 | PublishProgress 即時、每平台獨立進度條、自動 5 秒刷新歷史頁 |
| **F10 通知** | ✅ 完成 | Windows 系統通知（發布完成、排程觸發、恢復狀態） |
| **F11 草稿庫 + 歷史** | ✅ 完成 | posts + post_targets SQLite 表、列表 + 細節 Modal + 篩選 + 刪除 |
| **F12 設定頁** | ✅ 完成 | 排程容錯 / 資料管理（縮圖+轉檔+歷史三種清理）/ 關於 / 通用偏好 |
| **F13 馬卡龍 UI** | ✅ 完成 | Mantine v7 + 7 色 ×10 階配色 + 圓弧 + Slogan + 海鸚 logo |
| **品牌預設文案** | ✅ 完成 | 標題模板 + 智慧檔名清理（去編號 / ID / 日期前綴） + 10 個品牌 Hashtag |
| **右鍵選單** | ✅ 完成 | electron-context-menu v3、繁中本地化 |
| **鍵盤快捷鍵** | ✅ 完成 | Ctrl+1-5 切頁、Ctrl+O 選檔、F11 全螢幕、F12 DevTools、Ctrl+Shift+D 開資料夾 |
| **資料保留 UX** | ✅ 完成 | 安裝/升級不碰 userData；說明選單可一鍵開資料夾 |
| **容錯機制** | ✅ 完成 | 建排程立即落盤、崩潰恢復標 failed、過時 6h+ 自動跳過、開機自啟可選 |
| **打包與發布** | ✅ 完成 | electron-builder NSIS 安裝檔，已發布 `0.1.9` |

---

## 一、專案概述

### 1.1 產品定位
一款執行於 Windows 本地端的桌面應用程式，協助創作者將同一份內容（影片／圖片／文字）一次發布到 **YouTube Shorts、Facebook Reels／貼文、Instagram Reels／貼文**，並支援排程定時發送。

V1 採「單機單人」模式（只服務作者本人），未來延伸至 V2 多用戶版時再送 Meta App Review 與 Google OAuth Verification。

### 1.3 與「剪輯軟體」的關係
- 獨立專案，與剪輯軟體位於 `claude專案/` 同層資料夾
- 共用同樣技術棧（Electron + Vite + React + TS）以降低學習與維運成本
- 未來可考慮「剪輯完成 → 一鍵推送到 PuffinPuff」的整合（V2 階段）

### 1.4 品牌形象（已落地）
- **吉祥物**：海鸚（Puffin），橘喙 `#FF8C42`、黑白雙色身、圓滾滾
- **意象**：海鸚把一個泡芙（內容）拋向三個平台，形成完美三角
- **個性**：輕盈、可愛、效率、不正經但會做事
- **資產位置**：`品牌資產_海鸚泡芙/`
  - `ICON.png` — 方案 C（純吉祥物 App icon，iOS 風格圓角方形、薄荷→粉漸層底）
  - `LOGO.png` — 方案 D（圓形徽章式、上 PUFFINPUFF / 下 海鸚泡芙、三色三角形對應三平台）
  - `海鸚泡芙_SLOGAN_LOGO_設計提案_v1.md` — 設計推理過程
  - `海鸚泡芙_LOGO_生成成果_v1.md` — Lovart 產出結果與後續優化建議

---

## 二、視覺設計系統（v0.2 新增）

### 2.1 配色（馬卡龍時尚淺色系）

| 用途 | 名稱 | HEX | 說明 |
|---|---|---|---|
| 主色 | 薄荷綠 Mint | `#B8E0D2` | 品牌主色、Logo 底、Sidebar 強調 |
| 輔色 | 櫻花粉 Sakura | `#F8C8DC` | 主要 CTA 按鈕「發布」「排程」 |
| 點綴 1 | 芒果黃 Mango | `#FCE4A6` | 提醒、排程中、進度條 |
| 點綴 2 | 薰衣紫 Lavender | `#D8C6E8` | 帳號類標籤、次要按鈕 |
| 點綴 3 | 天藍 Sky | `#BEDFE5` | 資訊提示、Hyperlink 底色 |
| 主背景 | 奶油白 Cream | `#FBF7F2` | App 整體底色，比純白柔和 |
| 卡片底 | 象牙白 Ivory | `#FFFFFF` | 卡片、輸入框背景 |
| 邊框 | 暖灰 Sand | `#E5DCD3` | 邊框、分隔線 |
| 文字主 | 深胡桃 Walnut | `#3F3A36` | 標題、正文（取代純黑，減壓） |
| 文字次 | 石墨灰 Pebble | `#7C736B` | 次級資訊、占位符 |
| 成功色 | 草綠 Sage | `#6FBF9D` | 成功狀態、打勾 |
| 警示色 | 玫瑰紅 Rose | `#E08B97` | 失敗、刪除（不用刺眼紅） |

### 2.2 圓弧規範

| 元件 | 圓角 | 說明 |
|---|---|---|
| 大卡片 | 20px | 主工作區卡片、發布頁主卡 |
| 一般卡片 | 16px | 設定卡、帳號卡、歷史列項 |
| 按鈕（標準） | 12px | 多數按鈕 |
| 按鈕（CTA 大按鈕） | 999px (pill) | 「發布」「立即發布」這種重要按鈕 |
| 輸入框 | 10px | TextField、TextArea |
| 圖片縮圖 | 12px | 媒體預覽 |
| Modal | 24px | 對話框 |

### 2.3 字型

| 場景 | 字型 | 字重 |
|---|---|---|
| 中文標題 | Noto Sans TC | 700 |
| 中文內文 | Noto Sans TC | 400 |
| 英文/數字標題 | Manrope | 700 |
| 英文/數字內文 | Inter | 400 |
| 等寬（程式碼/Hash） | JetBrains Mono | 400 |

### 2.4 動效原則
- 過渡時間：150ms（小元件）、250ms（卡片）、400ms（頁面切換）
- Easing：`cubic-bezier(0.4, 0, 0.2, 1)`（Material standard）
- 按鈕 hover 上浮 1px、加 4% 陰影
- 載入用「海鸚搖晃」客製 SVG 動畫

### 2.5 圖示風格
- 使用 **Phosphor Icons**（圓潤風格）或 **lucide-react** 的 rounded 變體
- 統一線寬 1.5px
- 統一尺寸：16 / 20 / 24

---

## 三、技術架構

### 3.1 技術棧

| 層級 | 選擇 | 備註 |
|---|---|---|
| 桌面框架 | Electron 30+ | 與剪輯軟體一致 |
| 前端 | React 18 + TypeScript + Vite | 同上 |
| UI 套件 | **Mantine v7**（內建支援自訂 theme，圓弧、配色全可調） | |
| 動效 | Framer Motion | 海鸚動畫、頁面切換 |
| 本地資料庫 | **sql.js**（純 JS WASM SQLite）✨ v0.4 改用 | 避開 Windows 上 better-sqlite3 需 Visual Studio 編譯。效能對我們規模（百筆級）足夠 |
| 排程引擎 | node-schedule + Windows 工作排程器 | 雙保險 |
| 加密儲存 | electron-safe-storage（系統 DPAPI） | 存 OAuth Token |
| 影片處理 | FFmpeg（複用剪輯軟體的 build） + ffprobe（規格偵測） | |
| 影片預覽播放器 | **video.js** 或 React-Player | V0.2 新增需求 |
| 圖片處理 | sharp | 縮圖、壓縮 |
| 本地 HTTP 隧道 | cloudflared (Cloudflare Tunnel free) | 給 IG 用 |
| HTTP 客戶端 | axios + axios-retry | 重試、攔截器 |
| 平台 SDK | googleapis、facebook-nodejs-business-sdk | 官方 |
| 通知 | electron Notification API（接 Windows Action Center） | |
| 打包 | electron-builder | 同剪輯軟體 |
| 自動更新 | electron-updater | 同剪輯軟體 |

### 3.2 模組分層

```
┌──────────────────────────────────────────────────┐
│  Renderer (React UI)                              │
│  ├─ 發布頁（含影片預覽器、進度條、取消按鈕）       │
│  ├─ 排程行事曆                                     │
│  ├─ 任務佇列監控（紅點計數）                       │
│  ├─ 發布歷史                                       │
│  ├─ 帳號管理                                       │
│  └─ 設定                                           │
└──────────────────────────────────────────────────┘
            ↑ IPC ↓
┌──────────────────────────────────────────────────┐
│  Main Process                                     │
│  ├─ OAuth 管理器（loopback flow + PKCE）          │
│  ├─ 任務佇列引擎（持久化 + 重試 + 取消）          │
│  ├─ 排程器（node-schedule + Win Task Scheduler）  │
│  ├─ 平台轉接器（Adapter Pattern）                 │
│  │   ├─ IPlatformAdapter (interface)             │
│  │   ├─ YouTubeAdapter                           │
│  │   ├─ MetaPageAdapter (FB)                     │
│  │   ├─ MetaIGAdapter                            │
│  │   ├─ ThreadsAdapter ← V1.1 接入點（V1 預留）  │
│  │   └─ TikTokAdapter   ← V1.1 接入點（V1 預留）  │
│  ├─ 媒體處理                                       │
│  │   ├─ MediaProbe (ffprobe)                     │
│  │   ├─ MediaTranscoder (ffmpeg → 1080×1920 30fps)│
│  │   └─ LocalTunnelServer (for IG)               │
│  ├─ 通知服務（Action Center + 紅點計數器）         │
│  └─ SQLite Repository                            │
└──────────────────────────────────────────────────┘
            ↓ Network ↓
┌──────────────────────────────────────────────────┐
│  外部服務                                          │
│  ├─ Google OAuth + YouTube Data API v3            │
│  ├─ Facebook Login + Graph API                    │
│  ├─ Instagram Graph API                           │
│  └─ Cloudflare Tunnel（IG video_url 中繼）        │
└──────────────────────────────────────────────────┘
```

### 3.3 平台轉接器介面（為 Threads/TikTok 預留）

```ts
interface IPlatformAdapter {
  readonly platform: 'youtube' | 'facebook' | 'instagram' | 'threads' | 'tiktok';

  // 驗證
  authorize(): Promise<AccountInfo>;
  refreshToken(account: AccountInfo): Promise<AccountInfo>;
  revoke(account: AccountInfo): Promise<void>;

  // 規格
  getSpecRequirements(): MediaSpec;     // 解析度/長度/檔案大小限制
  validate(media: MediaInfo): ValidationResult;

  // 發布
  publish(args: PublishArgs, onProgress: ProgressCallback): Promise<PublishResult>;
  cancel(jobId: string): Promise<void>;

  // 元資料
  getCharLimits(): { titleMax: number; descMax: number; tagsMax: number };
}
```

新增 Threads/TikTok 時只需新增類別實作介面，UI 與佇列無需動。

---

## 四、平台 API 細節與限制

*（同 v0.1，未變動，此處略，請參考前一版本）*

重點摘要：
- **YouTube Shorts**：Data API v3，每日配額 ≈ 6 支，title 含 `#Shorts`
- **FB Reels**：Page access token，3 步驟（start → upload → finish）
- **IG Reels**：必須 Business + 連 FB 粉專，container 模式，**需公開 video_url**（用 cloudflared 解）
- **Threads（V1.1）**：Meta Threads API，2024 開放，透過 IG 帳號連動
- **TikTok（V1.1）**：Content Posting API，需 Meta 等級的審核

---

## 五、功能模組劃分

### 5.1 V1.0（MVP）— 全部必做

| 模組 | 功能 | 工時 |
|---|---|---|
| **F1 帳號管理** | 連線/解綁 Google、Meta；顯示已授權帳號清單 | 2 天 |
| **F2 媒體匯入** | 拖拉影片/圖片；FFprobe 自動偵測規格；縮圖 | 1 天 |
| **F3 影片預覽器** | 內建播放器，可逐幀預覽、看時長／比例 ✨v0.2 新增 | 0.5 天 |
| **F4 內容編輯器** | 三平台分頁；獨立覆寫；字數限制即時提示 | 2 天 |
| **F5 智慧轉檔** | 自動偵測規格，符合則用原檔，不符則轉 1080×1920 30fps ✨v0.2 強化 | 1 天 |
| **F6 發布配置** | 勾選平台；隱私設定；FB 粉專選擇 | 1 天 |
| **F7 立即發布 + 進度條** | 任務佇列；進度條；可取消；錯誤處理 ✨v0.2 強化 | 2.5 天 |
| **F8 排程系統** | node-schedule + Windows Task Scheduler 雙層 | 2 天 |
| **F8.5 排程批量匯入** ✨v0.4 新增 | 拖拉 CSV/Excel 一次匯入 N 筆排程，含預覽、驗證、批次套用平台設定 | 1.5 天 |
| **F9 任務監控** | 進度條；紅點計數；點開看詳情與平台連結 | 1 天 |
| **F10 通知** | Windows Action Center 通知 + App 內紅點 ✨v0.2 強化 | 0.5 天 |
| **F11 草稿庫** | 編輯一半可存草稿；列表瀏覽；繼續編輯 | 1 天 |
| **F12 設定** | 路徑、通知開關、轉檔偏好、自動更新 | 0.5 天 |
| **F13 馬卡龍 UI** | Mantine theme、圓弧、配色、海鸚 logo、動效 ✨v0.2 新增 | 1.5 天 |
| **打包與測試** | electron-builder 簽章、煙霧測試三平台 | 1.5 天 |
| **合計** | | **19.5 天** |

### 5.2 V1.1（MVP 後第一輪迭代）

- **Threads 上傳**（Adapter 已預留）
- **TikTok 上傳**（Adapter 已預留）
- 一稿多投差異化進階（範本、批次套用）
- Hashtag 範本庫
- 標題/描述 AI 改寫（接 Claude / GPT API）
- 智慧重試（指數退避）

### 5.3 V2（多用戶版，未來）

- Meta App Review + Google OAuth Verification
- 隱私權政策 / 服務條款
- 在地化（英日）
- 表現數據抓取（觀看數、互動數、留存）
- 與「剪輯軟體」整合：剪完直接送 PuffinPuff
- 跨裝置同步（選配，需雲端後台）

---

## 六、資料模型（SQLite Schema）

*（同 v0.1，未變動，此處略）*

新增備註：
- `accounts.platform` enum 新增 `'threads'`、`'tiktok'` 以預留欄位
- `post_targets` 同樣支援這兩平台

---

## 七、UI/UX 結構

### 7.1 整體風格
- 圓弧大量使用（卡片 16–20px、CTA pill 化）
- 主背景奶油白 + 卡片象牙白 + 彩色點綴
- 邊框極細（1px）配 4–8% 不透明陰影製造「漂浮感」
- 海鸚吉祥物出現在：啟動畫面、空狀態插圖、載入動畫、發布成功動畫

### 7.2 主視窗布局

```
┌─────────────────────────────────────────────────┐
│ 🐧 海鸚泡芙              [搜尋..] [🔔 3] [_][□][×]│
├─────┬───────────────────────────────────────────┤
│ ✨  │                                            │
│ 發布 │       主工作區（依左側選單切換）           │
├─────┤                                            │
│ 📅  │                                            │
│ 排程 │                                            │
├─────┤                                            │
│ 🕒  │                                            │
│ 歷史 │                                            │
├─────┤                                            │
│ 👤  │                                            │
│ 帳號 │                                            │
├─────┤                                            │
│ ⚙️  │                                            │
│ 設定 │                                            │
└─────┴───────────────────────────────────────────┘
```

🔔 鈴鐺旁的紅點數字 = 未讀完成/失敗通知（V0.2 新增）

### 7.3 「發布」頁（核心，v0.2 增強）

```
╭───────────────────────────────────────────────────╮
│ ① 拖拉影片到這裡                                    │
│ ╭─────────────────────────────────────╮            │
│ │ [🎬 預覽播放器 9:16 縮放]            │ ▶️ ⏸ 🔊  │
│ │                                      │            │
│ ╰─────────────────────────────────────╯            │
│ filename.mp4 | 1080×1920 ✅ | 45s ✅ | 12MB ✅      │
│ 💡 規格符合，將使用原檔上傳                          │
│ （若不符會顯示：將自動轉檔 1080×1920 30fps）        │
╰───────────────────────────────────────────────────╯

╭───────────────────────────────────────────────────╮
│ ② 發布到（勾選平台）                                │
│ ☑ 🔴 YouTube  ▼ MyChannel                         │
│ ☑ 🔵 Facebook ▼ MyPage                            │
│ ☑ 🟣 Instagram ▼ @myhandle                        │
│ ☐ ⚫ Threads（V1.1 即將開放）                     │
│ ☐ ⚫ TikTok（V1.1 即將開放）                      │
╰───────────────────────────────────────────────────╯

╭───────────────────────────────────────────────────╮
│ ③ 內容                                              │
│ [共通] [YouTube] [Facebook] [Instagram]            │
│                                                    │
│ 標題：[__________________]  剩 75/100             │
│ 描述：[                                  ]         │
│ Hashtag：[#shorts #life ...]                       │
│ 隱私：(•) 公開  ( ) 不公開                         │
╰───────────────────────────────────────────────────╯

╭───────────────────────────────────────────────────╮
│ ④ 時間                                              │
│ (•) 立即發布   ( ) 排程於 [2026-05-20 20:00 ▼]    │
╰───────────────────────────────────────────────────╯

           [💾 存草稿]   [🚀 發布 / 加入排程]
```

### 7.4 「立即發布」執行畫面（v0.2 新增）

```
╭──────────────────── 海鸚正在飛行 ✈️ ────────────────────╮
│                                                          │
│ 🔴 YouTube   ████████░░░░░░░░ 47%  上傳中…  [✕ 取消]   │
│ 🔵 Facebook  ████████████████ 100% ✅ 已發布 [連結]    │
│ 🟣 Instagram ░░░░░░░░░░░░░░░░  0%  排隊中    [✕ 取消]   │
│                                                          │
│ 整體進度：50%  預計剩餘 1m 30s                            │
│                                                          │
│           [✕ 取消全部]   [⏸ 全部暫停]                    │
╰──────────────────────────────────────────────────────────╯
```

### 7.5 通知（v0.2 新增）
- **Windows Action Center**：
  - 「✅ YouTube 發布成功！」（點通知打開 App 並跳到歷史頁定位該則）
  - 「⚠ Instagram 發布失敗，點此查看」
- **App 內紅點**：
  - 鈴鐺圖示右上角紅點，顯示未讀完成/失敗數
  - 點開展開通知中心 panel

### 7.6 排程頁
- 月曆檢視，每排程一個彩色色塊（YT 紅、FB 藍、IG 紫）
- 拖拉色塊改時間
- 點開可編輯
- 列表檢視 toggle（給愛看條列的人）
- **頂部 CTA：「📥 批量匯入」按鈕**（觸發 F8.5 流程）

### 7.6.1 批量匯入 Modal（v0.4 新增）

```
╭─────────── 批量匯入排程 ─────────────╮
│                                       │
│ ① 上傳檔案                            │
│   [拖拉 CSV/Excel 到這裡] [瀏覽…]    │
│   下載範本：[CSV] [Excel]            │
│                                       │
│ ② 預覽（30 筆，全部通過驗證）        │
│ ┌────────────────────────────────┐  │
│ │ # │ 影片 │ 標題 │ 時間 │ 平台 │  │
│ │ 1 │ ✓ a.mp4 │ ... │ 5/20 20:00 │ YT │
│ │ 2 │ ⚠ 找不到 │ ... │ 5/20 21:00 │ FB │
│ │ ...                              │  │
│ └────────────────────────────────┘  │
│ ⚠ 2 筆有問題（檔案不存在或時間過去） │
│                                       │
│ ③ 批次套用                            │
│ ☐ 全部使用相同 Hashtag：[___________]│
│ ☐ 全部設為公開                       │
│                                       │
│      [取消]   [略過問題 → 匯入 28 筆]│
╰───────────────────────────────────────╯
```

**CSV 欄位規格**（範本檔提供）：
| 欄位 | 必填 | 範例 | 說明 |
|---|---|---|---|
| video_path | ✓ | `C:\videos\01.mp4` | 本機影片絕對路徑 |
| title | ✓ | 我的第一支影片 | 主標題（不分平台時共用） |
| description | | 影片描述... | 描述 |
| hashtags | | #shorts #life | 空格分隔 |
| scheduled_at | ✓ | `2026-05-20 20:00` | 本機時區（自動轉 UTC 存） |
| platforms | ✓ | `youtube,facebook` | 逗號分隔（threads/tiktok V1.1 起支援） |
| privacy | | `public` | public / private（預設 public） |
| yt_title | | YT 客製標題 | 平台覆寫，可選 |
| fb_title | | FB 客製標題 | 平台覆寫，可選 |
| ig_caption | | IG 客製文案 | 平台覆寫，可選 |

**驗證規則**：
- 影片檔不存在 → 標警告，可選擇略過或修正後重匯
- scheduled_at 在過去 → 標警告
- platforms 含未連線的平台 → 標警告
- 字數超過平台限制 → 標警告但允許匯入（runtime 會截斷）

**批次套用**：在預覽階段可一次設定「全部使用某 hashtag / privacy」，套用到所有列。

### 7.7 歷史頁
- 表格：時間 / 標題縮圖 / YT / FB / IG（各平台 ✅ 或 ❌）
- 篩選：成功 / 失敗 / 全部
- 失敗可一鍵重發

---

## 八、排程系統設計

*（同 v0.1，未變動）*

時區處理：**預設本機時區**（透過 `Intl.DateTimeFormat().resolvedOptions().timeZone` 偵測），UI 顯示使用本機時區，排程時間以 UTC 存資料庫。

---

## 九、安全性

*（同 v0.1，未變動）*

V0.2 補充：
- **不設密碼鎖**（依使用者決定）
- 改用：App 啟動時驗證 OAuth token 仍有效，若全失效則跳回授權頁
- 影片暫存清理頻率：App 退出時 + 每 24 小時定時清理

---

## 十、開發階段切分（v0.2 更新工時）

### 階段 1｜骨架與設計系統（3 天）
- [ ] 建立 Electron + Vite + React 專案
- [ ] 設定 electron-builder、自動更新
- [ ] Mantine theme 客製（馬卡龍配色、圓弧、字型）
- [ ] 海鸚 logo 與吉祥物 SVG（可外包或我用 AI 製作）
- [ ] 主視窗骨架（左側選單 + 主工作區）

### 階段 2｜帳號授權（2 天）
- [ ] Google OAuth loopback flow（含 PKCE）
- [ ] Meta OAuth loopback flow（user token → page token → long-lived token）
- [ ] 「帳號」頁 UI + 連線/解綁

### 階段 3｜YouTube 上傳（2 天）
- [ ] YouTubeAdapter（resumable upload + 進度回呼）
- [ ] 媒體匯入 + FFprobe 偵測 + 預覽播放器
- [ ] 「發布」頁最小可用：選檔→填標題→上傳

### 階段 4｜FB Reels + 貼文（2 天）
- [ ] MetaPageAdapter
- [ ] 長期 token 換取與自動 refresh
- [ ] 整合到「發布」頁

### 階段 5｜IG Reels + 貼文（2.5 天）
- [ ] cloudflared 整合（自動下載、啟動、隧道公開）
- [ ] MetaIGAdapter（container 流程 + 輪詢）
- [ ] 整合到「發布」頁

### 階段 6｜智慧轉檔 + 發布進度（1.5 天）
- [ ] 規格自動偵測：符合用原檔、不符自動轉檔
- [ ] 進度條 UI（每平台獨立 + 整體）
- [ ] 任務取消功能

### 階段 7｜排程系統（2 天）
- [ ] SQLite migrations
- [ ] node-schedule 整合
- [ ] Windows 工作排程器補發
- [ ] 「排程」頁（行事曆 + 列表雙檢視）

### 階段 8｜通知系統 + 草稿庫 + 歷史（1.5 天）
- [ ] Windows 通知 + App 內紅點
- [ ] 草稿庫
- [ ] 歷史頁 + 失敗重發

### 階段 9｜打磨與打包（1.5 天）
- [ ] 動效、空狀態插圖、海鸚動畫
- [ ] electron-builder 產出簽章安裝檔
- [ ] 三平台端對端煙霧測試

**合計：18 天**

---

## 十一、已知風險與限制

| 風險 | 影響 | 應對 |
|---|---|---|
| YouTube 每日配額 ≈ 6 支 | 量大用戶痛 | 上線後申請額度提升 |
| Meta App 開發模式只能本人發 | V1 OK（單人用） | V2 啟動前 2 個月送審 |
| IG 必須 Business + 連 FB 粉專 | 個人帳號用不了 | 帳號連線頁顯眼提示 |
| IG 需公開 URL 給 video_url | 架構複雜度 | cloudflared free tunnel |
| FB 長期 token 60 天到期 | 不續會失敗 | 排程自動 refresh + 到期前 7 天通知 |
| 平台 API 變更 | 隨時可能 | Adapter 抽象 + 監看 changelog |
| cloudflared 服務中斷 | IG 上傳失敗 | 偵測失敗 → 自動重啟 tunnel |
| App 關閉時錯過排程 | 沒發出去 | Windows Task Scheduler 補發 |

---

## 十二、決議紀錄

### 12.1 規格決議（v0.2 採納）

| # | 項目 | 決議 |
|---|---|---|
| 1 | 專案名稱 | **海鸚泡芙｜PuffinPuff** |
| 2 | UI 主色調 | **馬卡龍時尚淺色系**（薄荷綠/櫻花粉/芒果黃/薰衣紫/天藍）+ 大量圓弧 |
| 3 | 影片預覽器 | ✅ 內建 |
| 4 | 時區 | 預設本機時區 |
| 5 | 失敗通知 | Windows 通知中心 + App 內紅點（雙管齊下） |
| 6 | 密碼鎖 | ❌ 不需要 |
| 7 | Threads / TikTok 預留 | ✅ Adapter 介面預留，V1.1 接入 |
| 8 | 影片轉檔策略 | 自動偵測：符合用原檔、不符轉成 1080×1920 30fps |
| 9 | IG Stories | ❌ 不支援 |
| 10 | 進度條/可取消 | ✅ 立即發布 + 排程任務都有 |

### 12.2 品牌資產決議（v0.3 採納）

| # | 項目 | 決議 |
|---|---|---|
| 11 | Slogan 策略 | 雙軌組合：**App Store/廣告主標 →「發一次，到三家。」** ／ **官網/影片 hook →「撲通一聲，內容飛上三平台。」** |
| 12 | LOGO 方案 | 雙圖配套：**方案 C（純吉祥物 App icon）+ 方案 D（圓形徽章）** |
| 13 | LOGO 來源 | Lovart Branding 模式 + GPT Image 2 模型，已產出存於 `品牌資產_海鸚泡芙/` |
| 14 | LOGO 適用對應 | C → Windows app icon / favicon / 開始功能表磁貼；D → 啟動畫面 / About 對話框 / 官網頁尾 / 周邊商品 |
| 15 | 強調色補充 | 海鸚橘 `#FF8C42`（喙色、CTA、品牌記憶點） |

### 12.3 工程與帳號決議（v0.4 採納）

| # | 項目 | 決議 |
|---|---|---|
| 16 | 本地資料庫 | 採用 **sql.js**（純 JS WASM）取代 better-sqlite3，避免 Windows 上原生編譯依賴 |
| 17 | 排程批量匯入 | **V1.0 MVP 必做**（F8.5），支援 CSV 拖拉一次匯入 N 筆，含驗證、預覽、批次套用 |
| 18 | Google OAuth | Desktop App + Loopback 隨機 port + PKCE；憑證存於 `secrets/google_oauth.json` |
| 19 | Meta OAuth | Business Login + 嵌入式 BrowserWindow 攔截 URL；憑證存於 `secrets/meta_oauth.json` |
| 20 | Meta Configuration ID | `1275523534730366`（名稱 `PuffinPuff Production`，一般 + 用戶存取權杖） |
| 21 | Meta Redirect URI | `https://localhost/puffinpuff-callback`（HTTPS 強制與 Strict 模式無法關閉，改用 embedded browser 攔截）|
| 22 | App 擁有者（Business Manager） | **李白廬商行**（原為「快客投手工作室」，v0.4 已換綁） |
| 23 | 主要 FB 粉專 | `企業軍師林郁汶-全台講座限量報名中-企業首選全方位勞資顧問`（Page ID: 430660943471412） |

### 12.4 v0.7–v0.8 採納（功能擴充與資料保護）

| # | 項目 | 決議 |
|---|---|---|
| 24 | 排程批量匯入 UI | 從 CSV 改為**拖資料夾**模式（更直觀，無需手寫 CSV） |
| 25 | 排程模式 | **每日定時**（預設）+ **間隔模式** 雙軌；每日定時支援 1-3 支多時段 + 跳週末 |
| 26 | 排程檢視 | **react-big-calendar 月曆**取代列表，支援天/週/月切換、繁中 locale、馬卡龍配色 |
| 27 | 排程持久化 | 建立/取消排程立即 `flushDatabase()` 同步寫硬碟（不依賴 500ms debounce） |
| 28 | 崩潰恢復 | App 啟動時掃描卡 publishing 30 分以上的 → 標 failed；錯過 < 6h 的補發；> 6h 的略過 |
| 29 | 開機自啟 | 可選開關（排程頁 Alert 內），啟用後 Windows 開機 PuffinPuff 自動接管排程 |
| 30 | 升級資料保留 | 所有 runtime 資料在 `userData\`，安裝/升級/卸載皆不碰 |
| 31 | 重新發布 | 失敗紀錄可一鍵重發**只重試 failed 平台**（不會重發 success 的）|
| 32 | 重新排程 | 失敗 / 草稿可改回 scheduled + 指定新時間 |
| 33 | YT 頻道預設值開關 | **移除**（v0.7） — 改用品牌標題模板與 `{檔名}` placeholder |
| 34 | 品牌預設文案 | 標題模板「【勞資領航者｜企業軍師 林郁汶】{檔名} #...」+ 10 個品牌 Hashtag 預填 |
| 35 | 智慧檔名清理 | `{檔名}` 自動 strip 編號 / 英數 ID / 日期前綴；中文與長英文保留 |
| 36 | 通知整合 | Windows 系統通知（含發布完成、排程觸發、恢復狀態）+ AppUserModelId 設定 |
| 37 | 已發布 V1.0 | NSIS 安裝檔每次小版更新都覆蓋打包（0.1.0 → 0.1.9）|

### 12.5 V1.1 採納（0.2.0 ~ 0.2.2）

| # | 項目 | 決議 |
|---|---|---|
| 38 | 草稿載回 | 歷史頁草稿狀態紀錄可一鍵載回 PublishPage 繼續編輯，原草稿自動刪除避免重複 |
| 39 | F12 獨立設定頁 | 整合 autoLaunch / 資料管理（縮圖、轉檔、歷史三種清理）/ 關於 / 通用偏好 |
| 40 | F5b 自動轉檔 | FFmpeg 偵測需轉檔自動轉成 H.264 1080×1920 30fps，先 scale 再 letterbox 黑邊；hash 快取機制重發不重轉 |
| 41 | 多帳號 | 同平台可連多個帳號（YT/FB Page/IG），各別解綁；發布時自動選第一個（V2 加帳號選擇器） |
| 42 | 常駐系統匣 | 關閉視窗 → 隱藏到 tray 而非結束；tray 右鍵選單可顯示主視窗 / 跳到任一頁 / 真正結束 |
| 43 | 單一實例鎖 | 避免重複啟動開出多份 App，第二次啟動會把現有視窗叫到前面 |
| 44 | 影片預覽放大 | 歷史 + 排程細節 Modal 縮圖點擊開大圖 + HTML5 video 播放 |
| 45 | 錯誤詳情複製 | 失敗紀錄可一鍵複製 Markdown 格式（含時間、平台、錯誤訊息、檔案路徑）|
| 46 | 轉檔快取清理 | 設定頁加按鈕，可看到大小、一鍵清空 |
| 47 | 已發布 V1.1 | 0.2.0 → 0.2.2，CHANGELOG 完整紀錄每個小版本變動 |

---

## 十三、後續路線圖

### V1.1 ✅ 全部完成（0.2.0 - 0.2.2）

| 模組 | 狀態 |
|---|---|
| F5b 自動轉檔 | ✅ FFmpeg 轉 H.264 1080×1920 30fps（letterbox），hash 快取 |
| F12 設定獨立頁 | ✅ autoLaunch + 縮圖/轉檔/歷史清理 + 關於 |
| 草稿載回繼續編輯 | ✅ 一鍵載回後原草稿自動刪除 |
| 影片預覽放大 | ✅ 縮圖點擊 → HTML5 video 全螢幕播放 |
| 錯誤詳情複製 | ✅ Markdown 格式含時間/平台/錯誤訊息/檔案路徑 |
| 多帳號支援 | ✅ 每平台可連多個、各自解綁；發布用第一個 |
| **常駐系統匣** | ✅ 關閉視窗 → tray，背景持續排程 |

### V1.5 中期擴張

- **Threads 上傳**（Adapter 預留好了，IG token 可共用）
- **TikTok 上傳**（需 TikTok Content Posting API 審核）
- **發布表現追蹤**（每隔 N 小時抓觀看數、留存、互動）
- **AI 標題 / 描述改寫**（接 Claude / GPT）
- **指數退避自動重試**

### V2.0 商用化

- Meta App Review + Google OAuth Verification
- 多用戶 SaaS 模式
- 雲端排程後端（不靠本機 App 開著）
- 與「剪輯軟體」整合：剪完一鍵推送
- 隱私權 / 服務條款 / 客服

### 安裝檔位置（最新版）

```
C:\Users\Tw\Desktop\claude專案\發布軟體\release\海鸚泡芙 PuffinPuff-0.1.9-Setup.exe
```

完整版本歷史見 [`CHANGELOG.md`](CHANGELOG.md)。

---

## 十四、附錄：開發歷程關鍵踩雷與解法

| # | 雷 | 解法 |
|---|---|---|
| 1 | better-sqlite3 需 Visual Studio 編譯 | 改用 sql.js (WASM) |
| 2 | electron-vite 預設打包所有 deps | `externalizeDepsPlugin()` |
| 3 | Buffer Node 22+ 型別嚴格 | `.buffer.slice()` 顯式 ArrayBuffer |
| 4 | preload + renderer 型別共用 | 拆出 `src/shared/types.ts` |
| 5 | Meta Business Login 必要參數 | `override_default_response_type=true` |
| 6 | FB 拒絕 Electron embedded webview | `setUserAgent` 偽裝 Chrome |
| 7 | FB rupload 需 Content-Length + X-Entity-Length | Buffer 上傳代替 stream + 雙 header |
| 8 | IG container API 要公開 HTTPS URL | cloudflared quick tunnel 自動下載 |
| 9 | Mantine Dropzone 包裝 File 物件 | 自製 NativeDropzone 直取 dataTransfer.files |
| 10 | electron-context-menu v4 ESM only | 鎖 v3.6.1 |
| 11 | NSIS 路徑含中文 + PNG 直給 | 預生成 icon.ico + png-to-ico |
| 12 | packaged ffprobe spawn ENOENT | path `app.asar` → `app.asar.unpacked` |
| 13 | sql.js debounce 寫硬碟可能丟資料 | `flushDatabase()` 立即同步寫 |
| 14 | App 中斷時排程卡 publishing | 啟動恢復標 failed + 補發 < 6h 的 |

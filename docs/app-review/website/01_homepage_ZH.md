# 海鸚泡芙 PuffinPuff

## 撲通一聲，內容飛上三平台

**一支影片，一鍵發布，同時送上 YouTube Shorts、Facebook Reels、Instagram Reels。**

[ 立即下載 v0.2.4（Windows）](#download) 　 [📘 使用說明](#guide) 　 [📧 聯絡作者](mailto:bisharing001@gmail.com)

---

## 為什麼需要 PuffinPuff？

短影音時代，「**同一支內容、發三家**」是創作者最基本的擴散動作。但實際操作上你會遇到：

- 🔁 同一支影片要打開三個 App，分別填三次標題、描述、Hashtag
- 📅 想排程在最佳時段，每個平台介面又不一樣、規則又不一樣
- ⏰ FB / IG 不允許未來 6 天以上的排程；YouTube 又有自己的隱私規則
- 🎬 HEVC / 4K / 直式影片在 IG 上傳常常失敗
- 📊 發完之後不知道哪幾家成功、哪幾家失敗、要去哪個 App 看

PuffinPuff 把這些**通通解決**：

> **三平台同步發 + 跨平台排程月曆 + 自動轉檔 + 失敗一鍵重發 + 完整歷史紀錄**

---

## 核心功能

### 🎯 一次發布三平台

連結 YouTube + Facebook + Instagram 帳號後，拖入影片 → 填一次標題 → 點「發布」就完成。各平台可獨立啟用 / 停用，也可獨立覆寫標題與 Hashtag。

### 📅 跨平台排程月曆

未來 365 天的排程通通顯示在同一個月曆上，**天 / 週 / 月** 三種檢視。批量匯入資料夾自動排定每日定時（最多每日 3 支），可選跳週末，可預覽完整時程表。

### 🎬 自動轉檔（HEVC → H.264）

iPhone 拍的 HEVC、Sony 拍的 4K、橫式 16:9 — 通通自動轉成各平台都吃的 H.264 1080×1920 30fps 9:16，letterbox 補黑邊保留完整畫面。Hash 快取，同一支影片不會重複轉。

### 🛡️ 排程容錯

- 排程**立即落盤**到本機 SQLite，不怕意外關機
- App 重啟自動恢復**被中斷的紀錄**、補發**錯過 6 小時內**的排程
- 開機自動啟動選項，配合 Tray 常駐 → 24/7 都能準時發
- 過時太久的排程自動標失敗、跳通知說明，不亂發

### 🔁 失敗可重發

YouTube 成功、FB 失敗的情況？點「重新發布失敗的平台」只重試 FB，YT 不會被重發。或者改個未來時間「重新排程」。

### 🔐 多帳號管理

每個平台可連 2 個以上帳號（多 YT 頻道、多 FB 粉專），發布時下拉選擇要發到哪個。

### 🧹 自動垃圾回收

啟動時掃描快取資料夾，自動刪除 30 天沒用的轉檔暫存、90 天沒用的縮圖 — 你不會被快取吃光磁碟。

---

## 隱私與安全（重點！）

**PuffinPuff 沒有伺服器。沒有後台。沒有資料庫主機。**

| 我們不會 | 我們會 |
|---|---|
| ❌ 收集你的個人資料 | ✅ 用 Windows DPAPI 加密儲存 OAuth token |
| ❌ 上傳影片到「我們的」雲端 | ✅ 影片從你電腦**直接**傳到 YouTube/Meta 官方 API |
| ❌ 部署 Google Analytics / FB Pixel | ✅ 全程無任何追蹤 |
| ❌ 把 token 賣給第三方 | ✅ token 只存在你電腦的 `%APPDATA%\` |
| ❌ 知道你發了什麼影片 | ✅ 連你發了幾支影片我們都不知道 |

詳閱 [隱私權政策](https://mememaker-tw.com/puffinpuff/privacy/) ＆ [服務條款](https://mememaker-tw.com/puffinpuff/terms/)

---

## 系統需求

- **Windows 10 / 11**（64-bit）
- **記憶體**：建議 8 GB（最低 4 GB）
- **硬碟**：安裝佔 500 MB；快取會自動回收
- **網路**：上傳速度建議 ≥ 5 Mbps
- **必要授權**：YouTube 頻道、Facebook 粉專、Instagram 商業帳號（已連結到 FB 粉專）

---

## 下載

<a id="download"></a>

### v0.2.4（最新穩定版，2026-05-21）

[📥 下載 海鸚泡芙 PuffinPuff-0.2.4-Setup.exe（200 MB）](#)

| 變更紀錄 |
|---|
| ✅ 啟動自動 GC：30 天未用的轉檔快取自動刪 |
| ✅ 排程「取消全部」按鈕 |
| ✅ 設定頁加「立即清理」按鈕 |
| ✅ 完整 V1.1 收尾（轉檔 + 多帳號 + 系統匣 + 影片預覽） |

[完整 CHANGELOG](https://github.com/vvlee/puffinpuff/blob/main/CHANGELOG.md)

---

## 使用說明

<a id="guide"></a>

**首次使用 3 步驟：**

1. **下載 + 安裝** Setup.exe，所有資料只存你電腦本機
2. **連結帳號**：到「帳號」頁分別連結 YouTube（透過 Google 登入）+ Facebook（透過 Meta Business Login，會同時連帶 IG）
3. **拖入影片** → 編內容 → 「發布」or「排程於」→ 完成

完整教學影片（YouTube）：[即將上線]

---

## 開放原始碼

PuffinPuff 開放於 GitHub，使用 **MIT License**。
歡迎 issue / PR / star 🌟

🔗 [github.com/vvlee/puffinpuff](https://github.com/vvlee/puffinpuff)

---

## 關於作者

**VVLEE**：獨立開發者，專注於勞資諮詢自媒體工具鏈。
- 📧 bisharing001@gmail.com
- 🌐 [mememaker-tw.com](https://mememaker-tw.com/)

---

## 法律資訊

- [隱私權政策](https://mememaker-tw.com/puffinpuff/privacy/)
- [服務條款](https://mememaker-tw.com/puffinpuff/terms/)
- [資料刪除說明](https://mememaker-tw.com/puffinpuff/data-deletion/)
- [聯絡](https://mememaker-tw.com/puffinpuff/contact/)

© 2026 VVLEE. PuffinPuff 與「海鸚泡芙」皆為 VVLEE 開發之軟體商標。
YouTube、Facebook、Instagram 為各自公司之商標。

# Google / YouTube Audit — Demo Video Script

Google YouTube Audit **強制要求** demo 影片，必須是上傳到 **YouTube 為 Unlisted**（非 Public、非 Private）的影片，再把 URL 貼到 audit 表單。

---

## 影片規格

- **片長**：3-5 分鐘（不要短於 3 分，太短會被認為交差了事；不要長於 6 分，audit 員不會看完）
- **解析度**：1080p 或以上
- **錄影**：OBS Studio / Windows Game Bar
- **語言**：旁白可中文配英文字幕，**或**全英文旁白。Google audit 員多為英語使用者，建議英文。
- **上傳方式**：上傳到 YouTube 平台後設為 **Unlisted**，把 URL 貼到 audit 表單

---

## 拍攝大綱（分鏡）

### Scene 1：標題開場（0:00 – 0:15）

| 畫面 | 字幕 |
|---|---|
| 黑底 + PuffinPuff logo + "Demo Video for YouTube API Services Audit" | "PuffinPuff — A Desktop Publishing Tool for Short-Form Video Creators" |
| | "This demo shows OAuth consent flow and the use of `youtube.upload` scope" |

### Scene 2：App 介紹（0:15 – 0:45）

| 畫面 | 旁白（英文） |
|---|---|
| PuffinPuff 主畫面（剛啟動、未連線任何帳號） | "PuffinPuff is a Windows desktop application that helps creators publish short-form videos to YouTube Shorts, Facebook Reels, and Instagram Reels simultaneously." |
| 滑鼠在側邊欄滑過 5 個分頁（發布 / 排程 / 歷史 / 帳號 / 設定） | "The app runs entirely on the user's local PC. No servers, no data collection." |
| 切到「設定」頁，停留在 "Data Folder" 區 | "All data — OAuth tokens, publish history, thumbnails — is stored only locally in the user's AppData folder." |

### Scene 3：YouTube OAuth 流程（0:45 – 1:30）★ **最重要**

| 畫面 | 旁白 |
|---|---|
| 切到「帳號」頁，畫面停 5 秒 | "To use YouTube features, the user clicks 'Connect YouTube'." |
| 點「連結 YouTube」按鈕 | (silence — let click happen) |
| Google OAuth consent screen 跳出（瀏覽器或內嵌窗），畫面慢慢放大到 consent screen 完全填滿 | "Google's standard OAuth consent screen appears. Note the app name 'PuffinPuff', the developer email, and the requested scope." |
| 用滑鼠 hover 上方 "PuffinPuff wants to access your Google Account" 標題 | "App name: PuffinPuff" |
| 滑鼠移到 "See, edit, and permanently delete your YouTube videos..." 那行（這是 youtube.upload 的描述） | "The requested permission: 'See, edit, and permanently delete your YouTube videos, ratings, comments, and captions.' This corresponds to the `youtube.upload` scope. We need this to upload new videos on the user's behalf — we do not edit or delete existing videos." |
| 點 "Continue" | "User explicitly clicks 'Continue' to authorize." |

### Scene 4：連結成功（1:30 – 1:50）

| 畫面 | 旁白 |
|---|---|
| 回到 PuffinPuff Accounts 頁，YouTube 卡片出現（頭像 + 頻道名稱） | "PuffinPuff calls `channels.list?part=snippet&mine=true` to retrieve the channel name and picture for display only." |
| 滑鼠 hover 卡片，顯示 channel ID 等資訊 | "The channel ID, name, and picture URL are stored locally — encrypted with Windows DPAPI." |

### Scene 5：上傳影片（1:50 – 3:20）★ **核心**

| 畫面 | 旁白 |
|---|---|
| 切到「發布」頁 | "Now let's upload a test video." |
| 從桌面拖入一個 15 秒的測試影片 mp4 到 Dropzone | "Drag and drop the video file." |
| 影片預覽出現，三平台規格檢查全綠 | "The video is auto-validated against each platform's specs." |
| 在內容編輯器填入：標題 "PuffinPuff YouTube API Audit Demo"、描述 "This is a test upload for YouTube API Services Audit"、Hashtag "#test"、隱私設為 Unlisted | "User fills in title, description, hashtags, and privacy setting. We pass these to the YouTube API exactly as the user enters them." |
| 上方平台 chip 確認只啟用 YouTube（FB / IG 灰掉） | "Only YouTube is enabled for this demo." |
| 點「立即發布」 | "Click 'Publish Now'." |
| PublishProgress 卡片出現，顯示 YouTube 上傳進度（位元組、百分比） | "App calls `videos.insert` via the resumable upload protocol. Direct HTTP from the user's PC to `youtube.googleapis.com`." |
| 進度跑到 100% 後出現 "✅ Success" + 「在 YouTube 開啟」連結 | "Upload complete. The returned video ID is logged in the publish history." |
| 點連結 → 瀏覽器跳出剛剛上傳的 YouTube 影片頁 | "The video is now live on the user's YouTube channel as an Unlisted video." |

### Scene 6：歷史紀錄 & 隱私確認（3:20 – 4:00）

| 畫面 | 旁白 |
|---|---|
| 切到 PuffinPuff「歷史」頁 | "Publish history shows each upload with its status and a direct link." |
| 點剛剛這筆紀錄展開詳情 | "Detail shows: video ID, channel ID, upload time, platform, status." |
| 切到「設定」頁，展示「打開資料夾」按鈕 | "User can inspect the local data folder anytime." |
| 點按鈕，檔案總管跳出 `%APPDATA%\海鸚泡芙 PuffinPuff\` | "All data lives here. `puffinpuff.db` contains the encrypted tokens. No external server is involved." |

### Scene 7：解除連結（4:00 – 4:30）

| 畫面 | 旁白 |
|---|---|
| 切回 Accounts 頁 | "Now let's disconnect to show data deletion." |
| 點 YouTube 卡片上的「解除」按鈕 | "Click 'Disconnect'." |
| 確認 Modal → 確認 | "Confirm the disconnection." |
| YouTube 卡片消失 | "Tokens and channel metadata are immediately deleted from the local database." |
| (可選) 切到 `myaccount.google.com/permissions`，秀出 PuffinPuff 已被撤銷 | "Users can also revoke from Google's permission center for an extra layer of authority removal." |

### Scene 8：收尾（4:30 – 5:00）

| 畫面 | 字幕 / 旁白 |
|---|---|
| PuffinPuff 主畫面 + 浮現文字 | "Thanks for reviewing PuffinPuff." |
| | "App website: https://mememaker-tw.com/puffinpuff/" |
| | "Privacy Policy: https://mememaker-tw.com/puffinpuff/privacy/" |
| | "Contact: bisharing001@gmail.com" |
| 結束 |

---

## 拍攝 Checklist

- [ ] 準備好乾淨的測試 Google 帳號（不要用主帳號）
- [ ] 該 Google 帳號有 YouTube 頻道
- [ ] 測試影片是無版權的純測試片（建議 OBS 錄一段純色 + 文字 "PuffinPuff Audit Test"）
- [ ] PuffinPuff 主視窗調整為 1280×800 方便 1080p 錄影
- [ ] OBS 設定為 60fps、CRF 18、1920×1080，輸出 MP4
- [ ] 全程錄音清晰（外接麥克風）或全程無聲只用文字標註
- [ ] 上傳到 YouTube 時 Privacy 設為 **Unlisted**（不要 Public）
- [ ] YouTube 上的影片 Description 加：「Demo video for Google YouTube API Services Audit submission — PuffinPuff by VVLEE (bisharing001@gmail.com)」
- [ ] 把 Unlisted URL 貼到 audit 表單 Section 6

---

## 補拍版本（萬一被退）

如果 audit 員要求重拍，常見原因：

1. **「OAuth consent screen 不清楚」**：放慢、放大、停留更久（5-10 秒），確保 reviewer 能讀到所有文字
2. **「沒看到具體 scope 是怎麼用的」**：在 Scene 5 加更多文字標註，例如黃色 highlight 圈出「`videos.insert` API call」
3. **「沒展示資料刪除」**：強化 Scene 7，可以多展示一下 `puffinpuff.db` 從有變沒有的對比（用 SQLite Browser 工具看 `accounts` table 在 disconnect 前後的差異）

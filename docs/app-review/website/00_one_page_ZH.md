# 海鸚泡芙 PuffinPuff

## 撲通一聲，內容飛上三平台

**一支影片，一鍵發布，同時送上 YouTube Shorts、Facebook Reels、Instagram Reels。**

[📥 立即下載 v0.2.5（Windows）](#download) 　
[📘 使用說明](#guide) 　
[📧 聯絡作者](mailto:bisharing001@gmail.com)

---

### 📑 目錄
- [產品介紹](#about)
- [核心功能](#features)
- [下載](#download)
- [使用說明](#guide)
- [隱私權政策](#privacy)
- [服務條款](#terms)
- [資料刪除說明](#data-deletion)
- [聯絡 / 法律](#contact)

---

<h2 id="about">產品介紹</h2>

短影音時代，「**同一支內容、發三家**」是創作者最基本的擴散動作。但實際操作上你會遇到：

- 🔁 同一支影片要打開三個 App，分別填三次標題、描述、Hashtag
- 📅 想排程在最佳時段，每個平台介面又不一樣、規則又不一樣
- ⏰ FB / IG 不允許未來 6 天以上的排程；YouTube 又有自己的隱私規則
- 🎬 HEVC / 4K / 直式影片在 IG 上傳常常失敗
- 📊 發完之後不知道哪幾家成功、哪幾家失敗、要去哪個 App 看

PuffinPuff 把這些**通通解決**：三平台同步發 + 跨平台排程月曆 + 自動轉檔 + 失敗一鍵重發 + 完整歷史紀錄。

---

<h2 id="features">核心功能</h2>

### 🎯 一次發布三平台
連結 YouTube + Facebook + Instagram 帳號後，拖入影片 → 填一次標題 → 點「發布」就完成。各平台可獨立啟用 / 停用，也可獨立覆寫標題與 Hashtag。

### 📅 跨平台排程月曆
未來 365 天的排程通通顯示在同一個月曆上，**天 / 週 / 月** 三種檢視。批量匯入資料夾自動排定每日定時（最多每日 3 支），可選跳週末，可預覽完整時程表。

### 🎬 自動轉檔（HEVC → H.264）
iPhone 拍的 HEVC、Sony 拍的 4K、橫式 16:9 — 通通自動轉成各平台都吃的 H.264 1080×1920 30fps 9:16，letterbox 補黑邊保留完整畫面。Hash 快取，同一支影片不會重複轉。

### 🛡️ 排程容錯
排程立即落盤到本機 SQLite，不怕意外關機。App 重啟自動恢復被中斷的紀錄、補發錯過 6 小時內的排程。配合「開機自動啟動」與 Tray 常駐，24/7 都能準時發。

### 🔁 失敗可重發
YouTube 成功、FB 失敗？點「重新發布失敗的平台」只重試 FB，YT 不會被重發。或者改個未來時間「重新排程」。

### 🔐 多帳號管理
每個平台可連 2 個以上帳號（多 YT 頻道、多 FB 粉專），發布時下拉選擇要發到哪個。

### 🧹 自動垃圾回收
啟動時自動掃描，刪除 30 天沒用的轉檔暫存、90 天沒用的縮圖。

### ♾️ Token 自動續期（v0.2.5）
Meta 60 天 token 在 < 7 天到期時自動 refresh，永久不過期。

---

<h2 id="download">下載</h2>

### v0.2.5（最新穩定版，2026-05-21）

[📥 海鸚泡芙 PuffinPuff-0.2.5-Setup.exe（200 MB）](https://mememaker-tw.com/puffinpuff/download/PuffinPuff-0.2.5-Setup.exe)

### 變更紀錄
- v0.2.5 — Meta long-lived token 自動續期
- v0.2.4 — 啟動自動 GC + 取消全部排程
- v0.2.3 — 轉檔快取清理 + 錯誤複製 Markdown + 影片預覽放大
- v0.2.2 — 常駐系統匣
- v0.2.1 — 多帳號發布選擇
- v0.2.0 — 草稿載回 + 設定頁 + 自動轉檔

[📜 完整 CHANGELOG](https://github.com/vvlee/puffinpuff/blob/main/CHANGELOG.md)

---

<h2 id="guide">使用說明</h2>

### 首次使用 3 步驟

1. **下載 + 安裝** Setup.exe，所有資料只存你電腦本機
2. **連結帳號**：到「帳號」頁分別連結 YouTube（透過 Google 登入）+ Facebook（透過 Meta Business Login，會同時連帶 IG）
3. **拖入影片** → 編內容 → 「發布」or「排程於」→ 完成

### 系統需求
- Windows 10 / 11（64-bit）
- 記憶體：建議 8 GB（最低 4 GB）
- 硬碟：安裝佔 500 MB；快取會自動回收
- 網路：上傳速度建議 ≥ 5 Mbps
- 必要授權：YouTube 頻道、Facebook 粉專、Instagram 商業帳號（已連結到 FB 粉專）

---

<h2 id="privacy">隱私權政策</h2>

**最後更新：2026 年 5 月 21 日**

### 一句話總結
**PuffinPuff 不會收集、不會上傳、不會儲存任何使用者資料到任何雲端伺服器。所有資料只存在你自己的電腦本機。**

本應用程式沒有後端伺服器，沒有資料庫主機，沒有第三方分析工具。當你點下「發布」時，影片是**從你電腦直接傳到 YouTube / Facebook / Instagram 的官方 API**。

### 收集哪些資料

#### 你主動授權的資料（透過官方 OAuth）

| 資料 | 用途 |
|---|---|
| OAuth Access Token | 代表你授權上傳影片 |
| OAuth Refresh Token | 在 Access Token 過期後自動續期 |
| YouTube 頻道 ID + 名稱 | 顯示「目前連結的頻道」 |
| Facebook 粉專 ID + 名稱 | 顯示「目前連結的粉專」 |
| Instagram 商業帳號 ID + 用戶名 | 顯示「目前連結的 IG 帳號」 |
| 帳號頭像 URL | UI 顯示頭像 |
| Token 到期時間 | UI 顯示「剩餘 X 天」提醒 |

#### 你主動拖入 PuffinPuff 的內容
影片檔案路徑 / 影片內容 / 標題 / 描述 / Hashtag / 隱私設定 / 自動產生的縮圖

#### PuffinPuff **不會**收集
- ❌ 個資（姓名、生日、地址、電話、身分證號）
- ❌ Google / Meta 密碼（OAuth 流程從不接觸密碼）
- ❌ 其他應用程式資料、瀏覽紀錄、檔案內容
- ❌ 使用分析、行為追蹤、cookies、廣告 ID
- ❌ 裝置硬體資訊、IP 位址、地理位置

### 資料儲存位置
**所有資料儲存在你 Windows 電腦本機**：
```
C:\Users\<你的使用者名稱>\AppData\Roaming\海鸚泡芙 PuffinPuff\
```

**Token 加密**：OAuth tokens 在寫入 `puffinpuff.db` 之前用 **Windows DPAPI** 加密，金鑰綁定你的 Windows 使用者帳號 — 沒有你的 Windows 登入密碼無法解密。

### 資料傳輸路徑
**PuffinPuff 沒有自有伺服器**。所有網路請求只在以下兩個方向之間：
```
你的電腦 (PuffinPuff)  ←→  Google / Meta 官方 API
                              ↑
                          直接傳輸，不經過任何中間伺服器
```

### Instagram 上傳的特別說明
IG 的官方上傳 API 要求影片必須是公開 HTTPS URL。PuffinPuff 在發布到 IG 時：
1. 在你電腦本機啟動臨時 HTTP 伺服器
2. 用 Cloudflare 官方 `cloudflared` 建立臨時 `trycloudflare.com` URL
3. 把這個 URL 提交給 IG API
4. **發布完成後立即關閉**，URL 立刻失效
5. 影片本體只存在你電腦的 RAM 中（不寫第二份磁碟檔）

### 第三方服務
| 服務 | 用途 | 隱私權政策 |
|---|---|---|
| Google / YouTube API | OAuth 與影片上傳 | [policies.google.com/privacy](https://policies.google.com/privacy) |
| Meta（Facebook、Instagram）Graph API | OAuth 與影片上傳 | [www.facebook.com/privacy/policy](https://www.facebook.com/privacy/policy) |
| Cloudflare cloudflared | IG 上傳臨時 tunnel | [www.cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |

### Cookies & 追蹤
PuffinPuff 是桌面應用程式，**不使用 cookies**、**不部署任何分析腳本**、**不追蹤使用者行為**。本官網亦無任何追蹤腳本。

### 未成年人保護
PuffinPuff 不針對未滿 13 歲的兒童設計。

### 政策變更通知
重大變更會更新本頁面「最後更新日期」並在 App 內以系統通知告知使用者。

### 合規對照
本政策參照：中華民國個資法、歐盟 GDPR、美國 CCPA、Meta Platform Terms、Google API Services User Data Policy。

---

<h2 id="terms">服務條款</h2>

**最後更新：2026 年 5 月 21 日**

### 一、服務說明
PuffinPuff 是由 VVLEE 開發的 Windows 桌面工具，協助使用者將短影音檔案一次同步發布至 YouTube Shorts、Facebook Reels、Instagram Reels。**完全在使用者電腦本機執行**，沒有伺服器、不收集使用者資料。

### 二、授權範圍
VVLEE 授予您**免費、非專屬、不可轉讓**的個人或商業使用授權。您**不得**：
1. 對本應用程式進行還原工程、反編譯、反組譯
2. 用於違反 YouTube/Meta ToS 或任何法律
3. 移除版權聲明、品牌標識
4. 重新散布、轉售、出租
5. 進行垃圾發布、批量惡意內容、版權侵權上傳

### 三、使用者帳號與授權
- 您必須擁有合法的 YouTube / Facebook / Instagram 帳號
- **您本人對所發布的內容負完全責任**

### 四、影片內容與第三方平台政策
影片上傳完成後歸該平台管轄：[YouTube ToS](https://www.youtube.com/static?template=terms) / [Meta ToS](https://www.facebook.com/legal/terms) / [Instagram ToU](https://help.instagram.com/581066165581870)。PuffinPuff **不會、也無能力**於上傳後修改或刪除您在平台上的內容。

### 五、API 配額與限制
| 平台 | 預設限制 |
|---|---|
| YouTube | Data API quota: 10,000 點/日（一次上傳約 1,600 點）|
| Facebook | Rate limit: 200 calls / hr / token |
| Instagram | Reels API: 25 個 container / 24 hr / 帳號 |

### 六、無擔保聲明
本應用程式以「**現狀**」（AS IS）提供。VVLEE 不擔保完美運作、第三方 API 穩定性、上傳成功率、無 bug 等。

### 七、責任限制
在法律允許範圍內，VVLEE 對任何直接、間接、附隨、衍生損害不負任何責任。最高責任額度為 **新台幣 0 元**（本應用程式為免費軟體）。

### 八、應用程式更新
VVLEE 可能不定期釋出新版本，由您自行下載安裝。

### 九、終止
您可隨時：
1. App 內解除所有帳號連結
2. 從 Windows「應用程式」中解除安裝
3. 刪除 `%APPDATA%\海鸚泡芙 PuffinPuff\` 資料夾

### 十、爭議解決與準據法
適用**中華民國法律**。爭議以**臺灣臺北地方法院**為第一審管轄法院。

---

<h2 id="data-deletion">資料刪除說明</h2>

**最後更新：2026 年 5 月 21 日**

### 一句話總結
**PuffinPuff 從不上傳任何資料到雲端**。所有資料都在你電腦本機。要刪資料就是刪你電腦上的資料夾，外加（建議）到平台後台撤銷授權。

### 方法 1：完全刪除本機資料（最徹底）

1. **關閉 App**：系統匣海鸚 logo 右鍵 → **完全結束 PuffinPuff**
2. **刪除資料夾**：Win+R → 輸入 `%APPDATA%` → 找到「海鸚泡芙 PuffinPuff」資料夾 → 整個刪掉
3. **（可選）解除安裝**：設定 → 應用程式 → 已安裝的應用程式 → 海鸚泡芙 PuffinPuff → 解除安裝

### 方法 2：刪除單一帳號（保留其他帳號）
開啟 App → 帳號頁 → 找到要刪除的帳號卡片 → 點「**解除**」→ 確認

### 方法 3：只清歷史紀錄
開啟 App → 設定頁 → 資料管理 → 點「**清空歷史紀錄**」

### 別忘了到平台撤銷授權

| 平台 | 撤銷網址 |
|---|---|
| Google / YouTube | [myaccount.google.com/permissions](https://myaccount.google.com/permissions) |
| Facebook / Instagram | Facebook → 設定 → 商業整合 → 已連結的應用程式與網站 → PuffinPuff → 移除 |

### 已發布到 YT/FB/IG 的影片
PuffinPuff 只負責「送上去」，刪除請到 YouTube Studio / FB 粉專管理 / IG App 各自原生介面。

---

<h2 id="contact">聯絡 / 法律</h2>

### 主要聯絡

**📧 bisharing001@gmail.com**　
回應時間：7 個工作日內

### 回應時間 SLA
| 類別 | SLA |
|---|---|
| 一般技術支援 | 7 個工作日 |
| 隱私 / 資料權利請求 | 30 天（依法定上限）|
| 疑似資料外洩 | 24 小時內初步確認 |
| 商業合作 | 14 個工作日 |
| 審查單位（Google / Meta）查詢 | 3 個工作日 |

### 開發者資訊
**VVLEE**　獨立軟體開發者，專注於勞資諮詢自媒體工具鏈。
- 📧 bisharing001@gmail.com
- 🌐 [mememaker-tw.com](https://mememaker-tw.com/)

### 法律送達
依中華民國法律，本應用程式相關法律文件之送達地址為作者電子郵件：**bisharing001@gmail.com**

---

© 2026 VVLEE. PuffinPuff 與「海鸚泡芙」皆為 VVLEE 開發之軟體商標。YouTube、Facebook、Instagram 為各自公司之商標。

[🇺🇸 English version](https://mememaker-tw.com/puffinpuff/en/)

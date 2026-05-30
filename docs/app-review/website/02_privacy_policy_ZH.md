# 隱私權政策｜海鸚泡芙 PuffinPuff

**最後更新：2026 年 5 月 21 日**
**生效日期：2026 年 5 月 21 日**

---

## 我們是誰

「海鸚泡芙 PuffinPuff」（以下簡稱「本應用程式」或「PuffinPuff」）是一個於 **Windows 個人電腦本地端執行**的桌面應用程式，由開發者 **VVLEE** 製作與維護，目的是協助創作者一次將短影音同步發布到 YouTube Shorts、Facebook Reels、Instagram Reels 三大平台。

聯絡信箱：**bisharing001@gmail.com**
官網：[https://mememaker-tw.com/puffinpuff/](https://mememaker-tw.com/puffinpuff/)

---

## 一句話總結

**PuffinPuff 不會收集、不會上傳、不會儲存任何使用者資料到任何雲端伺服器。所有資料只存在你自己的電腦本機。**

本應用程式沒有後端伺服器，沒有資料庫主機，沒有第三方分析工具。當你點下「發布」時，影片是**從你電腦直接傳到 YouTube / Facebook / Instagram 的官方 API**，PuffinPuff 並未居中經手。

---

## 一、我們收集哪些資料

### 1.1 你主動授權給 PuffinPuff 的資料

當你在 PuffinPuff 連結 YouTube、Facebook、Instagram 帳號時，**透過官方 OAuth 流程**取得以下資料：

| 資料 | 來源 | 用途 |
|---|---|---|
| OAuth Access Token | Google / Meta 官方 OAuth | 代表你授權 PuffinPuff 上傳影片 |
| OAuth Refresh Token | Google 官方 OAuth | 用於在 Access Token 過期後自動續期 |
| YouTube 頻道 ID 與名稱 | YouTube Data API | 顯示「目前連結的頻道」 |
| Facebook 粉絲專頁 ID 與名稱 | Meta Graph API | 顯示「目前連結的粉專」 |
| Instagram 商業帳號 ID 與用戶名 | Meta Graph API | 顯示「目前連結的 IG 帳號」 |
| 帳號頭像 URL | 各平台 | UI 顯示頭像（不快取到本機） |
| Token 到期時間（Long-lived token 有效期限） | Meta | UI 顯示「剩餘 X 天」提醒 |

### 1.2 你主動拖入 PuffinPuff 的內容

| 資料 | 用途 |
|---|---|
| 影片檔案路徑 | 讀取影片用於上傳 |
| 影片內容（mp4 / mov / webm 等） | 上傳到你授權的平台 |
| 你輸入的標題、描述、Hashtag、隱私設定 | 填入發布 API 對應欄位 |
| 影片縮圖（PuffinPuff 自動產生） | 預覽顯示用 |

### 1.3 PuffinPuff **不會**收集的資料

- ❌ 你的姓名、生日、地址、電話、身分證號等 PII
- ❌ 你的 Google / Meta 帳號密碼（OAuth 流程從不接觸密碼）
- ❌ 你電腦上其他應用程式的資料、瀏覽紀錄、檔案內容
- ❌ 任何形式的使用分析、行為追蹤、cookies、廣告 ID
- ❌ 裝置硬體資訊、IP 位址、地理位置

---

## 二、資料儲存位置

**所有 PuffinPuff 處理的資料都儲存在你自己的 Windows 電腦本機**，路徑為：

```
C:\Users\<你的使用者名稱>\AppData\Roaming\海鸚泡芙 PuffinPuff\
```

| 檔案 / 資料夾 | 內容 |
|---|---|
| `puffinpuff.db` | SQLite 資料庫，內含帳號 token（加密）、歷史發布紀錄、排程資料 |
| `thumbs/` | 影片縮圖快取（jpg） |
| `transcoded/` | 自動轉檔後的暫存影片（mp4） |
| `bin/cloudflared.exe` | 第三方工具，用於 IG 上傳暫時的公開 URL（見第四節） |
| Electron Cache 資料夾 | 應用程式視窗的本機快取 |

### 2.1 Token 加密

OAuth Access Token 與 Refresh Token 在寫入 `puffinpuff.db` 之前，會使用 **Windows DPAPI（資料保護 API）** 進行**對應你 Windows 使用者帳號**的加密。也就是說：

- 即使有人取得你的 `puffinpuff.db` 檔案，**沒有你的 Windows 登入密碼也無法解密 token**
- DPAPI 由微軟作業系統提供，金鑰僅儲存在你電腦的 Windows 安全子系統

---

## 三、資料傳輸路徑

**PuffinPuff 沒有自有伺服器**。所有的網路請求只在以下兩個方向之間發生：

```
你的電腦 (PuffinPuff)  ←→  Google / Meta 官方 API
                              ↑
                          直接傳輸，不經過任何中間伺服器
```

具體呼叫的端點：

| 平台 | 端點 | 用途 |
|---|---|---|
| YouTube | `oauth2.googleapis.com` | OAuth token 交換 / refresh |
| YouTube | `youtube.googleapis.com` | 影片上傳（resumable upload） |
| Facebook | `graph.facebook.com` | OAuth + 粉專列表 + Reels 上傳 |
| Facebook | `rupload.facebook.com` | Reels 影片二進位上傳 |
| Instagram | `graph.facebook.com` | OAuth + IG 帳號連動 + 上傳容器建立與輪詢 |
| Instagram | `trycloudflare.com`（暫時，見下節） | 暫時暴露影片給 IG 抓取 |

---

## 四、Instagram 上傳的特別說明（Cloudflared Tunnel）

Instagram 的官方上傳 API **要求影片必須是公開可訪問的 HTTPS URL**（不接受本機檔案直傳）。因此 PuffinPuff 在發布到 IG 時會：

1. 在你電腦本機啟動一個**臨時的 HTTP 伺服器**（隨機 port）
2. 透過 [Cloudflare 官方 cloudflared 工具](https://github.com/cloudflare/cloudflared)建立**臨時的 trycloudflare.com URL**
3. 把這個 URL 提交給 Instagram API
4. Instagram 在 30 秒到幾分鐘內從這個 URL 把影片抓走
5. **發布完成後立即關閉**臨時伺服器與 tunnel，URL 立刻失效

關鍵特性：
- ✅ **URL 是隨機的、無人可預測**（cloudflared 自動產生）
- ✅ **URL 在發布完成後立即失效**，不會留下任何公開可訪問的影片連結
- ✅ 影片本體**只存在你電腦的 RAM 中**（不寫第二份磁碟檔）
- ✅ 整個流程**沒有任何 PuffinPuff 伺服器涉入**

---

## 五、第三方服務

PuffinPuff 在執行過程中會與下列第三方服務互動，這些服務有各自的隱私權政策，**不在本政策的管轄範圍**：

| 服務 | 用途 | 隱私權政策 |
|---|---|---|
| Google / YouTube API | OAuth 與影片上傳 | [policies.google.com/privacy](https://policies.google.com/privacy) |
| Meta（Facebook、Instagram）Graph API | OAuth 與影片上傳 | [www.facebook.com/privacy/policy](https://www.facebook.com/privacy/policy) |
| Cloudflare cloudflared | IG 上傳臨時 tunnel | [www.cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |

當你透過 PuffinPuff 連結與發布內容到這些平台時，相關資料的後續使用受其自身政策約束。

---

## 六、Cookies 與追蹤

PuffinPuff 是 **桌面應用程式（Electron）**，**不使用 cookies**，**不部署任何分析腳本**（Google Analytics、Facebook Pixel、TikTok Pixel 等一律沒有），**不追蹤使用者行為**。

本官網（mememaker-tw.com/puffinpuff）僅提供說明性靜態內容，亦無任何追蹤腳本。

---

## 七、資料刪除與授權撤銷

### 7.1 從 PuffinPuff 內部解除帳號

在 App 內「帳號」頁點選任一帳號旁的「解除」按鈕，即會：
- 從本機資料庫**刪除該帳號的所有 token 與資訊**
- App 不再能代表該帳號發布

### 7.2 從平台官方介面撤銷授權（建議同時做）

| 平台 | 撤銷網址 |
|---|---|
| Google / YouTube | [myaccount.google.com/permissions](https://myaccount.google.com/permissions) |
| Facebook | 「設定 → 商業整合 → 已連結的應用程式與網站」 |
| Instagram | 同 Facebook（IG 透過 FB Business Manager 管理） |

### 7.3 完整刪除 PuffinPuff 所有本機資料

關閉 App，刪除整個資料夾：
```
C:\Users\<你>\AppData\Roaming\海鸚泡芙 PuffinPuff\
```
即可清空所有歷史紀錄、token、縮圖、轉檔暫存。

詳細步驟另見：[資料刪除說明頁](https://mememaker-tw.com/puffinpuff/data-deletion/)

---

## 八、未成年人保護

PuffinPuff **不針對未滿 13 歲的兒童設計**，亦不主動向其提供服務。若我們得知有兒童的資料被收集，會立即予以刪除。但因 PuffinPuff 不收集任何個人識別資訊，實務上此情況不會發生。

---

## 九、本政策變更通知

若本政策有重大變更，我們會：
1. 更新本頁面的「最後更新日期」
2. 在 PuffinPuff 應用程式內以系統通知告知使用者
3. 重大變更（例如新增收集項目）會請使用者重新同意

---

## 十、聯絡我們

如對本隱私權政策有任何疑問、想行使資料權利、或回報疑似資料外洩，請寄信至：

**📧 bisharing001@gmail.com**

我們會於 7 個工作日內回覆。

---

## 附錄：合規對照

本政策參照以下法規與審查框架制定：

- 中華民國《個人資料保護法》
- 歐盟 GDPR（一般資料保護規則）
- 美國 California CCPA
- Meta Platform Terms（FB / IG App Review 要求）
- Google API Services User Data Policy（YouTube Audit 要求）

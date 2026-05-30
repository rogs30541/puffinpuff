# 資料刪除說明｜海鸚泡芙 PuffinPuff

**最後更新：2026 年 5 月 21 日**

---

> Meta（Facebook、Instagram）強制要求所有使用其 API 的應用程式提供**清楚、可操作**的資料刪除指引。本頁面即為 PuffinPuff 對此要求的回應。

---

## 一句話總結

**PuffinPuff 從不上傳任何資料到雲端。**所有資料都在你電腦本機。要刪資料就是**刪你電腦上的資料夾**，外加（建議）**到平台後台撤銷授權**。

---

## 我的資料在哪裡？

| 位置 | 內容 |
|---|---|
| 你的 Windows 電腦 `%APPDATA%\海鸚泡芙 PuffinPuff\` | 帳號 token（加密）、歷史紀錄、縮圖、轉檔暫存 |
| ~~PuffinPuff 雲端伺服器~~ | **不存在** — 我們沒有伺服器 |
| Meta / Google 平台官方資料庫 | OAuth 授權紀錄、上傳影片內容（由平台管轄） |

---

## 方法一：完全刪除 PuffinPuff 本機資料（最徹底）

### 步驟 1：關閉 App

1. 在系統匣（右下角箭頭內）找到海鸚 logo
2. 右鍵 → 點「**完全結束 PuffinPuff**」

### 步驟 2：刪除資料夾

按 `Windows + R` 開啟「執行」，輸入：
```
%APPDATA%\海鸚泡芙 PuffinPuff
```
按 Enter。

在開啟的檔案總管視窗中，**返回上一層**，找到「**海鸚泡芙 PuffinPuff**」資料夾，**整個刪掉**。

### 步驟 3（可選）：解除安裝應用程式

「設定 → 應用程式 → 已安裝的應用程式 → 海鸚泡芙 PuffinPuff → 解除安裝」。

完成。本機沒有任何 PuffinPuff 殘留資料。

---

## 方法二：只刪除單一帳號的資料（保留其他帳號）

如果你只想刪掉某個帳號（例如某個 YouTube 頻道），不要清掉所有：

1. 開啟 PuffinPuff
2. 點側邊欄「**帳號**」
3. 找到要刪除的帳號卡片
4. 點「**解除**」按鈕
5. 確認後該帳號的 token 與資訊**立即從本機資料庫刪除**

---

## 方法三：只清歷史紀錄（保留帳號連結）

1. 開啟 PuffinPuff → 點側邊欄「**設定**」
2. 「資料管理」區塊 → 點「**清空歷史紀錄**」
3. 確認 Modal 跳出 → 「清空」

這只清掉發布過的紀錄（未來的排程、帳號 token 都保留）。

---

## 重要：別忘了去 Meta / Google 撤銷授權

刪除 PuffinPuff 本機資料**不會撤銷你給予的 OAuth 授權**。授權紀錄存在平台官方那邊，需要另外處理：

### Facebook / Instagram

1. 開啟 [Facebook 設定 → 商業整合](https://www.facebook.com/settings?tab=business_tools)
2. 找到「PuffinPuff」（或顯示為「VVLEE PuffinPuff Publisher」）
3. 點「**移除**」

或直接登入手機 / 桌面版 Facebook：
- 設定與隱私 → 設定 → 商業整合 → 已連結的應用程式與網站 → PuffinPuff → 移除

Instagram 的連結是透過 FB Business Manager 管理，做上面這步就同時撤銷了。

### Google / YouTube

1. 開啟 [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
2. 找到「PuffinPuff」
3. 點「**移除存取權**」

完成。Google 不會再讓 PuffinPuff 代表你的帳號做任何事。

---

## 我發布到 YouTube / FB / IG 的影片內容呢？

PuffinPuff **只負責把影片送上各平台**，發布完成後影片就完全歸該平台管轄。要刪除這些影片，請**直接到各平台原生介面**操作：

- **YouTube**：YouTube Studio → 內容 → 選影片 → 刪除
- **Facebook 粉專**：粉專管理介面 → 貼文 → 刪除
- **Instagram**：IG App → 個人檔案 → 找到該 Reel → ⋯ → 刪除

PuffinPuff 不會、也無法在上傳完成後刪除平台上的內容。

---

## 我刪資料夾後還能再用嗎？

可以。刪除 `%APPDATA%\海鸚泡芙 PuffinPuff\` **不影響應用程式本體**（應用程式安裝在 `Program Files`）。下次開啟 PuffinPuff 會把資料夾重建空的，要求你重新連結帳號。

---

## 有疑問？

**📧 bisharing001@gmail.com**

我們會於 7 個工作日內回覆。

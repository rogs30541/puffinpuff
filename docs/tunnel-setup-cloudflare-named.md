# Cloudflare Named Tunnel 設定指南（PuffinPuff v0.5.0+）

> **這份文件是給 PuffinPuff 使用者看的逐字句操作手冊。**
> 一次性設定 ~10 分鐘，之後 IG 上傳永遠不會撞到「error 1015 / Too Many Requests」。

---

## 前置條件 ✅

- ✅ 一個 Cloudflare 帳號（[免費註冊](https://dash.cloudflare.com/sign-up)）
- ✅ 一個自己擁有的網域，且 DNS 已託管在 Cloudflare（免費 plan 即可）
  - 例：`mememaker-tw.com`、`king-fong-chufu.com.tw`
  - 若還沒託管：到 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Add Site → 跟著精靈把網域的 nameserver 改成 Cloudflare 的（需到網域註冊商 GoDaddy/Namecheap 那邊改一次 NS 紀錄，等 DNS propagation 0.5-24 小時）
- ✅ 已安裝 PuffinPuff v0.5.0 或更新

---

## 設定步驟

### Step 1：開啟 Cloudflare Zero Trust dashboard

開瀏覽器，前往：

👉 **https://one.dash.cloudflare.com/**

第一次登入會要你選團隊名稱（team name）— 隨便取一個英文名即可（例 `vvlee`）。

> ⚠️ 注意：是 **Zero Trust dashboard**（`one.dash.cloudflare.com`），不是普通 Cloudflare dashboard。Zero Trust 是 Cloudflare 的企業安全產品，免費版有 50 user 額度，個人用戶完全用不完。

---

### Step 2：建立 Tunnel

左側選單：

1. 點 **Networks**（如果展開的話）
2. 點 **Tunnels**
3. 右上角藍色按鈕 **Create a tunnel**

選擇 connector type：
- **Cloudflared**（推薦，PuffinPuff 已內建）
- 不要選 WARP Connector

按 **Next**。

---

### Step 3：命名 + 取得 Token

- **Tunnel name**：取個你能認得的名字，例：
  - `puffinpuff-vvlee`
  - `puffinpuff-mememaker`
- 按 **Save tunnel**

接下來會看到「Install and run a connector」頁面，**這頁最關鍵**：

頁面中間會有一個程式碼區塊（看起來像）：

```
sudo cloudflared service install eyJhIjoiNDhmZGI0... [很長一串]
```

👉 **把 `eyJ...` 開頭的那一整串 token 複製起來**（**不要**包含前面 `sudo cloudflared service install`）

> 💡 直接點該區塊右上角的「複製」icon → 會複製整段命令 → 貼到記事本 → 把前面 `sudo cloudflared service install ` 砍掉，剩下的 `eyJ...` 才是 token

下方有 Windows / macOS / Linux 三個 tab — **全部跳過，不需要在你電腦執行那些指令**，因為 PuffinPuff 內建 cloudflared。

按 **Next**。

---

### Step 4：設定 Public Hostname

這頁是把「公開 hostname → 你本機某個 port」綁定起來。

| 欄位 | 你要填的值 |
|---|---|
| **Subdomain** | `puffin`（或你想要的任何子網域） |
| **Domain** | 從下拉選你的網域（例 `mememaker-tw.com`） |
| **Path** | 留空 |
| **Service Type** | `HTTP` |
| **URL** | `localhost:33344` ⚠️ **必須是這個 port** |

> ⚠️ **URL 欄位填 `localhost:33344` 是關鍵**！PuffinPuff 內部寫死用 port 33344 起本機 server，這必須跟 Cloudflare 這邊的設定對齊，否則 tunnel 收到請求會找不到後端 server。

✅ 完整 hostname 範例：`puffin.mememaker-tw.com`

按 **Save tunnel**（或 **Save hostname**，名稱依 Cloudflare 改版而定）。

✅ Cloudflare 會自動建立 DNS CNAME 紀錄，把 `puffin.mememaker-tw.com` 指向 tunnel ID。

---

### Step 5：回 PuffinPuff 設定

開 PuffinPuff：

1. **設定** 頁
2. 找到「**IG 隧道工具（cloudflared）**」卡片
3. 「**Cloudflare Tunnel Token**」欄位：貼上 Step 3 複製的 token
4. 「**Public Hostname**」欄位：填 `puffin.mememaker-tw.com`（用你 Step 4 設的完整 hostname）
5. 點 **儲存設定**
6. 點 **測試連線**

#### 測試連線會發生什麼？

PuffinPuff 會在背景：
1. 啟動 cloudflared，用你的 token 連到 Cloudflare
2. 等 30 秒內看到「Registered tunnel connection」訊號
3. 對 `https://puffin.mememaker-tw.com/` 發送 HEAD 請求，確認 DNS + tunnel routing 正常
4. 關閉 cloudflared

成功的話會跳綠色提示：

> ✅ 連線成功！Cloudflare tunnel 已就緒，hostname HTTP 回應碼 502（測試時沒跑 local server，所以 4xx/5xx 屬正常）

> 💡 看到 **502 是正常的**！測試的時候沒有跑本機 server，Cloudflare tunnel 把請求轉到 `localhost:33344` 但沒人接 → 回 502。重點是 **DNS + tunnel routing 通了**，這就是測試的目的。

失敗的話會跳紅色錯誤訊息 — 對照下方 [常見問題](#常見問題排查)。

---

### Step 6：切換到 Named Tunnel 模式

回到設定卡片頂部，「**IG 隧道模式**」radio：

- ⚪ Quick Tunnel（預設）
- 🟢 **Named Tunnel（穩定、無限流）** ← 點這個

切換完成後，**下次 IG 上傳就會自動用 Named Tunnel**，永遠不會遇到 1015 限流。

---

## 確認設定生效

回到設定頁，「IG 隧道工具」卡片底部會顯示：

- ✅ **已驗證**
- 最後測試：2026-05-25 16:42:11

之後正常發 IG，Tunnel 會自動啟動 + 自動關閉，你完全感覺不到差異 — 但不會再撞牆。

---

## 常見問題排查

### Q1. 測試連線跳「30 秒未連線」
**原因**：token 錯誤、被吃掉空白、或網路檔住 Cloudflare 連線
- 重新複製一次 token（不要包含前後空格）
- 確認電腦能正常上網
- 在公司/學校網路可能擋 cloudflared，試試手機熱點

### Q2. 測試連線跳「DNS 找不到 puffin.xxx.com」
**原因**：Cloudflare dashboard 的 Public Hostname 沒設好
- 回 Step 4 確認 Subdomain + Domain 都填了
- 等 1-2 分鐘讓 DNS propagation 完成

### Q3. 發 IG 時跳「本機 port 33344 已被佔用」
**原因**：你電腦有其他程式佔用 port 33344
- 開 PowerShell：`netstat -ano | findstr :33344` → 看是哪個 PID
- `taskkill /F /PID <pid>` 關掉
- 或暫時切回 Quick Tunnel 模式

### Q4. Cloudflare dashboard 找不到「Tunnels」選項
**原因**：你登錯了，登進的是 [dash.cloudflare.com](https://dash.cloudflare.com/)（一般 dashboard）
- 改開 [one.dash.cloudflare.com](https://one.dash.cloudflare.com/)（Zero Trust dashboard）
- 第一次登入要設 team name

### Q5. 沒有 Cloudflare 託管的網域
**選項 A**：拿一個 `*.com.tw` 或 `*.app` 等便宜網域（年費 $300-1000 TWD），讓 Cloudflare 託管 DNS（免費）
**選項 B**：暫時繼續用 Quick Tunnel，撞到 1015 就切手機熱點

---

## 安全 / 隱私說明

- ✅ **Token 用 Windows DPAPI 加密儲存**（與 PuffinPuff 儲存 Meta/Google OAuth token 同等級）
- ✅ Token 只有 main process 解密使用，**不會傳到 renderer / DevTools / 外部**
- ✅ Cloudflare named tunnel 流量走 Cloudflare global edge，已加密
- ⚠️ Token 等同密碼，**不要分享給別人**。萬一外洩 → Cloudflare dashboard → Tunnels → 找到對應 tunnel → Delete tunnel → 重建新的取新 token

---

## 卸載 / 切回 Quick Tunnel

PuffinPuff 設定頁 → IG 隧道工具卡片 → **刪除設定** 按鈕。

會自動：
1. 從本機 DB 刪除加密 token + hostname
2. 切回 Quick Tunnel 模式

Cloudflare dashboard 上的 tunnel 不會被自動刪除（PuffinPuff 沒有那個權限）。如要清乾淨：手動到 Cloudflare → Networks → Tunnels → 找到該 tunnel → Delete。

---

**最後更新**：2026-05-25 (v0.5.0)
**問題回報**：bisharing001@gmail.com

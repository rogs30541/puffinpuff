# PuffinPuff Google OAuth 驗證錄影腳本（youtube.upload + youtube.readonly）

> Google 審核員看這支影片驗證兩個 YouTube scope 的實際用途。
> **硬性要求（Google 官方說明）**：
> 1. 必須錄到完整 OAuth 流程
> 2. **「未經驗證的應用程式」警告畫面必須入鏡**（Google 明說這是正常現象且必須顯示）
> 3. 影片放 YouTube（**不公開/unlisted** 即可），把連結給 Claude
>
> 全程不用講話；放慢操作，每個畫面停 2-3 秒。預估 2-3 分鐘。

## 事前準備（不入鏡）

- [ ] OBS 來源用「**顯示器擷取**」（OAuth 會開瀏覽器視窗，視窗擷取會漏錄）
- [ ] 準備一支測試短影片（.mp4 直式 9:16）放桌面
- [ ] PuffinPuff 帳號頁 → 若 YouTube 已連線，先解綁（為了示範完整 OAuth）

## 開拍（一鏡到底）

### 場景 1｜App 身分（10 秒）
1. 開 PuffinPuff 主視窗，停 2 秒（側欄版本號入鏡）

### 場景 2｜YouTube OAuth 完整流程 ⭐（60 秒）
1. 側欄 →「帳號」→ YouTube 卡片按「連線」
2. 瀏覽器開啟 Google 登入 → 選帳號
3. **「Google 尚未驗證這個應用程式」警告出現 → 停 3 秒 → 點「進階」→「前往 PuffinPuff（不安全）」**（這段必須入鏡，Google 要求）
4. 權限同意畫面（管理您的 YouTube 影片／查看您的 YouTube 帳戶）→ **停 3 秒** → 允許
5. 回到 app：帳號頁顯示已連線的頻道名稱（youtube.readonly 用途①，停 2 秒）

### 場景 3｜上傳 Shorts（60 秒）
1. 側欄 →「發布」→ 模式「影片 Reels」→ 拖入測試影片
2. 填標題（例：PuffinPuff demo）→ 平台只開 YouTube
3. 按發布 → **等進度條跑完、綠勾出現**（全程入鏡）
4. 點成功後的影片連結 → 瀏覽器開啟 YouTube 看到影片（停 3 秒）（youtube.upload 用途）

### 場景 4｜歷史頁數據（20 秒）
1. 側欄 →「歷史」→ 點開剛那筆 → 按「抓取數據」
2. YouTube 卡片的觀看數出現（0 也可以），停 3 秒（youtube.readonly 用途②）

## 收尾

1. 停止錄影
2. 影片上傳到 YouTube：瀏覽權限選「**不公開**」（unlisted）
3. 把 YouTube 連結貼給 Claude → Claude 填回驗證表單＋範圍說明 → 你按「確認」送出

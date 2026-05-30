# Google OAuth Verification + YouTube API Audit 提交資料夾

Google 的審查比 Meta 更嚴格，分**兩階段**：

```
Stage 1: OAuth Brand Verification (1-2 週)
  ↓
Stage 2: YouTube API Services Audit (3-6 週)
```

兩階段都通過後才能切到 Production，refresh token 永久有效。

## 流程概覽

1. Google Cloud Console → OAuth Consent Screen 改 Publishing Status: "In production"
2. 上傳 App Logo (120×120)、homepage URL、privacy policy URL、ToS URL
3. 域名驗證（Search Console 驗證 mememaker-tw.com 為 OAuth 域名）
4. 等 Brand Verification 通過（1-2 週）
5. 進入 YouTube API Services Audit 表單（額外的詳細問卷）
6. 提交 demo 影片（YouTube unlisted）
7. 等 audit 通過（3-6 週，可能要 1-2 輪補件）

## 檔案清單

| 檔名 | 用途 |
|---|---|
| `01_oauth_consent_screen.md` | OAuth Consent Screen 各欄位答案 |
| `02_youtube_audit_questionnaire.md` | YouTube API Audit 問卷答案 |
| `03_demo_video_script.md` | demo 影片拍攝腳本（必須上傳 YouTube unlisted） |
| `04_appendix_compliance.md` | 補充用：YouTube 政策對照表 |

## 必要前置條件

- ✅ Google Cloud Project ID：(查 Google Console)
- ✅ OAuth Client ID（Desktop App 類型）
- ✅ Scope：`https://www.googleapis.com/auth/youtube.upload`
- ✅ Homepage URL: `https://mememaker-tw.com/puffinpuff/`
- ✅ Privacy Policy URL: `https://mememaker-tw.com/puffinpuff/privacy/`
- ✅ Logo: 120×120 PNG（取自 `build/icon.png`，downscale）
- ✅ Search Console 已驗證 mememaker-tw.com
- ✅ Demo Video 已上傳 YouTube 為 Unlisted

## 預估時程

| 階段 | 預估 |
|---|---|
| 準備材料 + 上傳官網 | 1 週 |
| Brand Verification 送審 + 等候 | 1-2 週 |
| YouTube API Audit 送審 + 等候 | 3-6 週 |
| **總計** | **5-9 週** |

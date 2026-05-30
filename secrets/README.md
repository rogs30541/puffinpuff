# secrets/ 機密憑證資料夾

⚠️ **此資料夾內的 JSON 檔絕對不可上 git。** `.gitignore` 已設定排除規則。

## 應該放在這裡的檔案

### `google_oauth.json`
從 Google Cloud Console 下載的 OAuth 2.0 Desktop Client 憑證。

**取得方式**：照 `../開發者帳號設定指南.md` 的 **Part A** 步驟操作，
最後一步「下載 JSON」後把 `client_secret_xxxxxxxxxx.json` 改名為 `google_oauth.json` 放這裡。

**格式範例**：
```json
{
  "installed": {
    "client_id": "xxxxxxxxxxx-xxxxxxxxx.apps.googleusercontent.com",
    "project_id": "puffinpuff",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "GOCSPX-xxxxxxxxxxxxxxxxxxxx",
    "redirect_uris": ["http://localhost"]
  }
}
```

### `meta_oauth.json`
Meta for Developers 取得的 App ID 與 App Secret。**自行建立此檔**。

**格式**：
```json
{
  "app_id": "1234567890123456",
  "app_secret": "abc123def456...",
  "api_version": "v21.0"
}
```

## 為什麼分開存

- **DPAPI 雙重保護**：runtime 取得的 OAuth access_token 與 refresh_token 會再經 Electron `safeStorage` 用 Windows DPAPI 加密後存進 SQLite，本 JSON 只存「應用程式憑證」（client_id/secret）
- **方便異機重灌**：機器壞了把這個資料夾複製到新機器就能繼續用（OAuth token 會自動 refresh）

## 不應該放在這裡的

- ❌ 使用者的 access token / refresh token（這些走 SQLite + safeStorage）
- ❌ 影片檔、縮圖（這些走暫存目錄）
- ❌ 任何 OAuth 完成後 runtime 才產生的資料

# Meta App Review 提交資料夾

本資料夾包含 PuffinPuff 申請 Meta App Review 所需的全部文案、操作步驟、screencast 拍攝腳本。

## 流程總覽

```
Step 1: 確認 App 後台基本資料完整
  → App Dashboard / App Review / Permissions and Features

Step 2: 對每個 permission 點「Request Advanced Access」
  → 填入「How will your app use this permission?」說明（用 02 文件）
  → 上傳 screencast 影片（用 03 腳本拍）
  → 提供 Test User 帳號與步驟（用 04 文件）

Step 3: 同時送出 6 個 permission，平行審查
  → 每個審查 1-3 週

Step 4: 通過後 App Mode 改 Live
  → 任何 Meta 用戶都能授權使用
```

## 檔案清單

| 檔名 | 用途 |
|---|---|
| `01_app_basic_info.md` | App Dashboard 必填欄位 |
| `02_permissions_usage.md` | 6 個 permission 的 use case 文案 |
| `03_screencast_scripts.md` | 6 個 permission 的拍攝腳本 |
| `04_tester_instructions.md` | 給 Meta Reviewer 的測試帳號與重現步驟 |
| `05_data_handling.md` | Data Use Checkup 對應答案 |

## 必要前置條件

- ✅ PuffinPuff 官網已上線：`https://mememaker-tw.com/puffinpuff/`
- ✅ 隱私權政策、ToS、資料刪除說明均可公開訪問
- ✅ Business Manager 擁有者：李白廬商行（已通過 Meta 驗證）
- ✅ App ID：（請於 Meta Developer Console 確認）
- ✅ Test User：已在 App Dashboard 加入 Meta 提供的審查帳號（每次送審前確認）

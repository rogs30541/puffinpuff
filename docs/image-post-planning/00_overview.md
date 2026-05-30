# 圖文批量發布｜內容企劃方法論

> v0.3.0 起，PuffinPuff 支援「批量圖文模式」— 一次排程 N 篇圖文貼文到 Facebook 粉專 + Instagram。
> 但圖文跟短影音不同：**每篇文字都不一樣**，沒有通用模板。本資料夾教你用一套標準流程，30 分鐘規劃好 30 篇貼文。

---

## 整套方法論架構

```
1. 主題群規劃（30 分鐘）
   → 一個季度 / 一個月內，要產出幾組「主題系列」？

2. 內容單元拆解（1-2 小時）
   → 每個主題系列拆 5-15 篇貼文（避免一次性散裝）

3. ChatGPT 一次生成 N 篇 caption（10 分鐘）
   → 用本資料夾的 prompt 模板，貼進 ChatGPT 一次出全部

4. 圖片配對 / 生成（1-2 小時）
   → Lovart / Midjourney / Canva 批量產，或手動拍

5. PuffinPuff 批量匯入排程（5 分鐘）
   → 拖入資料夾，自動排到未來 30 天
```

---

## 為什麼要這樣做？

### 痛點 1：每天臨時想要發什麼
→ 解法：**月計畫制**，月初一次規劃整個月內容，每天只是觸發排程

### 痛點 2：每篇貼文文字都從 0 開始寫
→ 解法：**主題系列化**，5-15 篇同主題的微差異，不是每篇都從新主題開始

### 痛點 3：圖片素材永遠不夠用
→ 解法：**統一圖片風格 + AI 生圖**，一次產 30 張同系列圖

### 痛點 4：寫 caption 永遠卡在「破題」
→ 解法：**ChatGPT prompt 模板**，給定主題 + 風格 + 數量，一次生成

---

## 文件清單

| 檔名 | 內容 |
|---|---|
| `00_overview.md` | 本文件，方法論總覽 |
| `01_topic_planning_framework.md` | 主題群規劃心法 + 8 個常用主題框架 |
| `02_chatgpt_prompt_templates.md` | ChatGPT prompt 模板（10+ 種風格） |
| `03_image_generation_guide.md` | 圖片生成 / 找圖指南（Lovart / Midjourney / 免費圖庫） |
| `04_folder_naming_convention.md` | A 模式：配對檔案命名規則 + 文字格式 |
| `05_csv_manifest_template.md` | B 模式：CSV manifest 格式 + 範例下載 |
| `06_workflow_example.md` | **完整實戰案例**：勞資顧問品牌 30 天圖文如何規劃 |
| `example-30-posts/` | 範例資料夾（30 對 jpg + txt） |

---

## 適用平台

| 平台 | 圖文支援 | 備註 |
|---|---|---|
| **Facebook 粉專** | ✅ 完整支援 | 走 `POST /{page-id}/photos` API |
| **Instagram Feed** | ✅ 完整支援 | 走 IG Container API，IG 不接受小於 320×320 圖 |
| ~~YouTube~~ | ❌ 不支援 | YT 無「圖文貼文」API |
| ~~FB / IG Reels~~ | ❌ 不適用 | Reels 是影片，請用影片模式 |
| ~~Stories~~ | ⏰ V0.4+ 規劃 | IG/FB Stories 24h 限時，需另外 API |

---

## 圖片規格快查表

| 平台 | 比例 | 解析度 | 檔案大小 |
|---|---|---|---|
| Facebook 粉專 | 任何（建議 1.91:1 或 1:1） | 至少 1080×1080 | < 10 MB |
| **Instagram Feed**（強推 4:5）| 4:5 / 1:1 / 1.91:1 | **1080×1350**（4:5）/ 1080×1080 / 1080×566 | < 8 MB |
| Instagram Carousel | 1:1（多張要一致比例）| 1080×1080 | 每張 < 8 MB |

**推薦統一規格：1080×1350（4:5）**
- IG 顯示最大、視覺最吸睛
- FB 自動裁切也不會破壞
- 一套圖兩家通用

---

## 開始

下一份請看 → [01_topic_planning_framework.md](./01_topic_planning_framework.md)

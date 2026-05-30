# Meta App Dashboard — Basic Settings

填入 App Dashboard 的「Settings → Basic」與「App Review → Requests」前必須先完整這些欄位。

---

## App Settings → Basic

| Field | Value |
|---|---|
| **Display Name** | PuffinPuff |
| **Namespace** | (leave blank, not needed for non-Canvas apps) |
| **App Domains** | `mememaker-tw.com` |
| **Contact Email** | bisharing001@gmail.com |
| **Privacy Policy URL** | https://mememaker-tw.com/puffinpuff/privacy/ |
| **Terms of Service URL** | https://mememaker-tw.com/puffinpuff/terms/ |
| **User Data Deletion** | URL: https://mememaker-tw.com/puffinpuff/data-deletion/ |
| **App Icon** | 1024×1024 PNG, puffin logo on light background (use `build/icon.png` from project, upscale if needed) |
| **Category** | Productivity |
| **Business Use** | Support my own business |
| **Data Protection Officer Contact** | bisharing001@gmail.com |

---

## App Settings → Advanced

| Field | Value |
|---|---|
| **Allow API Access to App Settings** | NO |
| **App Restrictions: Age** | (leave default — 13+) |
| **App Restrictions: Countries** | (leave blank — global) |
| **App Type** | Business |
| **Server IP Whitelist** | (leave blank — no server) |
| **Login Approval (2FA required for admins)** | YES |

---

## App Review → Permissions and Features

Six permissions to request "Advanced Access" for:

1. `pages_show_list`
2. `pages_read_engagement`
3. `pages_manage_posts`
4. `business_management`
5. `instagram_basic`
6. `instagram_content_publish`

(Detailed submission text per permission → see `02_permissions_usage.md`.)

---

## Use Case Description (the top-level "App Description" field)

> PuffinPuff is a Windows desktop application that helps content creators publish short-form videos simultaneously to Facebook Reels, Instagram Reels, and YouTube Shorts. The app runs entirely on the user's local computer — no servers, no data collection. Users link their Facebook Page and Instagram Business Account via Meta Business Login (OAuth), then drag in a video file, fill in title / description / hashtags, and click publish. PuffinPuff calls the official Meta Graph API (`/me/accounts`, `/{page-id}/video_reels`, `/{ig-user-id}/media`, `/{ig-user-id}/media_publish`) directly from the user's machine to upload the video. The app also supports scheduling future uploads, viewing publish history, and retrying failed publishes. We do not store user data on any server; all OAuth tokens are encrypted with Windows DPAPI and stored only in the user's local AppData folder.

---

## Business Verification

If Meta requires Business Verification for the BM owner (李白廬商行):

| Document | Use |
|---|---|
| 公司營業登記證明 | Business registration |
| 負責人身分證影本 | Person of contact |
| 公司水電帳單（最近 3 個月） | Address proof |

(These are uploaded once at the BM level, not per-app.)

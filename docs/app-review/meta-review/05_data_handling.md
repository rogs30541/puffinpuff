# Meta Data Use Checkup — Answers

Meta 每年強制要求 App 完成「Data Use Checkup」(在 App Dashboard → Data Use Checkup) 確認資料用途。以下是 PuffinPuff 的標準答案。

---

## Section 1: Data You Process

### `pages_show_list`

| Question | Answer |
|---|---|
| Are you currently using this permission? | Yes |
| How are you using it? | Display the list of Facebook Pages the user manages so they can select one as the publish target. |
| Do you store this data? | Yes — only on the user's own Windows PC, in `%APPDATA%\海鸚泡芙 PuffinPuff\puffinpuff.db`. Encrypted with Windows DPAPI. Never sent to any server. |
| Do you share this data with a third party? | No |
| Have you submitted for App Review? | (Yes after submission) |

### `pages_read_engagement`

| Question | Answer |
|---|---|
| Are you currently using this permission? | Yes |
| How are you using it? | Verify Page access token validity and display Page metadata (verified status, category). Do NOT read insights, posts, or engagement metrics. |
| Do you store this data? | Yes — Page name and category cached in local SQLite. Never sent to any server. |
| Do you share this data with a third party? | No |

### `pages_manage_posts`

| Question | Answer |
|---|---|
| Are you currently using this permission? | Yes |
| How are you using it? | Publish Facebook Reels (short-form videos) to the user's selected Page, via the 3-step `/{page-id}/video_reels` API flow. |
| Do you store this data? | Publish history records (post ID, timestamp, status) stored locally only. |
| Do you share this data with a third party? | No |

### `business_management`

| Question | Answer |
|---|---|
| Are you currently using this permission? | Yes |
| How are you using it? | Gating dependency for using Meta Business Login flow (Business Configuration ID: 1275523534730366). |
| Do you store this data? | No data is enumerated or stored beyond what `pages_show_list` already covers. |
| Do you share this data with a third party? | No |

### `instagram_basic`

| Question | Answer |
|---|---|
| Are you currently using this permission? | Yes |
| How are you using it? | Identify the Instagram Business Account linked to the user's selected FB Page; display IG username and profile picture in the Accounts UI. |
| Do you store this data? | IG account ID + username + profile picture URL stored in local SQLite. Never sent to any server. |
| Do you share this data with a third party? | No |

### `instagram_content_publish`

| Question | Answer |
|---|---|
| Are you currently using this permission? | Yes |
| How are you using it? | Upload Instagram Reels (short-form videos) to the user's linked IG Business Account, via the container API flow (`/media` → poll → `/media_publish`). |
| Do you store this data? | Publish history records (media ID, timestamp, status) stored locally only. Video content held in RAM during upload, never persisted. |
| Do you share this data with a third party? | Only Cloudflare cloudflared (official tool) to create temporary tunnel — see Privacy Policy section 4. Tunnel torn down immediately after publish. |

---

## Section 2: Data Retention

| Data Category | Retention Period | Storage Location |
|---|---|---|
| OAuth Access Tokens | Until user disconnects account, OR token expiration (60 days for Meta long-lived tokens, with auto-refresh if v0.2.5+ installed) | `%APPDATA%\海鸚泡芙 PuffinPuff\puffinpuff.db` (DPAPI-encrypted) |
| Page / IG metadata | Until user disconnects account | Same as above |
| Publish history | Indefinite (user can manually clear via Settings → Clear History) | Same as above |
| Video file content | Not stored — read from local disk, streamed to API, discarded | (Not stored) |
| Thumbnails (generated) | 90 days (auto-GC) | `%APPDATA%\海鸚泡芙 PuffinPuff\thumbs\` |
| Transcoded video cache | 30 days (auto-GC) | `%APPDATA%\海鸚泡芙 PuffinPuff\transcoded\` |

---

## Section 3: Data Deletion

User can delete data via 3 paths:

1. **In-app**: Accounts page → Disconnect (token deleted) or Settings → Clear History
2. **Filesystem**: Delete `%APPDATA%\海鸚泡芙 PuffinPuff\` folder
3. **Platform-side revocation**: Facebook Settings → Business Integrations → Remove

Detailed instructions: `https://mememaker-tw.com/puffinpuff/data-deletion/`

---

## Section 4: Third-Party Sharing

| Third Party | What Is Shared | Why |
|---|---|---|
| Meta Graph API | OAuth flow + Page list + Reels upload | The app's purpose |
| Cloudflare cloudflared | Temporary HTTPS URL for IG upload | IG API requires public URL |

**Nothing else.** No analytics, no ads, no CRM, no email lists, no resale.

---

## Section 5: Annual Renewal

Data Use Checkup needs to be completed **annually** in the App Dashboard. Set a calendar reminder for May 21 each year to re-confirm these answers (or update them if PuffinPuff's data handling changes in a major release).

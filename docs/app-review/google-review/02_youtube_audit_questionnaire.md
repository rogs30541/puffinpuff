# YouTube API Services Audit — Questionnaire Answers

通過 Google OAuth Brand Verification 之後，**還要**填這份 YouTube API Services Audit 表單才能讓 `youtube.upload` 走出 Testing 限制。

表單位置：https://support.google.com/youtube/contact/yt_api_form
（或 Google 寄信邀請填寫的連結）

每題答案請對應貼上。如有後續補件信件，重新對照本檔答案。

---

## Section 1: App Overview

### 1.1 What is the name of your app?
PuffinPuff

### 1.2 What is your app's main purpose?
PuffinPuff is a Windows desktop application that helps content creators publish short-form videos to multiple platforms simultaneously: **YouTube Shorts**, Facebook Reels, and Instagram Reels. The user drags a video file into the app, fills in title / description / hashtags / privacy setting once, and clicks "Publish" to upload to all enabled platforms in one operation. The app also supports scheduling future uploads, viewing publish history, and retrying failed publishes.

### 1.3 What YouTube API scopes do you request?
Only one: `https://www.googleapis.com/auth/youtube.upload`

### 1.4 Provide a link to your app
**Application website**: https://mememaker-tw.com/puffinpuff/
**Download installer**: https://mememaker-tw.com/puffinpuff/download/
**Source code (optional)**: https://github.com/vvlee/puffinpuff *(if/when published)*

### 1.5 Is your app available to the public?
Yes — free Windows installer, no payment required, no waiting list.

---

## Section 2: Data Usage

### 2.1 What YouTube user data does your app collect?
The minimal data required to perform an upload:
- OAuth access token + refresh token (returned by Google's OAuth flow)
- User's primary YouTube channel ID + channel name (via `channels.list?part=snippet&mine=true`)
- Channel profile picture URL (for UI display)

Per video upload, the app handles:
- Title, description, hashtags, privacy setting (input by user in the app's content editor)
- Video file content (read from user's local disk, streamed to YouTube)

After upload completes:
- Returned video ID + URL (stored in publish history for the "View on YouTube" link)

### 2.2 Where is this data stored?
**Entirely on the user's local Windows PC.** No server-side storage.

Specifically: `C:\Users\<username>\AppData\Roaming\海鸚泡芙 PuffinPuff\puffinpuff.db` — an SQLite database. OAuth tokens are encrypted with **Windows DPAPI** (a Microsoft OS-level cryptography API) **bound to the user's Windows account**. Even with file-system access to the database, the tokens cannot be decrypted without the user's Windows credentials.

### 2.3 How long is data retained?
- OAuth tokens: Until the user explicitly disconnects via the in-app Accounts page, OR until token expiration (Google refresh tokens after our verification: indefinite unless revoked by user via Google account settings).
- Channel metadata: Same as above.
- Publish history: User-controlled — they can clear it any time via the Settings page; otherwise indefinite.

### 2.4 Is YouTube user data shared with third parties?
**No.** Data is never transmitted anywhere except between the user's PC and `oauth2.googleapis.com` / `youtube.googleapis.com`. There are no analytics services, no CRM integrations, no email lists, no data brokers involved.

---

## Section 3: API Usage Patterns

### 3.1 Which YouTube Data API endpoints does your app call?

| Endpoint | When | Frequency |
|---|---|---|
| `channels.list?mine=true` | Once at account link (post-OAuth) | 1 per account link (rare) |
| `videos.insert` (resumable upload) | Each user-initiated upload | 1 per user-initiated publish |
| (Token refresh via `oauth2.googleapis.com/token`) | When access token expires | Auto on demand |

We do not call: `videos.list`, `videos.update`, `videos.delete`, `playlists.*`, `subscriptions.*`, `comments.*`, `search.list`, or any other endpoint. All API quota use is limited to upload-related operations.

### 3.2 Estimated daily quota usage
- Per user: 1-30 uploads/day typically. Each upload = ~1,600 quota points → 30 uploads ≈ 48,000 points.
- The default per-user quota of 10,000/day will be exceeded by heavy users; we display a clear error and recommend they request a quota increase from Google.
- Average user: 1-3 uploads/day → 1,600-4,800 points (well within default).

### 3.3 Do you implement exponential backoff for API errors?
Yes — both the `googleapis` Node.js SDK (used for `videos.insert`) and our custom code retry on `429 Too Many Requests` and `5xx Server Error` with exponential backoff (1s → 2s → 4s → 8s, max 4 retries).

### 3.4 Do you cache YouTube API responses?
Only the channel metadata is cached locally (channel ID, name, picture URL) — refreshed each time the user re-links the account. We do not cache any upload-related data.

---

## Section 4: User Experience & Compliance

### 4.1 Does your app show YouTube content (videos, channels, comments)?
**No.** PuffinPuff is upload-only. It does not display, embed, or play YouTube content. It only shows: (a) the connected channel's name/ID/picture for confirmation, and (b) a hyperlink to the just-uploaded video after publish.

### 4.2 Does your app interact with the YouTube embed player?
No.

### 4.3 Does your app sell, transfer, or use YouTube data for advertising?
No.

### 4.4 Does your app use YouTube data to train AI/ML models?
No.

### 4.5 Are users able to view, edit, or delete their data?
Yes:
- **View**: Accounts page lists each linked channel with full metadata
- **Edit**: Re-link to update token; per-upload metadata is user-controlled in the content editor
- **Delete**: "Disconnect" button on each account card immediately deletes all local data for that account. User can also delete the entire `%APPDATA%\海鸚泡芙 PuffinPuff\` folder to nuke everything. Detailed instructions: https://mememaker-tw.com/puffinpuff/data-deletion/

### 4.6 Does your app comply with YouTube's spam policies?
Yes — by design:
- Uploads are **always user-initiated** (one click per publish, with explicit content editor confirmation)
- No automated bulk upload feature in the sense of bot-like behavior
- Scheduled uploads are also explicitly created by the user (drag a folder → see preview → confirm)
- We do not generate, modify, or auto-create video content
- We do not facilitate watch-time inflation, view buying, or any artificial engagement

### 4.7 Does your app violate any YouTube Community Guidelines?
No. PuffinPuff is a pure upload-orchestration tool and has no opinion on or relation to the content being uploaded. Responsibility for content compliance rests with the user (clearly stated in our Terms of Service).

---

## Section 5: Security

### 5.1 How are OAuth credentials secured?
- **Client Secret**: Bundled inside the desktop installer; we use the **OAuth 2.0 Loopback IP Address flow with PKCE** so the client secret is not strictly necessary (Google considers Desktop App clients to have low secret-secrecy, and PKCE provides the actual security guarantee against authorization code interception). The client secret is therefore not a high-value attack target.
- **Access/Refresh Tokens**: Encrypted with Windows DPAPI (per-user key) before written to SQLite.
- **Database file**: Standard NTFS file permissions restrict access to the user's own Windows account.

### 5.2 Do you have a vulnerability disclosure policy?
Yes: report to bisharing001@gmail.com with 24-hour acknowledgment SLA.

### 5.3 Have you undergone a security audit?
For v1.0, no formal third-party audit. The codebase is open for inspection (will be on GitHub) and reviewers are welcome to inspect.

---

## Section 6: Demo Video

### 6.1 Provide a YouTube link to a demo video
(Replace with actual URL after upload) **YouTube Unlisted URL**: https://youtu.be/<your-video-id>

The demo video shows:
1. User opens PuffinPuff
2. User clicks "Connect YouTube" in the Accounts page
3. Standard Google OAuth consent screen appears (with clear PuffinPuff branding + requested scopes visible)
4. User authorizes
5. YouTube channel card appears in the app
6. User goes to Publish tab, drags a test video, fills metadata
7. User clicks "Publish Now" — only YouTube enabled
8. PublishProgress UI shows upload bytes, percentage, status updates
9. Success → click "View on YouTube" link → uploaded video appears on YouTube
10. User can disconnect — all local data for that account is deleted

Detailed script: `03_demo_video_script.md`

---

## Section 7: Common Follow-up Questions

### Q: "Your app uses youtube.upload but the use case seems too broad. Can you narrow it?"
**A:** Our app's sole purpose for YouTube is enabling user-initiated, user-content uploads to the user's own channel — this is precisely what `youtube.upload` is designed for, no narrower scope exists for this use case. The "Shorts" use case (vertical 9:16 videos < 180s) is the primary target audience, but technically `youtube.upload` is used for all uploads regardless of duration/orientation, since YouTube's API does not provide a Shorts-specific upload endpoint.

### Q: "How do you prevent abuse / spam uploads?"
**A:** PuffinPuff itself does not multiply or auto-generate uploads — each publish requires explicit user action (drag a file, fill metadata, click Publish). The "scheduled" feature is a delayed user-initiated action, not an automated one — the user creates the schedule manually with explicit confirmation. We do not provide bulk-from-template features, AI-generated content, or any mechanism that would enable spam-at-scale.

### Q: "What happens if YouTube changes its API or policies?"
**A:** We monitor YouTube API release notes. Material changes (e.g., new policy requirements) would be released as a new app version, with users notified via in-app system notification.

---

## Section 8: Contact for Follow-up

**Primary**: bisharing001@gmail.com
**Response SLA**: Within 3 business days for audit-related inquiries

If we receive a rejection notice, we will respond with corrections within 7 business days.

---

## Appendix: Re-audit Preparation

If YouTube requests re-audit (typically annual or after major changes):
1. Update version in this document to reflect current app version
2. Re-record demo video to reflect current UI
3. Verify Privacy Policy still accurately describes current data handling
4. Re-submit via the same support form

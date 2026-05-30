# Google Cloud Console — OAuth Consent Screen Submission

Google Cloud Console 路徑：
**APIs & Services → OAuth consent screen → Edit App**

逐欄填入以下內容，最後點「Publish App」→「Submit for Verification」。

---

## App Information

| Field | Value |
|---|---|
| **User Type** | External |
| **App Name** | PuffinPuff |
| **User support email** | bisharing001@gmail.com |
| **App Logo** | Upload `build/icon.png` (will be displayed at 120×120 in OAuth consent screen) |

## App Domain

| Field | Value |
|---|---|
| **Application home page** | `https://mememaker-tw.com/puffinpuff/` |
| **Application privacy policy link** | `https://mememaker-tw.com/puffinpuff/privacy/` |
| **Application terms of service link** | `https://mememaker-tw.com/puffinpuff/terms/` |

## Authorized Domains

Add these to the "Authorized domains" list:
- `mememaker-tw.com`

If using GitHub Pages mirror, also add:
- `vvlee.github.io` (will not pass Google verification — keep only as informational; verification only needs primary domain)

## Developer Contact Information

| Field | Value |
|---|---|
| **Email addresses** | bisharing001@gmail.com |

---

## Scopes (Step 2 of consent screen wizard)

Add the following sensitive scope:

| Scope | Reason |
|---|---|
| `https://www.googleapis.com/auth/youtube.upload` | Upload videos to the user's YouTube channel |

> 不要加額外 scope。`youtube.upload` 已足以涵蓋上傳功能，不需要 `youtube.readonly`、`youtube.force-ssl` 等。**請求最小化原則**會大幅提升通過率。

### Justification for `youtube.upload`

Paste this in the scope justification field:

> PuffinPuff is a Windows desktop application that helps content creators publish short-form videos (YouTube Shorts) to their own YouTube channel. The application uses `youtube.upload` to call the `videos.insert` endpoint of YouTube Data API v3 (resumable upload protocol). The video file is read from the user's local disk and uploaded directly to YouTube — PuffinPuff has no intermediate servers. The upload includes user-supplied metadata: title, description, hashtags, privacy setting (public / unlisted / private). The user explicitly initiates each upload by clicking "Publish" in the app's UI. We do not perform automated uploads without user action. We do not use this scope to read, modify, or delete existing videos on the user's channel.

---

## Test Users (Step 3)

While in Testing status, add yourself + reviewer + any beta testers (up to 100):
- bisharing001@gmail.com
- (Add Google's verification team email if they request)

After production, this list is no longer enforced — anyone with a Google account can use the app.

---

## Step 4: Summary Page — Click "Back to Dashboard"

Then go to **OAuth consent screen** → **Publishing status** → currently shows "Testing" — click **"PUBLISH APP"** → confirm.

A new section appears: **"App needs to be verified"** → click **"PREPARE FOR VERIFICATION"**.

---

## Verification Form (the actual submission)

The verification form has 3 phases. Fill in:

### Phase 1: General App Information

| Question | Answer |
|---|---|
| How does your app interact with Google APIs? | Desktop application; users authorize via OAuth 2.0 Loopback IP Address flow. The app reads videos from local disk and uploads to YouTube via Data API v3 `videos.insert` (resumable upload). |
| Do you use sensitive scopes? | Yes — `youtube.upload` |
| Do you use restricted scopes? | No |

### Phase 2: Sensitive Scope Justification

**"Why does your app need access to Google user data?"** (paste this verbatim):

> PuffinPuff is a desktop publishing tool for content creators who produce short-form videos for multiple platforms. The core value proposition is "publish to YouTube Shorts, Facebook Reels, and Instagram Reels in one click." The `youtube.upload` scope is essential because uploading videos to the user's own YouTube channel is the **primary function** of the YouTube integration — without this scope, the app cannot fulfill its purpose for YouTube users.
>
> The user data accessed is limited to:
> 1. The user's channel ID and channel name (to display "publishing to: [channel name]" in the UI confirmation)
> 2. Upload progress and status (returned by `videos.insert` resumable upload protocol)
> 3. The video URL and ID after successful upload (to display "View on YouTube" link in the publish history)
>
> We do not access existing videos, comments, watch history, subscriptions, or any other YouTube data. We do not modify or delete content on the user's channel.

### Phase 3: Demonstrate Compliance

| Question | Answer |
|---|---|
| URL to demo video | (Upload the demo video as YouTube unlisted, paste URL here. Script in `03_demo_video_script.md`) |
| Will users connect personal Google accounts or G Suite accounts? | Both — Personal accounts (regular YouTube creators) and Workspace accounts (brand channels) |
| How do you secure user data? | OAuth tokens are encrypted with Windows DPAPI (Data Protection API) bound to the user's Windows account. Tokens are stored only on the user's local PC in `%APPDATA%\海鸚泡芙 PuffinPuff\puffinpuff.db`. No server-side storage of any user data. |
| Where will user data be transmitted? | Only between the user's PC and `oauth2.googleapis.com` / `youtube.googleapis.com`. No intermediate servers. |
| Do you use Google Workspace Marketplace? | No |

---

## Common Rejection Reasons & How to Avoid

| Reason | Fix |
|---|---|
| Privacy policy doesn't mention `youtube.upload` specifically | Already covered in our policy — Privacy Policy Section 1.1 mentions YouTube channel ID & name explicitly |
| Demo video doesn't show OAuth consent screen clearly | Use the script in `03_demo_video_script.md` — first 30 seconds focus on consent screen |
| Domain not verified | Verify `mememaker-tw.com` in Search Console BEFORE submitting; same Google account that owns the OAuth project |
| Logo not matching brand | Use consistent logo across: app icon, OAuth consent, homepage. Use 海鸚泡芙 puffin logo throughout. |
| Use case "too broad" | Specifically describe: only `videos.insert`, only user-initiated, only with user's confirmation in UI |

---

## After Brand Verification Passes

You receive an email "Your app has been verified". This unlocks Production status.

**BUT** — for `youtube.upload`, you must also pass the **YouTube API Services Audit** (separate process). Brand verification only confirms your app's identity; the YouTube audit confirms your app's behavior complies with YouTube policy.

See `02_youtube_audit_questionnaire.md` for that next step.

# Meta App Review — Reviewer Test Instructions

Meta App Review reviewers need to **reproduce your use case independently**. This file is the "Instructions for Testing" you paste into the App Review submission form.

---

## Tester Account Setup (You Must Do This First)

In **Meta App Dashboard → Roles → Test Users**, add the reviewer's test account email (Meta usually provides one like `reviewer-xxxxx@tfbnw.net`) with role **Tester**. The reviewer needs:

- Access to a Facebook Page they can publish to
- A linked Instagram Business Account

Since the reviewer cannot install your Windows app on their machine in many cases, the alternative is to provide **a screencast that fully demonstrates the flow** (the videos in `03_screencast_scripts.md` are designed for this). Many Meta reviewers accept this when:

1. The app is a desktop / native app (not a web app reviewers can sign into)
2. The screencast clearly shows the full OAuth flow + each permission's usage
3. The privacy policy + data deletion + ToS are all publicly accessible

---

## Submission Form: "Provide instructions for reviewing your app"

Paste the following text into the Instructions field for **each** permission submission:

---

### Instructions Block (English, paste verbatim)

**App type**: Native Windows desktop application (Electron-based). Cannot be reviewed by web login.

**Reviewer can verify functionality via the screencast videos attached to this submission** (`meta_login_pages.mp4`, `meta_publish_fb_reel.mp4`, `meta_ig_basic.mp4`, `meta_publish_ig_reel.mp4`).

If the reviewer wishes to run the app directly:

1. Download the installer: `https://mememaker-tw.com/puffinpuff/download/PuffinPuff-0.2.4-Setup.exe`
   (200 MB, code-signed: NO — personal-tier app; SHA-256 checksum: see download page)

2. Install on a Windows 10/11 64-bit machine. Setup wizard takes 30 seconds. No admin elevation required by default.

3. On first launch, the app opens to the Accounts page.

4. **To test Facebook + Instagram linking** (covers `pages_show_list`, `pages_read_engagement`, `business_management`, `instagram_basic`):
   - Click "Connect Facebook" button on the Accounts page
   - The Meta Business Login OAuth window opens (Configuration ID: 1275523534730366)
   - Sign in with the test Facebook account
   - On the consent screen, the app requests: `business_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`
   - Select the test Facebook Page provided
   - Return to the app; the Page card and linked IG Business Account card should appear in the Accounts page

5. **To test FB Reels publishing** (covers `pages_manage_posts`):
   - Switch to the "Publish" tab in the sidebar
   - Drag a test video file (MP4, 15-60 seconds, 1080×1920 9:16 ratio) into the dropzone
   - In the content editor, fill in:
     - Title: "Meta App Review Test"
     - Description: "Test publish for Meta App Review"
     - Hashtags: `#test`
   - Disable YouTube and Instagram chips at the top (only Facebook enabled)
   - Click "Publish Now"
   - The PublishProgress UI shows 3 stages: Start phase → Upload phase → Finish phase
   - On success, click the "View on Facebook" link to verify the Reel is live

6. **To test IG Reels publishing** (covers `instagram_content_publish`):
   - In the Publish tab, re-load the test video
   - Disable YouTube and Facebook chips (only Instagram enabled)
   - Click "Publish Now"
   - The progress UI will show: "Starting cloudflared tunnel..." → "Creating IG container..." → "Polling status..." → "Publishing..."
   - On success, click the "View on Instagram" link to verify the Reel is live

7. **To test account disconnect**:
   - Return to the Accounts page
   - Click "Disconnect" on any account card
   - Confirm in the modal
   - All tokens for that account are immediately deleted from local storage (verified by checking `%APPDATA%\海鸚泡芙 PuffinPuff\puffinpuff.db` — the `accounts` table no longer has that row)

---

## Data Handling for Reviewer

The reviewer should know:

- **No PuffinPuff server**: all OAuth tokens are stored locally in `%APPDATA%\海鸚泡芙 PuffinPuff\puffinpuff.db`, encrypted with Windows DPAPI
- **No third-party analytics**: no GA, no FB Pixel, no Crashlytics, no telemetry
- **Video upload is direct**: video file content goes from the user's PC straight to `rupload.facebook.com` or `graph.facebook.com` — never to a PuffinPuff server (because we have none)
- **IG upload uses Cloudflare cloudflared**: official Cloudflare tool to create a temporary `*.trycloudflare.com` URL pointing to a local HTTP server. The URL is **random and unguessable**, and is **torn down immediately after publishing completes** (matter of seconds). Video data is held in RAM only on the user's PC.

For full details: `https://mememaker-tw.com/puffinpuff/privacy/`

---

## Edge Cases the Reviewer May Encounter

| Symptom | Cause | Resolution |
|---|---|---|
| OAuth window opens but blank | FB blocks Electron's default user agent | App overrides UA with Chrome string — should work; if not, try a different test account |
| "No Pages found" after login | Test account has no Pages | Ensure test FB account has at least 1 Page assigned via Business Manager |
| IG upload fails with "Container ERROR" | Test IG account is not Business type | IG must be Business or Creator — Personal accounts cannot use Reels API |
| Tunnel takes > 30s to start | First run downloads cloudflared (~30 MB) | Wait — subsequent runs are instant |

---

## Demo Test User Account

Provide the reviewer with (at submission time, fill in actual values):

- **FB test account email**: (provide one Meta-issued test user via App Dashboard → Roles)
- **FB Page name**: "PuffinPuff Meta Review Test Page"
- **IG Business Account**: "@puffinpuff_test"
- **Test video file URL**: `https://mememaker-tw.com/puffinpuff/test-assets/test-reel.mp4` (host a 15s test clip)

---

## Re-submission Tips

If the first submission is rejected, common reasons:

1. **Privacy Policy missing specific data items** → Update privacy policy to explicitly mention each data point named in the rejection
2. **Screencast doesn't show OAuth consent screen clearly** → Re-shoot with the OAuth window enlarged to 1280×800
3. **Use case justification too generic** → Use the specific text from `02_permissions_usage.md`; do NOT paraphrase
4. **No way for reviewer to test independently** → Improve `04_tester_instructions.md` and provide test account credentials in submission notes

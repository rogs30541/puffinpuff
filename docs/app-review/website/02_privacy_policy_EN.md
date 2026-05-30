# Privacy Policy｜PuffinPuff 海鸚泡芙

**Last Updated: May 21, 2026**
**Effective Date: May 21, 2026**

---

## Who We Are

"PuffinPuff" (also known as "海鸚泡芙") is a desktop application that runs **locally on the user's Windows PC**. It is developed and maintained by **VVLEE** to help content creators publish short-form videos to YouTube Shorts, Facebook Reels, and Instagram Reels simultaneously, in one click.

**Contact:** bisharing001@gmail.com
**Website:** [https://mememaker-tw.com/puffinpuff/](https://mememaker-tw.com/puffinpuff/)

---

## One-Sentence Summary

**PuffinPuff does not collect, upload, or store any user data on any cloud server. All data lives only on your own computer.**

This application has no backend server, no database host, and no third-party analytics. When you click "Publish," the video is uploaded **directly from your computer to the official YouTube / Facebook / Instagram APIs** — PuffinPuff is never the middleman.

---

## 1. What Data We Collect

### 1.1 Data You Authorize via OAuth

When you link your YouTube, Facebook, or Instagram account in PuffinPuff via the official OAuth flow, we obtain:

| Data | Source | Purpose |
|---|---|---|
| OAuth Access Token | Google / Meta OAuth | Authorize PuffinPuff to upload videos on your behalf |
| OAuth Refresh Token | Google OAuth | Renew the Access Token automatically when it expires |
| YouTube Channel ID & Name | YouTube Data API | Display the currently linked channel in UI |
| Facebook Page ID & Name | Meta Graph API | Display the currently linked Page in UI |
| Instagram Business Account ID & Username | Meta Graph API | Display the currently linked IG account in UI |
| Account Avatar URL | Each platform | Display avatar in UI (not cached to disk) |
| Token Expiry Time (Long-lived) | Meta | Show "X days remaining" reminder |

### 1.2 Content You Drag Into PuffinPuff

| Data | Purpose |
|---|---|
| Video file path | Read the video for upload |
| Video file content (mp4 / mov / webm etc.) | Upload to the platforms you have authorized |
| Title, description, hashtags, privacy setting you input | Fill into the corresponding API fields |
| Auto-generated video thumbnails | Display preview in UI |

### 1.3 What PuffinPuff Does **NOT** Collect

- ❌ Your name, birthday, address, phone number, ID number, or other PII
- ❌ Your Google / Meta account password (OAuth flow never touches passwords)
- ❌ Data from other apps on your computer, browsing history, or file contents
- ❌ Usage analytics, behavior tracking, cookies, or advertising IDs of any kind
- ❌ Device hardware info, IP address, or geolocation

---

## 2. Where Data Is Stored

**All data processed by PuffinPuff is stored on your own Windows computer**, at:

```
C:\Users\<your-username>\AppData\Roaming\海鸚泡芙 PuffinPuff\
```

| File / Folder | Contents |
|---|---|
| `puffinpuff.db` | SQLite database containing account tokens (encrypted), publish history, and schedules |
| `thumbs/` | Video thumbnail cache (jpg) |
| `transcoded/` | Auto-transcoded temporary videos (mp4) |
| `bin/cloudflared.exe` | Third-party tool for temporary IG public URL (see Section 4) |
| Electron Cache folders | Local cache for the app window |

### 2.1 Token Encryption

OAuth Access and Refresh Tokens are encrypted with **Windows DPAPI (Data Protection API)** **bound to your Windows user account** before being written to `puffinpuff.db`. This means:

- Even if someone obtains your `puffinpuff.db` file, **they cannot decrypt the tokens without your Windows login password**
- DPAPI is a Microsoft OS-level service; the encryption key is stored only in the Windows security subsystem on your machine

---

## 3. Data Transmission Path

**PuffinPuff has no servers of its own.** All network requests flow only between:

```
Your computer (PuffinPuff)  ←→  Google / Meta official APIs
                                  ↑
                       Direct transmission, no intermediaries
```

Specific endpoints called:

| Platform | Endpoint | Purpose |
|---|---|---|
| YouTube | `oauth2.googleapis.com` | OAuth token exchange / refresh |
| YouTube | `youtube.googleapis.com` | Video upload (resumable upload) |
| Facebook | `graph.facebook.com` | OAuth + Page list + Reels upload |
| Facebook | `rupload.facebook.com` | Reels video binary upload |
| Instagram | `graph.facebook.com` | OAuth + IG account linking + container create & poll |
| Instagram | `trycloudflare.com` (temporary, see next section) | Temporary URL for IG to fetch video |

---

## 4. Special Note on Instagram Upload (Cloudflared Tunnel)

The official Instagram upload API **requires the video to be a publicly accessible HTTPS URL** (it does not accept direct file uploads from local disk). Therefore PuffinPuff, when publishing to IG:

1. Starts a **temporary HTTP server** on your local machine (random port)
2. Uses the [official Cloudflare cloudflared tool](https://github.com/cloudflare/cloudflared) to create a **temporary trycloudflare.com URL**
3. Submits this URL to the Instagram API
4. Instagram fetches the video from this URL within 30 seconds to a few minutes
5. **Immediately after publishing completes**, the temporary server and tunnel are shut down — the URL becomes invalid

Key properties:
- ✅ The URL is **randomly generated and unpredictable** (cloudflared auto-generates)
- ✅ The URL **invalidates immediately after publish completes** — no public video link is left behind
- ✅ The video itself exists **only in your computer's RAM** (no second disk copy)
- ✅ The entire flow involves **no PuffinPuff servers whatsoever**

---

## 5. Third-Party Services

PuffinPuff interacts with the following third-party services. These have their own privacy policies, **outside the scope of this document**:

| Service | Purpose | Privacy Policy |
|---|---|---|
| Google / YouTube API | OAuth and video upload | [policies.google.com/privacy](https://policies.google.com/privacy) |
| Meta (Facebook, Instagram) Graph API | OAuth and video upload | [www.facebook.com/privacy/policy](https://www.facebook.com/privacy/policy) |
| Cloudflare cloudflared | Temporary tunnel for IG upload | [www.cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |

Data processed by these platforms after you publish content through PuffinPuff is governed by their own policies.

---

## 6. Cookies & Tracking

PuffinPuff is a **desktop application (Electron-based)**. It **uses no cookies**, **deploys no analytics scripts** (no Google Analytics, no Facebook Pixel, no TikTok Pixel, etc.), and **does not track user behavior**.

This documentation website (mememaker-tw.com/puffinpuff) serves only static informational content and contains no tracking scripts either.

---

## 7. Data Deletion & Authorization Revocation

### 7.1 Disconnect Account Within PuffinPuff

Click "Disconnect" next to any account on the Accounts page in the app. This will:
- **Delete all tokens and information for that account** from the local database
- Prevent the app from publishing on behalf of that account

### 7.2 Revoke Authorization on the Platform Side (Recommended in Addition)

| Platform | Revocation URL |
|---|---|
| Google / YouTube | [myaccount.google.com/permissions](https://myaccount.google.com/permissions) |
| Facebook | Settings → Business Integrations → Active Apps and Websites |
| Instagram | Same as Facebook (IG is managed via FB Business Manager) |

### 7.3 Completely Delete All PuffinPuff Local Data

Close the app, then delete the entire folder:
```
C:\Users\<you>\AppData\Roaming\海鸚泡芙 PuffinPuff\
```
This clears all history, tokens, thumbnails, and transcoded caches.

Detailed steps: [Data Deletion Instructions](https://mememaker-tw.com/puffinpuff/data-deletion/)

---

## 8. Children's Privacy

PuffinPuff is **not designed for children under 13** and does not knowingly target them. If we become aware that data of a minor has been collected, we will delete it immediately. In practice this situation will not occur because PuffinPuff collects no personally identifiable information.

---

## 9. Changes to This Policy

If we make material changes to this policy, we will:
1. Update the "Last Updated" date at the top of this page
2. Notify users via an in-app system notification
3. Require users to re-consent for material changes (e.g., new data collection)

---

## 10. Contact Us

For questions about this policy, to exercise data rights, or to report suspected data breaches, please email:

**📧 bisharing001@gmail.com**

We will respond within 7 business days.

---

## Appendix: Compliance Mapping

This policy is drafted with reference to:

- Taiwan Personal Data Protection Act
- EU General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Meta Platform Terms (FB / IG App Review requirements)
- Google API Services User Data Policy (YouTube Audit requirements)
